-- Preserve 081 history; reject checkpoints referring to a different tenant.
ALTER TABLE meta_history_sync ADD CONSTRAINT meta_history_connection_tenant_fk
 FOREIGN KEY(workspace_id,connection_id)
 REFERENCES meta_connections(workspace_id,id) ON DELETE CASCADE;
GRANT SELECT,INSERT,UPDATE ON meta_history_sync TO gotek_meta_worker;
