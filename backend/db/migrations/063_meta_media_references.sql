CREATE TABLE meta_media_references(
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 message_id uuid NOT NULL,
 provider text NOT NULL DEFAULT 'meta',
 media_type text NOT NULL CHECK(media_type IN ('image','video','audio','file')),
 external_media_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,message_id,provider,external_media_id),
 FOREIGN KEY(workspace_id,message_id) REFERENCES messages(workspace_id,id)
);
ALTER TABLE meta_media_references ENABLE ROW LEVEL SECURITY; ALTER TABLE meta_media_references FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_media_references_scope ON meta_media_references USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT ON meta_media_references TO gotek_app;
