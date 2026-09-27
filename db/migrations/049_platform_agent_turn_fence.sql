ALTER TABLE platform_agent_requests ADD COLUMN session_id uuid REFERENCES platform_agent_sessions(id) ON DELETE CASCADE;
ALTER TABLE platform_agent_requests ADD COLUMN claim_token uuid;
CREATE UNIQUE INDEX platform_agent_one_pending_turn ON platform_agent_requests(session_id) WHERE status='pending' AND session_id IS NOT NULL;
