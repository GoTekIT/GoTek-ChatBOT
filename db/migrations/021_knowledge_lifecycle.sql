ALTER TABLE knowledge_versions ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES users(id);
CREATE INDEX IF NOT EXISTS knowledge_versions_state ON knowledge_versions(workspace_id,item_id,state);
GRANT UPDATE ON knowledge_versions TO gotek_app;
