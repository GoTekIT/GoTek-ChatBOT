CREATE INDEX jobs_web_refresh_source_active ON jobs(workspace_id,(payload->>'sourceId'))
 WHERE kind='web.refresh' AND state IN ('queued','retry','running');
