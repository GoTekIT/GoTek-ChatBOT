CREATE TABLE knowledge_categories(
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 100 AND name=btrim(name)),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id)
);
CREATE UNIQUE INDEX knowledge_category_name ON knowledge_categories(workspace_id,lower(name));
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_categories_scope ON knowledge_categories USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT ON knowledge_categories TO gotek_app;
ALTER TABLE knowledge_items ADD COLUMN category_id uuid;
ALTER TABLE knowledge_items ADD FOREIGN KEY(workspace_id,category_id) REFERENCES knowledge_categories(workspace_id,id);
