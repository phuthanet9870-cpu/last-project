-- Admin MFA (TOTP): encrypted secret, pending enrolment, replay protection; sessions remember whether MFA was verified.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mfa_pending TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mfa_last_step BIGINT NOT NULL DEFAULT 0;
ALTER TABLE account_sessions ADD COLUMN IF NOT EXISTS mfa BOOLEAN NOT NULL DEFAULT false;
