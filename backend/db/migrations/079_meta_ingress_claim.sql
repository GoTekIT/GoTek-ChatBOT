-- Bind previously unassigned events only to the operator-selected connection
-- whose provider account matches exactly. The binding is one-way and guarded
-- by the identity trigger from migration 076.
CREATE FUNCTION claim_meta_unassigned(p_workspace_id uuid,p_connection_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE v_count integer;
BEGIN
  IF current_setting('app.meta_worker',true)<>'true' THEN
    RAISE EXCEPTION 'META_WORKER_REQUIRED' USING ERRCODE='42501';
  END IF;
  UPDATE meta_webhook_ingress i
  SET workspace_id=p_workspace_id,
      connection_id=p_connection_id,
      state=CASE WHEN i.event_kind='unknown' THEN 'quarantined' ELSE 'queued' END,
      available_at=clock_timestamp(),last_error='CLAIMED_BY_CONNECTION'
  FROM meta_connections c
  WHERE c.id=p_connection_id AND c.workspace_id=p_workspace_id
    AND i.workspace_id IS NULL AND i.connection_id IS NULL
    AND i.surface=c.channel_kind AND i.external_account_id=c.external_page_id
    AND i.expires_at>clock_timestamp();
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION claim_meta_unassigned(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_meta_unassigned(uuid,uuid) TO gotek_app;
