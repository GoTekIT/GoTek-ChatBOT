-- Provider credentials are encrypted by the application; tokens never leave server-side storage.
CREATE TABLE meta_connections (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 channel_id uuid NOT NULL,
 provider text NOT NULL CHECK(provider IN ('facebook','instagram')),
 asset_id text NOT NULL CHECK(asset_id ~ '^[0-9]+$'),
 asset_name text NOT NULL,
 token_ciphertext text,
 granted_scopes text[] NOT NULL DEFAULT '{}',
 token_expires_at timestamptz,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','reauth_required','disconnected')),
 generation integer NOT NULL DEFAULT 1 CHECK(generation>0),
 connected_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 UNIQUE(workspace_id,channel_id),
 UNIQUE(provider,asset_id),
 FOREIGN KEY(workspace_id,channel_id) REFERENCES channels(workspace_id,id),
 CHECK(status NOT IN ('pending','active') OR token_ciphertext IS NOT NULL),
 CHECK(status <> 'disconnected' OR token_ciphertext IS NULL)
);
-- Global asset uniqueness is deliberate: disconnect does not silently transfer an asset to another tenant.
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_connection_scope ON meta_connections
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON meta_connections TO gotek_app;
