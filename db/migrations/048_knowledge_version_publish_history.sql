ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS first_published_at timestamptz;
GRANT UPDATE ON knowledge_versions TO gotek_app;
