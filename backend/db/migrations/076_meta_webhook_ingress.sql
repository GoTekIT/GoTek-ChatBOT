-- Durable, per-event Meta ingress queue.
-- The public webhook may only call the SECURITY DEFINER enqueue function. It
-- must never read or write another tenant's payload through ordinary RLS.
CREATE TABLE meta_webhook_ingress(
  id uuid PRIMARY KEY,
  provider text NOT NULL DEFAULT 'meta' CHECK(provider='meta'),
  surface text NOT NULL CHECK(surface IN ('facebook_messenger','instagram_messaging','whatsapp_business')),
  external_account_id text NOT NULL CHECK(length(external_account_id) BETWEEN 1 AND 128),
  external_event_id text NOT NULL CHECK(length(external_event_id) BETWEEN 1 AND 256),
  event_kind text NOT NULL CHECK(event_kind IN ('message','status','unknown')),
  payload jsonb NOT NULL,
  workspace_id uuid,
  connection_id uuid,
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','retry','quarantined','succeeded','dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
  FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id),
  UNIQUE(provider,surface,external_account_id,external_event_id,event_kind)
);
CREATE INDEX meta_webhook_ingress_claim_idx ON meta_webhook_ingress(state,available_at,received_at)
  WHERE state IN ('queued','retry');
CREATE INDEX meta_webhook_ingress_workspace_idx ON meta_webhook_ingress(workspace_id,state,received_at);
ALTER TABLE meta_webhook_ingress ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_webhook_ingress FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_webhook_ingress_scope ON meta_webhook_ingress
  USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
  WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT ON meta_webhook_ingress TO gotek_app;

-- Make the legacy quarantine table read-only and tenant-scoped. Existing rows
-- are retained and imported below; no old payload is discarded.
DROP POLICY IF EXISTS meta_webhook_quarantine_worker ON meta_webhook_quarantine;
CREATE POLICY meta_webhook_quarantine_scope ON meta_webhook_quarantine
  USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
  WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
-- The legacy table is retained only for internal worker diagnostics. It is
-- never exposed by the HTTP API and requires the trusted worker marker even
-- when the record has no tenant binding.
CREATE POLICY meta_webhook_quarantine_worker_legacy ON meta_webhook_quarantine
  FOR SELECT USING(current_setting('app.meta_worker',true)='true');
REVOKE INSERT,UPDATE,DELETE ON meta_webhook_quarantine FROM gotek_app;
GRANT SELECT ON meta_webhook_quarantine TO gotek_app;

-- Preserve legacy unresolved records as explicitly quarantined ingress. The
-- event kind remains unknown because the old table did not store the
-- normalized per-event contract.
INSERT INTO meta_webhook_ingress(
  id,provider,surface,external_account_id,external_event_id,event_kind,payload,
  workspace_id,connection_id,state,received_at,expires_at,processed_at,last_error
)
SELECT q.id,q.provider,q.surface,q.external_account_id,q.external_event_id,'unknown',q.payload,
       q.workspace_id,q.connection_id,'quarantined',q.received_at,q.expires_at,q.replayed_at,q.reason
FROM meta_webhook_quarantine q
ON CONFLICT(provider,surface,external_account_id,external_event_id,event_kind) DO NOTHING;

CREATE FUNCTION enqueue_meta_ingress(
  p_surface text,
  p_external_account_id text,
  p_external_event_id text,
  p_event_kind text,
  p_payload jsonb
)
RETURNS TABLE(ingress_id uuid, ingress_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_state text := 'quarantined';
  v_workspace uuid;
  v_connection uuid;
BEGIN
  IF p_surface NOT IN ('facebook_messenger','instagram_messaging','whatsapp_business')
     OR p_event_kind NOT IN ('message','status','unknown')
     OR length(coalesce(p_external_account_id,''))=0
     OR length(coalesce(p_external_event_id,''))=0
     OR pg_column_size(p_payload)>262144 THEN
    RAISE EXCEPTION 'META_INGRESS_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT mc.workspace_id,mc.id INTO v_workspace,v_connection
  FROM meta_connections mc
  WHERE mc.channel_kind=p_surface AND mc.external_page_id=p_external_account_id
  ORDER BY (mc.status='connected') DESC,mc.updated_at DESC,mc.id
  LIMIT 1;
  IF v_connection IS NOT NULL AND EXISTS(
    SELECT 1 FROM meta_connections mc
    WHERE mc.id=v_connection AND mc.status='connected'
  ) THEN v_state:='queued'; END IF;

  INSERT INTO meta_webhook_ingress(
    id,surface,external_account_id,external_event_id,event_kind,payload,
    workspace_id,connection_id,state
  ) VALUES(
    v_id,p_surface,p_external_account_id,p_external_event_id,p_event_kind,p_payload,
    v_workspace,v_connection,v_state
  ) ON CONFLICT(provider,surface,external_account_id,external_event_id,event_kind) DO NOTHING;

  IF v_state='quarantined' THEN
    INSERT INTO meta_webhook_quarantine(
      id,workspace_id,connection_id,surface,external_account_id,external_event_id,payload,reason
    ) VALUES(
      v_id,v_workspace,v_connection,p_surface,p_external_account_id,p_external_event_id,p_payload,
      CASE WHEN v_connection IS NULL THEN 'NO_CONNECTION_MAPPING' ELSE 'META_CONNECTION_NOT_READY' END
    ) ON CONFLICT(provider,surface,external_account_id,external_event_id) DO NOTHING;
  END IF;

  SELECT i.id,i.state INTO ingress_id,ingress_state
  FROM meta_webhook_ingress i
  WHERE i.provider='meta' AND i.surface=p_surface
    AND i.external_account_id=p_external_account_id
    AND i.external_event_id=p_external_event_id
    AND i.event_kind=p_event_kind;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION enqueue_meta_ingress(text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_meta_ingress(text,text,text,text,jsonb) TO gotek_app;

CREATE FUNCTION claim_meta_ingress(p_workspace_id uuid,p_lease_seconds integer DEFAULT 30)
RETURNS TABLE(
  ingress_id uuid,surface text,external_account_id text,external_event_id text,
  event_kind text,payload jsonb,connection_id uuid,workspace_id uuid,
  channel_id uuid,attempts integer,lease_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  IF current_setting('app.meta_worker',true)<>'true'
     OR p_lease_seconds<1 OR p_lease_seconds>300 THEN
    RAISE EXCEPTION 'META_WORKER_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH candidate AS (
    SELECT i.id,coalesce(i.connection_id,mc.id) AS resolved_connection,
           coalesce(i.workspace_id,mc.workspace_id) AS resolved_workspace,
           mc.channel_id
    FROM meta_webhook_ingress i
    LEFT JOIN meta_connections bound ON bound.id=i.connection_id
    LEFT JOIN meta_connections mc ON mc.channel_kind=i.surface
      AND mc.external_page_id=i.external_account_id
      AND mc.status='connected'
    WHERE i.expires_at>clock_timestamp()
      AND i.state IN ('queued','retry')
      AND i.available_at<=clock_timestamp()
      AND (
        i.workspace_id=p_workspace_id
        OR (i.workspace_id IS NULL AND mc.workspace_id=p_workspace_id)
      )
      AND (i.workspace_id IS NOT NULL OR mc.id IS NOT NULL)
    ORDER BY i.available_at,i.received_at,i.id
    FOR UPDATE OF i SKIP LOCKED
    LIMIT 1
  ), updated AS (
    UPDATE meta_webhook_ingress i
    SET workspace_id=c.resolved_workspace,
        connection_id=c.resolved_connection,
        state='processing',
        attempts=i.attempts+1,
        lease_token=gen_random_uuid(),
        lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),
        last_error=NULL
    FROM candidate c
    WHERE i.id=c.id
    RETURNING i.*,c.channel_id
  )
  SELECT u.id,u.surface,u.external_account_id,u.external_event_id,u.event_kind,u.payload,
         u.connection_id,u.workspace_id,u.channel_id,u.attempts,u.lease_token
  FROM updated u;
END;
$$;
REVOKE ALL ON FUNCTION claim_meta_ingress(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_meta_ingress(uuid,integer) TO gotek_app;

CREATE FUNCTION finish_meta_ingress(
  p_id uuid,p_lease_token uuid,p_state text,p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  IF current_setting('app.meta_worker',true)<>'true'
     OR p_state NOT IN ('succeeded','retry','dead','quarantined') THEN
    RAISE EXCEPTION 'META_WORKER_REQUIRED' USING ERRCODE='42501';
  END IF;
  UPDATE meta_webhook_ingress
  SET state=p_state,
      processed_at=CASE WHEN p_state='succeeded' THEN clock_timestamp() ELSE processed_at END,
      available_at=CASE WHEN p_state='retry' THEN clock_timestamp()+make_interval(secs=>least(300,power(2,attempts)::integer)) ELSE available_at END,
      lease_token=NULL,lease_until=NULL,last_error=left(p_error,200)
  WHERE id=p_id AND state='processing' AND lease_token=p_lease_token
    AND workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION finish_meta_ingress(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finish_meta_ingress(uuid,uuid,text,text) TO gotek_app;

CREATE FUNCTION protect_meta_ingress_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.provider IS DISTINCT FROM NEW.provider
     OR OLD.surface IS DISTINCT FROM NEW.surface
     OR OLD.external_account_id IS DISTINCT FROM NEW.external_account_id
     OR OLD.external_event_id IS DISTINCT FROM NEW.external_event_id
     OR OLD.event_kind IS DISTINCT FROM NEW.event_kind
     OR OLD.payload IS DISTINCT FROM NEW.payload
     OR (OLD.workspace_id IS NOT NULL AND OLD.workspace_id IS DISTINCT FROM NEW.workspace_id)
     OR (OLD.connection_id IS NOT NULL AND OLD.connection_id IS DISTINCT FROM NEW.connection_id) THEN
    RAISE EXCEPTION 'META_INGRESS_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER meta_webhook_ingress_identity_guard
BEFORE UPDATE OF provider,surface,external_account_id,external_event_id,event_kind,payload,workspace_id,connection_id
ON meta_webhook_ingress FOR EACH ROW EXECUTE FUNCTION protect_meta_ingress_identity();
