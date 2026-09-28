CREATE TABLE knowledge_chunks (
 workspace_id uuid NOT NULL,
 version_id uuid NOT NULL,
 chunk_index integer NOT NULL CHECK(chunk_index>=0),
 content text NOT NULL CHECK(char_length(btrim(content)) BETWEEN 1 AND 8000),
 token_estimate integer NOT NULL CHECK(token_estimate>0),
 content_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,version_id,chunk_index),
 FOREIGN KEY(version_id) REFERENCES knowledge_versions(id) ON DELETE CASCADE
);
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_chunks_scope ON knowledge_chunks USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
CREATE INDEX knowledge_chunks_lookup ON knowledge_chunks(workspace_id,version_id,chunk_index);
GRANT SELECT,INSERT,DELETE ON knowledge_chunks TO gotek_app;
