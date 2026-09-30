-- Upgrade databases that applied 002 before signup entitlement provisioning.
-- Keep the same workspace lifecycle as usage_operations.
GRANT INSERT ON quota_budgets TO gotek_app;
ALTER TABLE quota_budgets DROP CONSTRAINT quota_budgets_workspace_id_fkey;
ALTER TABLE quota_budgets ADD CONSTRAINT quota_budgets_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
