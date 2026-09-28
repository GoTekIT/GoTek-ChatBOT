ALTER TABLE ai_usage_ledger DROP CONSTRAINT IF EXISTS ai_usage_ledger_total_tokens_check;
ALTER TABLE ai_usage_ledger DROP CONSTRAINT IF EXISTS ai_usage_ledger_check;
ALTER TABLE ai_usage_ledger ADD CONSTRAINT ai_usage_ledger_total_tokens_check CHECK(total_tokens>=prompt_tokens+completion_tokens);
