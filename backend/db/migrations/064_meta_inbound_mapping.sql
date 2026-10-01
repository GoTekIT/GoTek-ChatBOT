CREATE TABLE meta_contacts (
 workspace_id uuid NOT NULL,
 connection_id uuid NOT NULL,
 external_user_id text NOT NULL,
 conversation_id uuid NOT NULL,
 last_inbound_at timestamptz,
 PRIMARY KEY(connection_id,external_user_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id),
 FOREIGN KEY(workspace_id,conversation_id) REFERENCES conversations(workspace_id,id)
);
CREATE TABLE meta_inbound_messages (
 workspace_id uuid NOT NULL,
 connection_id uuid NOT NULL,
 external_message_id text NOT NULL,
 message_id uuid NOT NULL REFERENCES messages(id),
 provider_timestamp timestamptz,
 PRIMARY KEY(connection_id,external_message_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id)
);
ALTER TABLE meta_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE meta_inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_inbound_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_contacts_scope ON meta_contacts
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
CREATE POLICY meta_inbound_scope ON meta_inbound_messages
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON meta_contacts,meta_inbound_messages TO gotek_app;
ALTER TABLE meta_webhook_receipts ADD COLUMN outcome jsonb;
