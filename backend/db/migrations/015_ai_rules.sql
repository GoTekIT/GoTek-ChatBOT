CREATE TABLE ai_rules(
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
 content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
 active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_rules_workspace_updated ON ai_rules(workspace_id,updated_at DESC);
ALTER TABLE ai_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_rules_scope ON ai_rules USING (workspace_id = nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_rules TO gotek_app;
