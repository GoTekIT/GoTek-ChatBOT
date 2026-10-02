CREATE TABLE conversation_tags(
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 conversation_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 80),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,conversation_id,name),
 FOREIGN KEY(workspace_id,conversation_id) REFERENCES conversations(workspace_id,id) ON DELETE CASCADE
);
ALTER TABLE conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags FORCE ROW LEVEL SECURITY;
CREATE POLICY conversation_tags_scope ON conversation_tags USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,DELETE ON conversation_tags TO gotek_app;
