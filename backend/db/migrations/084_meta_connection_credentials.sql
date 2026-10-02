CREATE TABLE meta_connection_credentials (
 workspace_id uuid NOT NULL,
 connection_id uuid NOT NULL,
 encrypted_token text NOT NULL CHECK(length(encrypted_token) BETWEEN 1 AND 24000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,connection_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id)
);
ALTER TABLE meta_connection_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_connection_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_credential_scope ON meta_connection_credentials
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON meta_connection_credentials TO gotek_app;
GRANT SELECT ON meta_connection_credentials TO gotek_meta_worker;
