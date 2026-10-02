-- Keep the existing Meta connection table forward-compatible with the other
-- Meta surfaces. Threads remains catalog-only until an approved messaging API
-- is available; this constraint only validates connector identifiers.
ALTER TABLE meta_connections
  ADD CONSTRAINT meta_connections_channel_kind_ck
  CHECK (channel_kind IN ('facebook_messenger','instagram_messaging','whatsapp_business','threads'));
