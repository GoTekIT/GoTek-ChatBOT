CREATE TABLE active_citations(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),knowledge_version_id uuid NOT NULL REFERENCES knowledge_versions(id),conversation_id uuid NULL,source_url text NOT NULL,source_title text NOT NULL,quote text NOT NULL CHECK(char_length(quote)<=2000),created_by uuid NOT NULL REFERENCES users(id),revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX active_citations_workspace_created ON active_citations(workspace_id,created_at DESC);
ALTER TABLE active_citations ENABLE ROW LEVEL SECURITY; ALTER TABLE active_citations FORCE ROW LEVEL SECURITY;
CREATE POLICY active_citations_scope ON active_citations USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON active_citations TO gotek_app;
