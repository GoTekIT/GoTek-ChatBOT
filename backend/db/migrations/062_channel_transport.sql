ALTER TABLE channels ADD COLUMN transport text NOT NULL DEFAULT 'website'
 CHECK(transport IN ('website','facebook','instagram'));
UPDATE channels c SET transport=m.provider FROM meta_connections m
 WHERE c.id=m.channel_id AND c.workspace_id=m.workspace_id;
DROP POLICY channel_public_lookup ON channels;
CREATE POLICY channel_public_lookup ON channels FOR SELECT
 USING(transport='website' AND public_key=current_setting('app.public_key',true));
