ALTER TABLE knowledge_items DROP CONSTRAINT knowledge_items_source_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_source_type_check CHECK(source_type IN ('MANUAL','WEB'));
ALTER TABLE web_source_snapshots ADD CONSTRAINT web_snapshots_workspace_id_unique UNIQUE(workspace_id,id);
CREATE TABLE web_snapshot_knowledge(
 workspace_id uuid NOT NULL,
 snapshot_id uuid NOT NULL,
 item_index integer NOT NULL CHECK(item_index>=0),
 part_index integer NOT NULL CHECK(part_index>=0),
 knowledge_item_id uuid NOT NULL,
 draft_version_id uuid NOT NULL,
 input jsonb NOT NULL CHECK(jsonb_typeof(input)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,snapshot_id,item_index,part_index),
 FOREIGN KEY(workspace_id,snapshot_id) REFERENCES web_source_snapshots(workspace_id,id),
 FOREIGN KEY(workspace_id,knowledge_item_id,draft_version_id) REFERENCES knowledge_versions(workspace_id,item_id,id)
);
ALTER TABLE web_snapshot_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_snapshot_knowledge FORCE ROW LEVEL SECURITY;
CREATE POLICY web_snapshot_knowledge_scope ON web_snapshot_knowledge
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT ON web_snapshot_knowledge TO gotek_app;
