CREATE TABLE data_collection_configs(
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id),
 completion_label text NOT NULL CHECK(char_length(completion_label) BETWEEN 1 AND 120),
 destination text NOT NULL DEFAULT 'OFF' CHECK(destination IN ('OFF','GOOGLE_SHEETS','LARK_BITABLE')),
 state text NOT NULL DEFAULT 'MISSING' CHECK(state IN ('MISSING','COLLECTING','COMPLETE')),
 fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(fields)='array'),
 created_by uuid NOT NULL REFERENCES users(id), updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE data_collection_completions(
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), config_id uuid NOT NULL REFERENCES data_collection_configs(id),
 visitor_key text NOT NULL, values jsonb NOT NULL CHECK(jsonb_typeof(values)='object'), completed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,config_id,visitor_key)
);
CREATE TABLE data_collection_outbox(
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), completion_id uuid NOT NULL REFERENCES data_collection_completions(id),
 destination text NOT NULL CHECK(destination IN ('GOOGLE_SHEETS','LARK_BITABLE')), status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RETRY','DELIVERED','FAILED')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), last_error text, next_attempt_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz,
 UNIQUE(completion_id,destination)
);
CREATE TABLE data_collection_mutations(
 workspace_id uuid NOT NULL REFERENCES workspaces(id), request_id uuid NOT NULL, operation text NOT NULL, payload jsonb NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,request_id)
);
ALTER TABLE data_collection_configs ENABLE ROW LEVEL SECURITY; ALTER TABLE data_collection_completions ENABLE ROW LEVEL SECURITY; ALTER TABLE data_collection_outbox ENABLE ROW LEVEL SECURITY; ALTER TABLE data_collection_mutations ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_collection_configs_tenant ON data_collection_configs USING(workspace_id=current_setting('app.workspace_id',true)::uuid) WITH CHECK(workspace_id=current_setting('app.workspace_id',true)::uuid);
CREATE POLICY data_collection_completions_tenant ON data_collection_completions USING(workspace_id=current_setting('app.workspace_id',true)::uuid) WITH CHECK(workspace_id=current_setting('app.workspace_id',true)::uuid);
CREATE POLICY data_collection_outbox_tenant ON data_collection_outbox USING(workspace_id=current_setting('app.workspace_id',true)::uuid) WITH CHECK(workspace_id=current_setting('app.workspace_id',true)::uuid);
CREATE POLICY data_collection_mutations_tenant ON data_collection_mutations USING(workspace_id=current_setting('app.workspace_id',true)::uuid) WITH CHECK(workspace_id=current_setting('app.workspace_id',true)::uuid);
GRANT SELECT,INSERT,UPDATE,DELETE ON data_collection_configs,data_collection_completions,data_collection_outbox,data_collection_mutations TO gotek_app;
