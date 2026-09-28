-- Optional provider-generated embeddings for semantic retrieval.
-- The JSONB representation keeps local/test installs independent of pgvector;
-- adapters may populate it later through the platform embedding grant.
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding jsonb,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimensions integer,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
ALTER TABLE knowledge_chunks
  DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_shape;
ALTER TABLE knowledge_chunks
  ADD CONSTRAINT knowledge_chunks_embedding_shape CHECK (
    embedding IS NULL OR (
      jsonb_typeof(embedding) = 'array'
      AND embedding_dimensions IS NOT NULL
      AND embedding_dimensions > 0
      AND jsonb_array_length(embedding) = embedding_dimensions
    )
  );
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_ready
  ON knowledge_chunks(workspace_id,version_id)
  WHERE embedding IS NOT NULL AND embedded_at IS NOT NULL;
GRANT UPDATE ON knowledge_chunks TO gotek_app;
