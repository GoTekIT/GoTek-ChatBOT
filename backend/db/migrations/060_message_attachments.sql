CREATE TABLE message_attachments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 message_id uuid NOT NULL,
 workspace_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('image','video','audio','file')),
 url text NOT NULL CHECK(length(url) BETWEEN 1 AND 8192),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE INDEX message_attachments_message_idx ON message_attachments(workspace_id,message_id);
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY; ALTER TABLE message_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY message_attachments_scope ON message_attachments USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT ON message_attachments TO gotek_app;
