-- A provider call is an external side effect.  Keep its ownership durable and
-- independent of the scheduler lease so a worker which loses its lease cannot
-- safely (or accidentally) send the same visitor turn a second time.
CREATE TABLE IF NOT EXISTS ai_reply_dispatches (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('unknown','confirmed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  PRIMARY KEY (workspace_id, client_id)
);
ALTER TABLE ai_reply_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reply_dispatches FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_reply_dispatches_scope ON ai_reply_dispatches;
CREATE POLICY ai_reply_dispatches_scope ON ai_reply_dispatches
  USING (current_setting('app.platform', true)='true'
    AND workspace_id = nullif(current_setting('app.workspace_id', true),'')::uuid)
  WITH CHECK (current_setting('app.platform', true)='true'
    AND workspace_id = nullif(current_setting('app.workspace_id', true),'')::uuid);
GRANT SELECT, INSERT, UPDATE ON ai_reply_dispatches TO gotek_app;
