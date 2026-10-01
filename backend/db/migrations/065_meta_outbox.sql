CREATE TABLE meta_outbox (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL,
 connection_id uuid NOT NULL,
 generation integer NOT NULL,
 conversation_id uuid NOT NULL,
 message_id uuid NOT NULL UNIQUE REFERENCES messages(id),
 recipient_id text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id),
 owner_version integer NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','dispatching','accepted','unknown','cancelled')),
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 attempted_at timestamptz,
 completed_at timestamptz,
 FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id),
 FOREIGN KEY(workspace_id,conversation_id) REFERENCES conversations(workspace_id,id),
 CHECK(status<>'accepted' OR provider_message_id IS NOT NULL)
);
ALTER TABLE meta_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_outbox_scope ON meta_outbox
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON meta_outbox TO gotek_app;
CREATE INDEX meta_outbox_queue ON meta_outbox(workspace_id,created_at) WHERE status='queued';
