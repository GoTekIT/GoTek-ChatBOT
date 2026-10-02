ALTER TABLE meta_message_deliveries ADD COLUMN connection_id uuid;
UPDATE meta_message_deliveries d SET connection_id=c.connection_id
FROM messages m JOIN conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id
WHERE d.message_id=m.id AND d.workspace_id=m.workspace_id;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM meta_message_deliveries WHERE connection_id IS NULL) THEN
  RAISE EXCEPTION 'META_RECEIPT_BACKFILL_UNRESOLVED: receipt has no original connection';
 END IF;
END $$;
ALTER TABLE meta_message_deliveries ALTER COLUMN connection_id SET NOT NULL;
ALTER TABLE meta_message_deliveries ADD CONSTRAINT meta_receipt_connection_fk
 FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id);
ALTER TABLE meta_message_deliveries DROP CONSTRAINT meta_message_deliveries_workspace_id_provider_message_id_key;
ALTER TABLE meta_message_deliveries ADD CONSTRAINT meta_receipt_provider_connection_uq
 UNIQUE(workspace_id,connection_id,provider_message_id);
