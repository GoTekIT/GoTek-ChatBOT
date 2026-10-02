-- Bound retained webhook/quarantine storage without exposing payloads to the app role.
CREATE OR REPLACE FUNCTION cleanup_expired_meta_ingress(p_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 PERFORM require_meta_worker();
 IF p_limit<1 OR p_limit>5000 THEN RAISE EXCEPTION 'META_WORKER_REQUIRED' USING ERRCODE='42501'; END IF;
 WITH doomed AS (
  SELECT id FROM meta_webhook_ingress WHERE expires_at<=clock_timestamp()
   AND state IN ('quarantined','succeeded','dead') ORDER BY expires_at,id FOR UPDATE SKIP LOCKED LIMIT p_limit
 ) DELETE FROM meta_webhook_ingress i USING doomed WHERE i.id=doomed.id;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION cleanup_expired_meta_ingress(integer) FROM PUBLIC,gotek_app;
GRANT EXECUTE ON FUNCTION cleanup_expired_meta_ingress(integer) TO gotek_meta_worker;
