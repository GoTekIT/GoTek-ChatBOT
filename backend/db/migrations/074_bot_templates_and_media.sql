-- Migration 059: Bot Templates (Canned Responses) and Bot Media Assets
-- Supports UC-037 (Multi-step FAQ with allowed media) & UC-038 (Bot templates and media library)

CREATE TABLE IF NOT EXISTS bot_templates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  shortcut text NOT NULL CHECK(char_length(btrim(shortcut)) BETWEEN 1 AND 50),
  title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 150),
  content text NOT NULL CHECK(char_length(btrim(content)) BETWEEN 1 AND 4000),
  category text NOT NULL DEFAULT 'General' CHECK(char_length(btrim(category)) BETWEEN 1 AND 50),
  media_urls text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, id),
  UNIQUE(workspace_id, shortcut)
);

CREATE INDEX IF NOT EXISTS bot_templates_workspace_shortcut ON bot_templates(workspace_id, shortcut);

CREATE TABLE IF NOT EXISTS bot_media_assets (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 150),
  file_url text NOT NULL CHECK(char_length(file_url) BETWEEN 1 AND 2000),
  mime_type text NOT NULL CHECK(mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif')),
  byte_size integer NOT NULL CHECK(byte_size > 0),
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, id)
);

CREATE INDEX IF NOT EXISTS bot_media_assets_workspace_created ON bot_media_assets(workspace_id, created_at DESC);

-- Enable & enforce RLS on both tables
ALTER TABLE bot_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bot_templates_scope ON bot_templates;
CREATE POLICY bot_templates_scope ON bot_templates
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);

ALTER TABLE bot_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_media_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bot_media_assets_scope ON bot_media_assets;
CREATE POLICY bot_media_assets_scope ON bot_media_assets
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_templates TO gotek_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON bot_media_assets TO gotek_app;
