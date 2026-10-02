-- Recreate policies safely for databases where an older partial migration
-- already created these names. Existing migration files remain immutable.
DROP POLICY IF EXISTS bot_templates_scope ON bot_templates;
CREATE POLICY bot_templates_scope ON bot_templates
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS bot_media_assets_scope ON bot_media_assets;
CREATE POLICY bot_media_assets_scope ON bot_media_assets
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
