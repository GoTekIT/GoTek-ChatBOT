ALTER TABLE platform_agent_requests ADD COLUMN lease_expires_at timestamptz;
ALTER TABLE platform_agent_requests ADD COLUMN dispatched_at timestamptz;
-- Existing pending claims may already have reached a provider; classify conservatively.
UPDATE platform_agent_requests SET lease_expires_at=COALESCE(claimed_at,created_at)+interval '2 minutes',dispatched_at=COALESCE(claimed_at,created_at) WHERE status='pending';
CREATE INDEX platform_agent_expired_pending ON platform_agent_requests(actor_id,lease_expires_at) WHERE status='pending';
GRANT UPDATE ON platform_agent_messages TO gotek_app;
