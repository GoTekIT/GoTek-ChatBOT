-- H28: time-bounded model grants. NULL keeps an explicit non-expiring grant;
-- runtime selectors must require (expires_at IS NULL OR expires_at > now()).
ALTER TABLE model_grants ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS model_grants_active_expiry_idx
  ON model_grants(workspace_id, model_id, capability, expires_at)
  WHERE active;
