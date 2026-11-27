-- Sanction appeals (moderation §63) and character rename cooldown.
CREATE TABLE IF NOT EXISTS appeals (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  resolver TEXT, resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_open_appeal ON appeals(account_id) WHERE status = 'open';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS renamed_at TIMESTAMPTZ;
