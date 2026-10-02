-- Preserve original source, including disconnected accounts. Never guess by channel.
ALTER TABLE conversations ADD COLUMN connection_id uuid;

DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM conversations c JOIN visitors v ON v.id=c.visitor_id
  WHERE v.token_hash LIKE 'meta:%' AND NOT EXISTS (
   SELECT 1 FROM meta_connections mc WHERE mc.workspace_id=c.workspace_id
   AND mc.channel_id=c.channel_id
   AND v.token_hash='meta:'||mc.id::text||':'||(v.profile->>'metaUserId')
  )
 ) THEN
  RAISE EXCEPTION 'META_SOURCE_BACKFILL_UNRESOLVED: inspect conversation visitor bindings before migration';
 END IF;
END $$;

UPDATE conversations c SET connection_id=mc.id
FROM visitors v,meta_connections mc
WHERE v.id=c.visitor_id AND mc.workspace_id=c.workspace_id AND mc.channel_id=c.channel_id
AND v.token_hash='meta:'||mc.id::text||':'||(v.profile->>'metaUserId');

ALTER TABLE meta_connections ADD CONSTRAINT meta_connection_channel_identity
 UNIQUE(workspace_id,channel_id,id);
ALTER TABLE conversations ADD CONSTRAINT conversation_source_connection_fk
 FOREIGN KEY(workspace_id,channel_id,connection_id)
 REFERENCES meta_connections(workspace_id,channel_id,id);
CREATE INDEX conversations_source_connection_idx ON conversations(workspace_id,connection_id);
