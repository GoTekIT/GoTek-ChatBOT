-- Required for row-level share locks in authorization transactions.
GRANT UPDATE(user_id) ON channel_members TO gotek_app;
