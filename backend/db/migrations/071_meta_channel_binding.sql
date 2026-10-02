DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM meta_connections
   WHERE status IN ('pending','connected','reauth_required','error')
   GROUP BY workspace_id,channel_id HAVING count(*)>1
 ) THEN
   RAISE EXCEPTION 'META_CHANNEL_BINDING_CONFLICT';
 END IF;
END $$;
CREATE UNIQUE INDEX meta_connections_active_channel_uq
 ON meta_connections(workspace_id,channel_id)
 WHERE status IN ('pending','connected','reauth_required','error');
