CREATE TABLE meta_webhook_receipts (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 connection_id uuid NOT NULL,
 generation integer NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}$'),
 payload jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE(connection_id,generation,payload_hash),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id)
);
ALTER TABLE meta_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_webhook_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_receipt_scope ON meta_webhook_receipts
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON meta_webhook_receipts TO gotek_app;
CREATE INDEX meta_receipt_pending ON meta_webhook_receipts(workspace_id,received_at) WHERE processed_at IS NULL;

-- Narrow ingress resolver: metadata only, no credential or tenant chat reads.
-- Owned by migration administrator; application role remains NOBYPASSRLS.
CREATE FUNCTION resolve_meta_ingress(requested_provider text,requested_asset text)
RETURNS TABLE(workspace_id uuid,connection_id uuid,generation integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET row_security=off
AS $$
 SELECT m.workspace_id,m.id,m.generation FROM public.meta_connections m
 JOIN public.workspaces w ON w.id=m.workspace_id
 WHERE m.provider=requested_provider AND m.asset_id=requested_asset
 AND m.status IN ('pending','active') AND w.status='active'
 AND requested_provider IN ('facebook','instagram') AND requested_asset ~ '^[0-9]{1,100}$'
$$;
REVOKE ALL ON FUNCTION resolve_meta_ingress(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_meta_ingress(text,text) TO gotek_app;
