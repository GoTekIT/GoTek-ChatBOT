ALTER TABLE channels ADD COLUMN IF NOT EXISTS assignment_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS assignment_limit integer;
ALTER TABLE channels ADD CONSTRAINT channel_assignment_limit_valid CHECK (assignment_limit IS NULL OR assignment_limit BETWEEN 1 AND 10000);
