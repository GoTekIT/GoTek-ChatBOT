-- Expose only active tenant identifiers to the trusted local scheduler.
-- Do not broaden workspace row visibility for the application role.
CREATE FUNCTION public.worker_active_tenants(after_id uuid, page_size integer)
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
 SELECT w.id FROM public.workspaces w
 WHERE w.status='active' AND (after_id IS NULL OR w.id>after_id)
 ORDER BY w.id LIMIT greatest(1,least(page_size,100))
$$;
REVOKE ALL ON FUNCTION public.worker_active_tenants(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_active_tenants(uuid,integer) TO gotek_app;
