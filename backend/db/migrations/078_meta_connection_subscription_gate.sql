-- A credential check and a webhook subscription are separate gates. A
-- verified Page must not receive live traffic until subscription succeeds.
ALTER TABLE meta_connections DROP CONSTRAINT IF EXISTS meta_connections_status_check;
ALTER TABLE meta_connections ADD CONSTRAINT meta_connections_status_check
  CHECK(status IN ('pending','verified','connected','disconnected','reauth_required','error'));
UPDATE meta_connections SET status='verified',updated_at=now()
WHERE status='connected' AND webhook_subscribed_at IS NULL;
