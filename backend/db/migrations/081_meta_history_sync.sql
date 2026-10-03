-- Durable per-connection cursor for provider history recovery after downtime.
CREATE TABLE IF NOT EXISTS meta_history_sync(
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  next_url text,
  last_synced_at timestamptz,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','complete','retry')),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,connection_id)
);
ALTER TABLE meta_history_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_history_sync FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_history_sync_scope ON meta_history_sync USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON meta_history_sync TO gotek_app;
