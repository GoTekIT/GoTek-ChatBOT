CREATE TABLE ai_usage_ledger (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 operation_key text NOT NULL CHECK(char_length(btrim(operation_key)) BETWEEN 1 AND 180),
 provider text NOT NULL CHECK(char_length(btrim(provider)) BETWEEN 1 AND 80),
 model text NOT NULL CHECK(char_length(btrim(model)) BETWEEN 1 AND 180),
 prompt_tokens bigint NOT NULL CHECK(prompt_tokens>=0),
 completion_tokens bigint NOT NULL CHECK(completion_tokens>=0),
 total_tokens bigint NOT NULL CHECK(total_tokens>=prompt_tokens+completion_tokens),
 cost_micros bigint NOT NULL CHECK(cost_micros>=0),
 estimated boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,operation_key)
);
ALTER TABLE ai_usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_ledger_scope ON ai_usage_ledger USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT ON ai_usage_ledger TO gotek_app;
