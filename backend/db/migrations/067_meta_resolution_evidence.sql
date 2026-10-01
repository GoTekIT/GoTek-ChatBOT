ALTER TABLE meta_outbox ADD COLUMN resolution_actor_id uuid REFERENCES users(id);
ALTER TABLE meta_outbox ADD COLUMN resolution_reason text;
-- Repair claims created before leases existed; never requeue an uncertain send.
UPDATE meta_outbox SET lease_expires_at=coalesce(attempted_at,created_at)+interval '10 minutes' WHERE status='dispatching' AND lease_expires_at IS NULL;
