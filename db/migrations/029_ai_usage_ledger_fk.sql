ALTER TABLE ai_usage_ledger DROP CONSTRAINT ai_usage_ledger_workspace_id_fkey;
ALTER TABLE ai_usage_ledger ADD CONSTRAINT ai_usage_ledger_workspace_id_fkey FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
