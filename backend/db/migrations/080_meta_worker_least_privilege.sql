-- The ingress state machine is executable only by the dedicated worker login.
-- app.meta_worker is an audit marker, not an authorization mechanism: a tenant
-- application session can set a custom GUC itself.
CREATE ROLE gotek_meta_worker NOLOGIN IN ROLE gotek_app;

CREATE OR REPLACE FUNCTION require_meta_worker() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF session_user <> 'gotek_meta_worker' THEN
    RAISE EXCEPTION 'META_WORKER_REQUIRED' USING ERRCODE='42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION require_meta_worker() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION require_meta_worker() TO gotek_meta_worker;

-- Replace the forgeable GUC checks in the durable worker functions.
CREATE OR REPLACE FUNCTION claim_meta_ingress(p_workspace_id uuid,p_lease_seconds integer DEFAULT 30)
RETURNS TABLE(ingress_id uuid,surface text,external_account_id text,external_event_id text,event_kind text,payload jsonb,connection_id uuid,workspace_id uuid,channel_id uuid,attempts integer,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM require_meta_worker();
  IF p_lease_seconds<1 OR p_lease_seconds>300 THEN RAISE EXCEPTION 'META_WORKER_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  WITH candidate AS (
    SELECT i.id,coalesce(i.connection_id,mc.id) AS resolved_connection,coalesce(i.workspace_id,mc.workspace_id) AS resolved_workspace,mc.channel_id
    FROM meta_webhook_ingress i LEFT JOIN meta_connections bound ON bound.id=i.connection_id
    LEFT JOIN meta_connections mc ON mc.channel_kind=i.surface AND mc.external_page_id=i.external_account_id AND mc.status='connected'
    WHERE i.expires_at>clock_timestamp() AND i.state IN ('queued','retry') AND i.available_at<=clock_timestamp()
      AND (i.workspace_id=p_workspace_id OR (i.workspace_id IS NULL AND mc.workspace_id=p_workspace_id))
      AND (i.workspace_id IS NOT NULL OR mc.id IS NOT NULL)
    ORDER BY i.available_at,i.received_at,i.id FOR UPDATE OF i SKIP LOCKED LIMIT 1
  ), updated AS (
    UPDATE meta_webhook_ingress i SET workspace_id=c.resolved_workspace,connection_id=c.resolved_connection,state='processing',attempts=i.attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),last_error=NULL FROM candidate c WHERE i.id=c.id RETURNING i.*,c.channel_id
  ) SELECT u.id,u.surface,u.external_account_id,u.external_event_id,u.event_kind,u.payload,u.connection_id,u.workspace_id,u.channel_id,u.attempts,u.lease_token FROM updated u;
END $$;
REVOKE ALL ON FUNCTION claim_meta_ingress(uuid,integer) FROM PUBLIC,gotek_app;
GRANT EXECUTE ON FUNCTION claim_meta_ingress(uuid,integer) TO gotek_meta_worker;

CREATE OR REPLACE FUNCTION recover_meta_ingress(p_workspace_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ DECLARE n integer; BEGIN PERFORM require_meta_worker(); UPDATE meta_webhook_ingress SET state=CASE WHEN attempts>=max_attempts THEN 'dead' ELSE 'retry' END,available_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,last_error='LEASE_EXPIRED' WHERE workspace_id=p_workspace_id AND state='processing' AND (lease_until IS NULL OR lease_until<=clock_timestamp()); GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;
REVOKE ALL ON FUNCTION recover_meta_ingress(uuid) FROM PUBLIC,gotek_app; GRANT EXECUTE ON FUNCTION recover_meta_ingress(uuid) TO gotek_meta_worker;

CREATE OR REPLACE FUNCTION finish_meta_ingress(p_id uuid,p_lease_token uuid,p_state text,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN PERFORM require_meta_worker(); IF p_state NOT IN ('succeeded','retry','dead','quarantined') THEN RAISE EXCEPTION 'META_WORKER_REQUIRED' USING ERRCODE='42501'; END IF; UPDATE meta_webhook_ingress SET state=p_state,processed_at=CASE WHEN p_state='succeeded' THEN clock_timestamp() ELSE processed_at END,available_at=CASE WHEN p_state='retry' THEN clock_timestamp()+make_interval(secs=>least(300,power(2,attempts)::integer)) ELSE available_at END,lease_token=NULL,lease_until=NULL,last_error=left(p_error,200) WHERE id=p_id AND state='processing' AND lease_token=p_lease_token AND workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid; RETURN FOUND; END $$;
REVOKE ALL ON FUNCTION finish_meta_ingress(uuid,uuid,text,text) FROM PUBLIC,gotek_app; GRANT EXECUTE ON FUNCTION finish_meta_ingress(uuid,uuid,text,text) TO gotek_meta_worker;

-- Replay is invoked by an authenticated workspace actor; SQL still enforces the
-- workspace boundary and the quarantine state in one operation.
CREATE OR REPLACE FUNCTION requeue_meta_ingress(p_workspace_id uuid,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN UPDATE meta_webhook_ingress SET state='queued',available_at=clock_timestamp(),last_error=NULL WHERE id=p_id AND workspace_id=p_workspace_id AND state='quarantined' AND expires_at>clock_timestamp(); RETURN FOUND; END $$;
REVOKE ALL ON FUNCTION requeue_meta_ingress(uuid,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION requeue_meta_ingress(uuid,uuid) TO gotek_app;

CREATE OR REPLACE FUNCTION annotate_meta_ingress(p_workspace_id uuid,p_surface text,p_account text,p_event_id text,p_reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
  UPDATE meta_webhook_ingress SET last_error=left(p_reason,200)
   WHERE workspace_id=p_workspace_id AND surface=p_surface AND external_account_id=p_account
     AND external_event_id=p_event_id AND event_kind='unknown';
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION annotate_meta_ingress(uuid,text,text,text,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION annotate_meta_ingress(uuid,text,text,text,text) TO gotek_app;

-- Legacy rows are never readable merely by setting a custom GUC.
DROP POLICY IF EXISTS meta_webhook_quarantine_worker_legacy ON meta_webhook_quarantine;
CREATE POLICY meta_webhook_quarantine_worker_legacy ON meta_webhook_quarantine FOR SELECT USING (session_user='gotek_meta_worker' AND current_setting('app.meta_worker',true)='true');

CREATE OR REPLACE FUNCTION claim_meta_unassigned(p_workspace_id uuid,p_connection_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ DECLARE n integer; BEGIN
  IF nullif(current_setting('app.workspace_id',true),'')::uuid IS DISTINCT FROM p_workspace_id THEN RAISE EXCEPTION 'META_TENANT_SCOPE_REQUIRED' USING ERRCODE='42501'; END IF;
  UPDATE meta_webhook_ingress i SET workspace_id=p_workspace_id,connection_id=p_connection_id,state=CASE WHEN i.event_kind='unknown' THEN 'quarantined' ELSE 'queued' END,available_at=clock_timestamp(),last_error='CLAIMED_BY_CONNECTION' FROM meta_connections c WHERE c.id=p_connection_id AND c.workspace_id=p_workspace_id AND i.workspace_id IS NULL AND i.connection_id IS NULL AND i.surface=c.channel_kind AND i.external_account_id=c.external_page_id AND i.expires_at>clock_timestamp(); GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION claim_meta_unassigned(uuid,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION claim_meta_unassigned(uuid,uuid) TO gotek_app;
