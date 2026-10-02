DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM meta_connections
    GROUP BY channel_kind, external_page_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'META_MAPPING_AMBIGUOUS: duplicate external account mapping';
  END IF;
END $$;

CREATE UNIQUE INDEX meta_connections_external_account_uq
  ON meta_connections(channel_kind, external_page_id);

CREATE OR REPLACE FUNCTION resolve_meta_connection_route(
  p_channel_kind text,
  p_external_account_id text
)
RETURNS TABLE(connection_id uuid, workspace_id uuid, channel_id uuid, page_name text, status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, workspace_id, channel_id, page_name, status
  FROM meta_connections
  WHERE channel_kind = p_channel_kind
    AND external_page_id = p_external_account_id
    AND status = 'connected'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION resolve_meta_connection_route(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_meta_connection_route(text, text) TO gotek_app;
