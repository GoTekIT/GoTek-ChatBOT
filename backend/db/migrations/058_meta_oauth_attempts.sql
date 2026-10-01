CREATE TABLE meta_oauth_attempts (
 state_hash text PRIMARY KEY CHECK(state_hash ~ '^[0-9a-f]{64}$'),
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 user_id uuid NOT NULL REFERENCES users(id),
 session_hash text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('facebook','instagram')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 consumed_at timestamptz,
 CHECK(expires_at > created_at)
);
CREATE INDEX meta_oauth_expiry ON meta_oauth_attempts(expires_at);
ALTER TABLE meta_oauth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_oauth_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_oauth_scope ON meta_oauth_attempts
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE,DELETE ON meta_oauth_attempts TO gotek_app;
