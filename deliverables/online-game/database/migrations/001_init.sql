-- Hearthbound Online — initial schema (PostgreSQL 16). Durable source of truth for accounts, characters, wallets, ledger, market, social, PvP, ops.
-- Money is stored as NUMERIC(38,0) integer minor units (no floating point).
CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL DEFAULT 'asia', status TEXT NOT NULL DEFAULT 'online', capacity INT NOT NULL DEFAULT 1000, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','moderator','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned','deleted')), ban_reason TEXT, consent_terms_at TIMESTAMPTZ,
  failed_logins INT NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS account_sessions (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, refresh_hash TEXT NOT NULL UNIQUE, user_agent TEXT, ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, replaced_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON account_sessions(account_id);
CREATE TABLE IF NOT EXISTS login_history (id BIGSERIAL PRIMARY KEY, account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE, username TEXT, ok BOOLEAN NOT NULL, ip TEXT, at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, world_id TEXT NOT NULL REFERENCES worlds(id), name TEXT NOT NULL,
  class_id TEXT NOT NULL, level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 120), map_id TEXT NOT NULL DEFAULT 'emberglen', state JSONB NOT NULL, state_version INT NOT NULL DEFAULT 1,
  combat_power INT NOT NULL DEFAULT 0, pvp_rating INT NOT NULL DEFAULT 1000, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_character_name_world ON characters(world_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_characters_account ON characters(account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_characters_level ON characters(world_id, level DESC);

-- double-entry ledger: per (account,currency) snapshot + immutable entries; system:* accounts are mint/burn
CREATE TABLE IF NOT EXISTS wallets (account TEXT NOT NULL, currency TEXT NOT NULL, available NUMERIC(38,0) NOT NULL DEFAULT 0, reserved NUMERIC(38,0) NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (account, currency),
  CONSTRAINT wallet_nonneg CHECK (account LIKE 'system:%' OR (available >= 0 AND reserved >= 0)));
CREATE TABLE IF NOT EXISTS currency_ledger (id BIGSERIAL PRIMARY KEY, tx_id TEXT NOT NULL, account TEXT NOT NULL, currency TEXT NOT NULL, amount NUMERIC(38,0) NOT NULL, reason TEXT NOT NULL, world_id TEXT NOT NULL DEFAULT 'w1', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_entry ON currency_ledger(tx_id, account, currency);
CREATE INDEX IF NOT EXISTS idx_ledger_tx ON currency_ledger(tx_id);

CREATE TABLE IF NOT EXISTS market_state (world_id TEXT PRIMARY KEY REFERENCES worlds(id), data JSONB NOT NULL, version BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS market_transactions (id BIGSERIAL PRIMARY KEY, world_id TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT NOT NULL, buyer TEXT, seller TEXT, item_def TEXT, qty INT, price NUMERIC(38,0), fee NUMERIC(38,0), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_market_tx ON market_transactions(kind, ref_id);
CREATE TABLE IF NOT EXISTS trade_history (id TEXT PRIMARY KEY, a_char TEXT NOT NULL, b_char TEXT NOT NULL, a_items JSONB NOT NULL, b_items JSONB NOT NULL, a_gold NUMERIC(38,0) NOT NULL, b_gold NUMERIC(38,0) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS guilds (id TEXT PRIMARY KEY, world_id TEXT NOT NULL REFERENCES worlds(id), name TEXT NOT NULL, level INT NOT NULL DEFAULT 1, exp BIGINT NOT NULL DEFAULT 0, announcement TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_guild_name ON guilds(world_id, lower(name));
CREATE TABLE IF NOT EXISTS guild_members (guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE, character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('leader','officer','member')), contribution BIGINT NOT NULL DEFAULT 0, joined_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (guild_id, character_id));
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_guild_per_char ON guild_members(character_id);
CREATE TABLE IF NOT EXISTS guild_logs (id BIGSERIAL PRIMARY KEY, guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE, msg TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS pvp_matches (id TEXT PRIMARY KEY, world_id TEXT NOT NULL, mode TEXT NOT NULL, team_a JSONB NOT NULL, team_b JSONB NOT NULL, winner INT, rating_delta JSONB, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS chat_messages (id BIGSERIAL PRIMARY KEY, world_id TEXT NOT NULL, channel TEXT NOT NULL, from_char TEXT, to_char TEXT, body TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_chat_at ON chat_messages(at);

CREATE TABLE IF NOT EXISTS player_reports (id TEXT PRIMARY KEY, reporter TEXT NOT NULL, target_name TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS moderation_actions (id BIGSERIAL PRIMARY KEY, account_id TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL, actor TEXT NOT NULL, expires_at TIMESTAMPTZ, at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS admin_audit_logs (id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT, reason TEXT, before JSONB, after JSONB, request_id TEXT, at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS game_logs (id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, character_id TEXT, data JSONB, at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS security_events (id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, account_id TEXT, detail JSONB, at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS feature_flags (key TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS configuration_versions (version TEXT PRIMARY KEY, data JSONB NOT NULL, published_by TEXT, published_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS scheduled_jobs (job_key TEXT PRIMARY KEY, kind TEXT NOT NULL, period TEXT NOT NULL, status TEXT NOT NULL, result JSONB, ran_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS idempotency_keys (key TEXT PRIMARY KEY, response JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS outbox_events (id BIGSERIAL PRIMARY KEY, topic TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), published_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS payment_orders (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), product TEXT NOT NULL, amount_minor BIGINT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'created', provider_event_id TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
