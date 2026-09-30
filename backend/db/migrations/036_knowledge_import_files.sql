-- Local/test durable originals, committed with their import receipt.
CREATE TABLE knowledge_import_files (
 workspace_id uuid NOT NULL,
 import_id uuid NOT NULL,
 bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 1 AND 10485760),
 PRIMARY KEY(workspace_id,import_id),
 FOREIGN KEY(workspace_id,import_id) REFERENCES knowledge_imports(workspace_id,id) ON DELETE CASCADE
);
ALTER TABLE knowledge_import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_import_files FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_import_files_scope ON knowledge_import_files
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT ON knowledge_import_files TO gotek_app;
