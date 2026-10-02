CREATE TABLE meta_oauth_sessions (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 user_id uuid NOT NULL REFERENCES users(id),
 session_hash text NOT NULL,
 state_hash text NOT NULL UNIQUE,
 redirect_uri text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','completed')),
 encrypted_accounts text,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE meta_oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_oauth_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_oauth_scope ON meta_oauth_sessions
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE,DELETE ON meta_oauth_sessions TO gotek_app;
