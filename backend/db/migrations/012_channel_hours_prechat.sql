ALTER TABLE channels ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{"enabled":false,"timezone":"Asia/Ho_Chi_Minh","days":[]}'::jsonb;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS prechat jsonb NOT NULL DEFAULT '{"enabled":false,"message":"","fields":[]}'::jsonb;
