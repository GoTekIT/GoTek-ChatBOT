ALTER TABLE meta_webhook_quarantine ADD COLUMN workspace_id uuid;
ALTER TABLE meta_webhook_quarantine ADD COLUMN connection_id uuid;

UPDATE meta_webhook_quarantine q
SET workspace_id = c.workspace_id,
    connection_id = c.id
FROM meta_connections c
WHERE c.channel_kind = q.surface
  AND c.external_page_id = q.external_account_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM meta_webhook_quarantine WHERE workspace_id IS NULL OR connection_id IS NULL) THEN
    RAISE EXCEPTION 'META_QUARANTINE_MAPPING_REQUIRED: unresolved quarantine rows must be reviewed before migration';
  END IF;
END $$;

ALTER TABLE meta_connections ADD CONSTRAINT meta_connections_workspace_id_id_uq UNIQUE(workspace_id,id);
ALTER TABLE meta_webhook_quarantine ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE meta_webhook_quarantine ALTER COLUMN connection_id SET NOT NULL;
ALTER TABLE meta_webhook_quarantine ADD CONSTRAINT meta_quarantine_connection_fk
  FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id);
DROP POLICY meta_webhook_quarantine_worker ON meta_webhook_quarantine;
CREATE POLICY meta_webhook_quarantine_scope ON meta_webhook_quarantine
 USING (workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK (workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
