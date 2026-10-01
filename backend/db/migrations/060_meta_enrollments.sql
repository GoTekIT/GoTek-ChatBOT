CREATE TABLE meta_enrollments (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 user_id uuid NOT NULL REFERENCES users(id),
 session_hash text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('facebook','instagram')),
 grant_ciphertext text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 CHECK(expires_at>created_at)
);
CREATE INDEX meta_enrollment_expiry ON meta_enrollments(expires_at);
ALTER TABLE meta_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_enrollments FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_enrollment_scope ON meta_enrollments
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,DELETE ON meta_enrollments TO gotek_app;
