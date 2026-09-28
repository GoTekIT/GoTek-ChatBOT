CREATE TABLE web_source_document_groups(
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 source_id uuid NOT NULL,
 entry_key text NOT NULL CHECK(char_length(btrim(entry_key)) BETWEEN 1 AND 500),
 current_generation_id uuid,
 published_generation_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,source_id,entry_key),
 FOREIGN KEY(workspace_id,source_id) REFERENCES web_sources(workspace_id,id)
);
CREATE TABLE web_source_generations(
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 group_id uuid NOT NULL,
 snapshot_id uuid NOT NULL,
 parent_generation_id uuid,
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','READY','PUBLISHED','ROLLED_BACK')),
 request_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,request_id),
 FOREIGN KEY(workspace_id,group_id) REFERENCES web_source_document_groups(workspace_id,id),
 FOREIGN KEY(workspace_id,snapshot_id) REFERENCES web_source_snapshots(workspace_id,id),
 FOREIGN KEY(workspace_id,parent_generation_id) REFERENCES web_source_generations(workspace_id,id)
);
CREATE TABLE web_source_generation_parts(
 workspace_id uuid NOT NULL,
 generation_id uuid NOT NULL,
 part_index integer NOT NULL CHECK(part_index>=0),
 action text NOT NULL CHECK(action IN ('UPSERT','RETIRE')),
 knowledge_item_id uuid,
 version_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,generation_id,part_index),
 FOREIGN KEY(workspace_id,generation_id) REFERENCES web_source_generations(workspace_id,id),
 FOREIGN KEY(workspace_id,knowledge_item_id,version_id) REFERENCES knowledge_versions(workspace_id,item_id,id)
);
ALTER TABLE web_source_document_groups ADD CONSTRAINT web_group_current_fk FOREIGN KEY(workspace_id,current_generation_id) REFERENCES web_source_generations(workspace_id,id);
ALTER TABLE web_source_document_groups ADD CONSTRAINT web_group_published_fk FOREIGN KEY(workspace_id,published_generation_id) REFERENCES web_source_generations(workspace_id,id);
DO $$ DECLARE t text; BEGIN FOR t IN SELECT unnest(ARRAY['web_source_document_groups','web_source_generations','web_source_generation_parts']) LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY %I_scope ON %I USING (workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid) WITH CHECK (workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid)',t,t); EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO gotek_app',t); END LOOP; END $$;
