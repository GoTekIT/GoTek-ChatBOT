CREATE TABLE knowledge_imports (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 uploaded_by uuid NOT NULL REFERENCES users(id),
 filename text NOT NULL CHECK(char_length(btrim(filename)) BETWEEN 1 AND 180),
 mime_type text NOT NULL DEFAULT 'application/octet-stream',
 byte_size integer NOT NULL CHECK(byte_size>0),
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'PROCESSING' CHECK(status IN ('PROCESSING','COMPLETED','FAILED')),
 imported_count integer NOT NULL DEFAULT 0 CHECK(imported_count>=0),
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(workspace_id,id)
);
CREATE INDEX knowledge_imports_workspace_created ON knowledge_imports(workspace_id,created_at DESC,id DESC);
ALTER TABLE knowledge_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_imports FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_imports_scope ON knowledge_imports USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON knowledge_imports TO gotek_app;
