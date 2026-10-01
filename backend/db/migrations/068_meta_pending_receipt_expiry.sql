ALTER TABLE meta_webhook_receipts ADD COLUMN IF NOT EXISTS waiting_until timestamptz;
CREATE INDEX meta_receipt_waiting ON meta_webhook_receipts(workspace_id,waiting_until)
 WHERE processed_at IS NULL AND waiting_until IS NOT NULL;
-- Existing pending receipts receive a bounded review window; they are never replayed forever.
UPDATE meta_webhook_receipts r SET waiting_until=r.received_at+interval '24 hours'
 WHERE r.processed_at IS NULL AND r.waiting_until IS NULL;
