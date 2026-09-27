CREATE TABLE platform_agent_requests (
 actor_id uuid NOT NULL REFERENCES users(id),
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE platform_agent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_agent_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_agent_requests_actor ON platform_agent_requests
 USING(current_setting('app.platform',true)='true' AND actor_id=nullif(current_setting('app.actor_id',true),'')::uuid)
 WITH CHECK(current_setting('app.platform',true)='true' AND actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
GRANT SELECT,INSERT ON platform_agent_requests TO gotek_app;
