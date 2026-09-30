ALTER TABLE knowledge_versions ADD CONSTRAINT knowledge_versions_workspace_id_id_unique UNIQUE(workspace_id,id);
ALTER TABLE knowledge_chunks DROP CONSTRAINT knowledge_chunks_version_id_fkey;
ALTER TABLE knowledge_chunks ADD CONSTRAINT knowledge_chunks_tenant_version_fkey FOREIGN KEY(workspace_id,version_id) REFERENCES knowledge_versions(workspace_id,id) ON DELETE CASCADE;
