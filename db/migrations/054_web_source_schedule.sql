ALTER TABLE web_sources ADD COLUMN refresh_interval_minutes integer CHECK(refresh_interval_minutes BETWEEN 5 AND 10080);
ALTER TABLE web_sources ADD COLUMN next_refresh_at timestamptz;
ALTER TABLE web_sources ADD COLUMN schedule_version integer NOT NULL DEFAULT 1;
CREATE INDEX web_sources_due ON web_sources(workspace_id,next_refresh_at) WHERE refresh_interval_minutes IS NOT NULL AND status='ACTIVE';
