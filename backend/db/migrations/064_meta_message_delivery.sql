-- Durable provider receipt projection for outbound Meta messages.
CREATE TABLE IF NOT EXISTS meta_message_deliveries(
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  message_id uuid NOT NULL,
  provider_message_id text NOT NULL,
  status text NOT NULL CHECK(status IN ('accepted','sent','delivered','read','failed','unknown')),
  error_code text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,message_id),
  UNIQUE(workspace_id,provider_message_id),
  FOREIGN KEY(workspace_id,message_id) REFERENCES messages(workspace_id,id)
);
CREATE INDEX IF NOT EXISTS meta_message_deliveries_provider_idx ON meta_message_deliveries(workspace_id,provider_message_id);
ALTER TABLE meta_message_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_message_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_message_deliveries_tenant ON meta_message_deliveries USING(workspace_id::text=current_setting('app.workspace_id',true));
GRANT SELECT,INSERT,UPDATE ON meta_message_deliveries TO gotek_app;
