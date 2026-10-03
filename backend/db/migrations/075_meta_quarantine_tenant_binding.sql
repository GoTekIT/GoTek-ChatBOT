ALTER TABLE meta_webhook_quarantine ADD COLUMN workspace_id uuid;
ALTER TABLE meta_webhook_quarantine ADD COLUMN connection_id uuid;

ALTER TABLE meta_connections ADD CONSTRAINT meta_connections_workspace_id_id_uq UNIQUE(workspace_id,id);
ALTER TABLE meta_webhook_quarantine ADD CONSTRAINT meta_quarantine_connection_fk
  FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id);
DROP POLICY meta_webhook_quarantine_worker ON meta_webhook_quarantine;
CREATE POLICY meta_webhook_quarantine_worker ON meta_webhook_quarantine
 USING (current_setting('app.meta_worker',true)='true' OR workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK (current_setting('app.meta_worker',true)='true' OR workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
CREATE INDEX meta_webhook_quarantine_unassigned_idx ON meta_webhook_quarantine(received_at)
 WHERE workspace_id IS NULL OR connection_id IS NULL;
