-- Recover a crashed worker lease without granting the application role
-- arbitrary UPDATE access to the ingress payload table.
CREATE FUNCTION recover_meta_ingress(p_workspace_id uuid)
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
  UPDATE meta_webhook_ingress
  SET state=CASE WHEN attempts>=max_attempts THEN 'dead' ELSE 'retry' END,
      available_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,last_error='LEASE_EXPIRED'
  WHERE workspace_id=p_workspace_id AND state='processing'
    AND (lease_until IS NULL OR lease_until<=clock_timestamp());
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION recover_meta_ingress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recover_meta_ingress(uuid) TO gotek_app;
