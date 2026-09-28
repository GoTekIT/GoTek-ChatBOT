CREATE TABLE quota_budgets (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, meter text NOT NULL CHECK(meter IN ('ai_response','token','conversation','storage_byte')),
 period_start timestamptz NOT NULL, period_end timestamptz NOT NULL, limit_units bigint NOT NULL CHECK(limit_units>=0),
 CHECK(period_end>period_start), UNIQUE(workspace_id,meter,period_start), UNIQUE(workspace_id,id)
);
CREATE TABLE usage_operations (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, budget_id uuid NOT NULL,
 operation_key text NOT NULL CHECK(length(operation_key) BETWEEN 1 AND 200),
 reserved_units bigint NOT NULL CHECK(reserved_units>0), actual_units bigint CHECK(actual_units>=0),
 state text NOT NULL CHECK(state IN ('reserved','unknown','confirmed','released')), receipt_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,operation_key), FOREIGN KEY(workspace_id,budget_id) REFERENCES quota_budgets(workspace_id,id),
 CHECK((state IN ('confirmed','released') AND receipt_id IS NOT NULL AND actual_units IS NOT NULL) OR (state IN ('reserved','unknown') AND actual_units IS NULL)),
 CHECK(state<>'released' OR actual_units=0)
);
CREATE INDEX usage_budget ON usage_operations(workspace_id,budget_id);
ALTER TABLE quota_budgets ENABLE ROW LEVEL SECURITY; ALTER TABLE quota_budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY quota_scope ON quota_budgets USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
ALTER TABLE usage_operations ENABLE ROW LEVEL SECURITY; ALTER TABLE usage_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY usage_scope ON usage_operations USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT ON quota_budgets TO gotek_app;
GRANT SELECT,INSERT,UPDATE ON usage_operations TO gotek_app;
