CREATE TABLE channels(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES workspaces(id),name text NOT NULL,origin text NOT NULL,greeting text NOT NULL,color text NOT NULL,public_key text NOT NULL UNIQUE,enabled boolean NOT NULL DEFAULT true,request_id uuid NOT NULL,request_payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id),UNIQUE(workspace_id,request_id));
CREATE TABLE channel_members(workspace_id uuid NOT NULL,channel_id uuid NOT NULL,user_id uuid NOT NULL,PRIMARY KEY(workspace_id,channel_id,user_id),FOREIGN KEY(workspace_id,channel_id) REFERENCES channels(workspace_id,id),FOREIGN KEY(workspace_id,user_id) REFERENCES memberships(workspace_id,user_id));
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;ALTER TABLE channels FORCE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;ALTER TABLE channel_members FORCE ROW LEVEL SECURITY;
CREATE POLICY channel_scope ON channels USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
CREATE POLICY channel_member_scope ON channel_members USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON channels TO gotek_app;
GRANT SELECT,INSERT,DELETE ON channel_members TO gotek_app;
