CREATE TABLE contacts(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),full_name text NOT NULL CHECK(char_length(btrim(full_name)) BETWEEN 1 AND 200),email text,phone text,notes text,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id),CHECK(email IS NULL OR char_length(btrim(email)) BETWEEN 3 AND 320),CHECK(phone IS NULL OR char_length(btrim(phone)) BETWEEN 3 AND 40)
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY contacts_scope ON contacts USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON contacts TO gotek_app;
CREATE INDEX contacts_workspace_created ON contacts(workspace_id,created_at DESC,id DESC);
