CREATE TABLE jobs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), kind text NOT NULL CHECK(length(kind) BETWEEN 1 AND 80),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200), payload jsonb NOT NULL,
 external_effect boolean NOT NULL DEFAULT false,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','retry','succeeded','unknown','dead','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), max_attempts integer NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 10),
 available_at timestamptz NOT NULL DEFAULT now(), lease_token uuid, lease_until timestamptz, receipt_id text, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,idempotency_key), CHECK(state<>'succeeded' OR receipt_id IS NOT NULL)
);
CREATE INDEX job_claim ON jobs(workspace_id,available_at) WHERE state IN ('queued','retry');
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY; ALTER TABLE jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY job_scope ON jobs USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON jobs TO gotek_app;
