ALTER TABLE contacts ADD COLUMN deleted_at timestamptz;
CREATE INDEX contacts_workspace_active_created_idx ON contacts(workspace_id,created_at DESC,id DESC) WHERE deleted_at IS NULL;
