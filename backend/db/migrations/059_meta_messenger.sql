CREATE TABLE meta_connections(
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 channel_id uuid NOT NULL,
 provider text NOT NULL DEFAULT 'meta',
 channel_kind text NOT NULL DEFAULT 'facebook_messenger',
 external_page_id text NOT NULL,
 page_name text NOT NULL,
 page_access_token_ref text NOT NULL,
 status text NOT NULL DEFAULT 'connected' CHECK(status IN ('pending','connected','disconnected','reauth_required','error')),
 scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
 last_verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id, external_page_id),
 FOREIGN KEY(workspace_id, channel_id) REFERENCES channels(workspace_id,id)
);
CREATE TABLE meta_events(
 id uuid PRIMARY KEY,
 connection_id uuid NOT NULL REFERENCES meta_connections(id),
 external_event_id text NOT NULL,
 event_kind text NOT NULL,
 payload jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE(connection_id, external_event_id, event_kind)
);
CREATE TABLE meta_identities(
 id uuid PRIMARY KEY,
 connection_id uuid NOT NULL REFERENCES meta_connections(id),
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 external_user_id text NOT NULL,
 profile jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id, external_user_id)
);
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY; ALTER TABLE meta_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE meta_events ENABLE ROW LEVEL SECURITY; ALTER TABLE meta_events FORCE ROW LEVEL SECURITY;
ALTER TABLE meta_identities ENABLE ROW LEVEL SECURITY; ALTER TABLE meta_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY meta_connections_scope ON meta_connections USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
CREATE POLICY meta_events_scope ON meta_events USING(EXISTS(SELECT 1 FROM meta_connections c WHERE c.id=meta_events.connection_id AND c.workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)) WITH CHECK(EXISTS(SELECT 1 FROM meta_connections c WHERE c.id=meta_events.connection_id AND c.workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid));
CREATE POLICY meta_identities_scope ON meta_identities USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON meta_connections,meta_events,meta_identities TO gotek_app;
