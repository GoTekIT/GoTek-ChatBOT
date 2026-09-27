CREATE TABLE knowledge_items (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 source_type text NOT NULL DEFAULT 'MANUAL' CHECK(source_type='MANUAL'),
 active boolean NOT NULL DEFAULT true, audience text NOT NULL DEFAULT 'INTERNAL' CHECK(audience IN ('INTERNAL','PUBLIC')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), draft_version_id uuid, published_version_id uuid,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE TABLE knowledge_versions (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, item_id uuid NOT NULL, version_no integer NOT NULL CHECK(version_no>0),
 title text NOT NULL CHECK(title=btrim(title) AND char_length(title) BETWEEN 1 AND 100),
 content text NOT NULL CHECK(content=btrim(content) AND char_length(content) BETWEEN 1 AND 2000),
 content_hash text NOT NULL, state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','QUEUED','PROCESSING','READY','FAILED')),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,item_id,id), UNIQUE(workspace_id,item_id,version_no),
 FOREIGN KEY(workspace_id,item_id) REFERENCES knowledge_items(workspace_id,id)
);
ALTER TABLE knowledge_items ADD FOREIGN KEY(workspace_id,id,draft_version_id) REFERENCES knowledge_versions(workspace_id,item_id,id);
ALTER TABLE knowledge_items ADD FOREIGN KEY(workspace_id,id,published_version_id) REFERENCES knowledge_versions(workspace_id,item_id,id);
CREATE TABLE knowledge_mutations (
 workspace_id uuid NOT NULL REFERENCES workspaces(id), request_id uuid NOT NULL, operation text NOT NULL, payload jsonb NOT NULL, response jsonb NOT NULL,
 PRIMARY KEY(workspace_id,request_id)
);
CREATE INDEX knowledge_items_list ON knowledge_items(workspace_id,created_at,id);
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_items_scope ON knowledge_items USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
ALTER TABLE knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_versions_scope ON knowledge_versions USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
ALTER TABLE knowledge_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_mutations FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_mutations_scope ON knowledge_mutations USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON knowledge_items TO gotek_app;
GRANT SELECT,INSERT ON knowledge_versions,knowledge_mutations TO gotek_app;
