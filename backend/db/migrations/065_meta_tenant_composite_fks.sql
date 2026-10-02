-- Bind Meta child records to the same workspace as their parent connection.
ALTER TABLE meta_connections ADD CONSTRAINT meta_connections_workspace_id_unique UNIQUE(workspace_id,id);
ALTER TABLE meta_events ADD COLUMN workspace_id uuid;
UPDATE meta_events e SET workspace_id=c.workspace_id FROM meta_connections c WHERE c.id=e.connection_id;
ALTER TABLE meta_events ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE meta_events ADD CONSTRAINT meta_events_workspace_fk FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id);
ALTER TABLE meta_identities ADD CONSTRAINT meta_identities_workspace_fk FOREIGN KEY(workspace_id,connection_id) REFERENCES meta_connections(workspace_id,id);
ALTER TABLE meta_events DROP CONSTRAINT meta_events_connection_id_fkey;
ALTER TABLE meta_identities DROP CONSTRAINT meta_identities_connection_id_fkey;
CREATE INDEX meta_events_workspace_idx ON meta_events(workspace_id,connection_id);
