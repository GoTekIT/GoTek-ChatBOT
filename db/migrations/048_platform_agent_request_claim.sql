ALTER TABLE platform_agent_requests ALTER COLUMN response DROP NOT NULL;
ALTER TABLE platform_agent_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','unknown'));
ALTER TABLE platform_agent_requests ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE platform_agent_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;
GRANT UPDATE ON platform_agent_requests TO gotek_app;
