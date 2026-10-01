-- PostgreSQL SELECT FOR UPDATE requires UPDATE privilege on at least one column.
-- Limit that privilege to the identifier; credential/session/expiry fields remain immutable to app role.
GRANT UPDATE(id) ON meta_enrollments TO gotek_app;
