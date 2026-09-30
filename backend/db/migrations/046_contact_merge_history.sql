CREATE TABLE contact_merge_history(
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), request_id uuid NOT NULL,
 primary_id uuid NOT NULL, secondary_id uuid NOT NULL, primary_before jsonb NOT NULL, secondary_before jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), undone_at timestamptz, UNIQUE(workspace_id,request_id), UNIQUE(workspace_id,id));
ALTER TABLE contact_merge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_merge_history FORCE ROW LEVEL SECURITY;
CREATE POLICY contact_merge_history_scope ON contact_merge_history USING (workspace_id=current_setting('app.workspace_id',true)::uuid) WITH CHECK (workspace_id=current_setting('app.workspace_id',true)::uuid);
GRANT SELECT,INSERT,UPDATE ON contact_merge_history TO gotek_app;
