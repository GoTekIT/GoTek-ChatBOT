CREATE TABLE meta_webhook_quarantine(
 id uuid PRIMARY KEY,
 provider text NOT NULL DEFAULT 'meta',
 surface text NOT NULL,
 external_account_id text NOT NULL,
 external_event_id text NOT NULL,
 payload jsonb NOT NULL,
 reason text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 replayed_at timestamptz,
 UNIQUE(provider,surface,external_account_id,external_event_id)
);
ALTER TABLE meta_webhook_quarantine ENABLE ROW LEVEL SECURITY;
CREATE POLICY meta_webhook_quarantine_worker ON meta_webhook_quarantine
 USING (current_setting('app.meta_worker',true)='true')
 WITH CHECK (current_setting('app.meta_worker',true)='true');
GRANT SELECT,INSERT,UPDATE,DELETE ON meta_webhook_quarantine TO gotek_app;
