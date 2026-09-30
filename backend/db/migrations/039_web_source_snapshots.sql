ALTER TABLE web_sources ADD CONSTRAINT web_sources_workspace_id_unique UNIQUE(workspace_id,id);
ALTER TABLE jobs ADD CONSTRAINT jobs_workspace_id_unique UNIQUE(workspace_id,id);
CREATE TABLE web_source_snapshots(
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 source_id uuid NOT NULL,
 job_id uuid NOT NULL,
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,source_id) REFERENCES web_sources(workspace_id,id),
 FOREIGN KEY(workspace_id,job_id) REFERENCES jobs(workspace_id,id),
 UNIQUE(workspace_id,job_id)
);
CREATE INDEX web_snapshot_source_history ON web_source_snapshots(workspace_id,source_id,created_at DESC,id DESC);
ALTER TABLE web_source_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_source_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY web_snapshot_scope ON web_source_snapshots
 USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid)
 WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
GRANT SELECT,INSERT ON web_source_snapshots TO gotek_app;
