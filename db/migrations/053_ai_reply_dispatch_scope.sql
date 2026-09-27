-- Worker transactions are tenant-scoped but are not platform-admin sessions.
DROP POLICY IF EXISTS ai_reply_dispatches_scope ON ai_reply_dispatches;
CREATE POLICY ai_reply_dispatches_scope ON ai_reply_dispatches
  USING (workspace_id = nullif(current_setting('app.workspace_id',true),'')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id',true),'')::uuid);
