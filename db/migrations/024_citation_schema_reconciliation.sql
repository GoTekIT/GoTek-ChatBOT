-- Preserve all legacy rows; do not invent answer IDs or source permissions.
ALTER TABLE active_citations RENAME TO legacy_active_citations;
ALTER TABLE legacy_active_citations RENAME CONSTRAINT active_citations_pkey TO legacy_active_citations_pkey;
REVOKE ALL ON legacy_active_citations FROM gotek_app;
CREATE TABLE active_citation_sources (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 source_key text NOT NULL,
 source_type text NOT NULL CHECK (source_type IN ('KNOWLEDGE','WEB','LARK','FILE')),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
 canonical_url text,
 version text NOT NULL CHECK (char_length(btrim(version)) BETWEEN 1 AND 100),
 audience text NOT NULL DEFAULT 'INTERNAL' CHECK (audience IN ('PUBLIC','INTERNAL')),
 active boolean NOT NULL DEFAULT true,
 revoked_at timestamptz,
 revoked_by uuid REFERENCES users(id),
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,source_key,version)
);
CREATE TABLE active_citation_permissions (
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 source_id uuid NOT NULL REFERENCES active_citation_sources(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 granted_by uuid NOT NULL REFERENCES users(id),
 granted_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 PRIMARY KEY(source_id,user_id)
);
CREATE TABLE active_citations (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 answer_id uuid NOT NULL,
 source_id uuid NOT NULL REFERENCES active_citation_sources(id),
 snippet text NOT NULL CHECK (char_length(btrim(snippet)) BETWEEN 1 AND 2000),
 position integer CHECK(position IS NULL OR position >= 0),
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,answer_id,source_id,position)
);
CREATE INDEX active_citations_answer ON active_citations(workspace_id,answer_id);
ALTER TABLE active_citation_sources ENABLE ROW LEVEL SECURITY; ALTER TABLE active_citation_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY active_citation_sources_scope ON active_citation_sources USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
ALTER TABLE active_citation_permissions ENABLE ROW LEVEL SECURITY; ALTER TABLE active_citation_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY active_citation_permissions_scope ON active_citation_permissions USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
ALTER TABLE active_citations ENABLE ROW LEVEL SECURITY; ALTER TABLE active_citations FORCE ROW LEVEL SECURITY;
CREATE POLICY active_citations_scope ON active_citations USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON active_citation_sources TO gotek_app;
GRANT SELECT,INSERT,UPDATE ON active_citation_permissions TO gotek_app;
GRANT SELECT,INSERT,UPDATE ON active_citations TO gotek_app;
