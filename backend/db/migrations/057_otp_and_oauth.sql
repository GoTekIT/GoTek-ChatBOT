-- Migration 057: Support OTP challenges and OAuth identities
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_kind_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_kind_check CHECK (kind IN ('verify', 'reset', 'otp', 'login_otp'));

CREATE TABLE IF NOT EXISTS oauth_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS oauth_identities_user_id ON oauth_identities(user_id);
CREATE INDEX IF NOT EXISTS oauth_identities_email ON oauth_identities(email);

GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_identities TO gotek_app;
