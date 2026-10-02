-- Retain only pagination URLs and participant identifiers/names, never credentials.
-- Both levels advance in the same transaction as their imported messages.
ALTER TABLE meta_history_sync ADD COLUMN pending_threads jsonb NOT NULL DEFAULT '[]'::jsonb
 CHECK (jsonb_typeof(pending_threads)='array');
