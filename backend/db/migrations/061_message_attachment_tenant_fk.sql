-- Enforce attachment/message tenant agreement independently of application code.
ALTER TABLE messages ADD CONSTRAINT messages_workspace_id_id_unique UNIQUE(workspace_id,id);
ALTER TABLE message_attachments ADD CONSTRAINT message_attachments_tenant_message_fk
 FOREIGN KEY(workspace_id,message_id) REFERENCES messages(workspace_id,id) ON DELETE CASCADE;
