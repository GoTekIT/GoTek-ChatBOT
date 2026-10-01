ALTER TABLE meta_outbox DROP CONSTRAINT meta_outbox_status_check;
ALTER TABLE meta_outbox ADD CONSTRAINT meta_outbox_status_check
 CHECK(status IN ('queued','dispatching','accepted','unknown','reconciliation_required','cancelled'));
ALTER TABLE meta_outbox ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
CREATE INDEX meta_outbox_reconciliation ON meta_outbox(workspace_id,lease_expires_at) WHERE status='dispatching';
