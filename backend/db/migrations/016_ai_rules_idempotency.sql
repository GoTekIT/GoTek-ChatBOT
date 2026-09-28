ALTER TABLE ai_rules ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE ai_rules ADD COLUMN IF NOT EXISTS request_payload jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS ai_rules_workspace_request_id ON ai_rules(workspace_id,request_id) WHERE request_id IS NOT NULL;
