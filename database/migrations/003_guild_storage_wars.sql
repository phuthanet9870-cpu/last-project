-- Shared guild storage (one row per stored item stack) and guild war records.
CREATE TABLE IF NOT EXISTS guild_storage (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  item JSONB NOT NULL,
  deposited_by TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_guild_storage_guild ON guild_storage(guild_id);
CREATE TABLE IF NOT EXISTS guild_wars (
  id TEXT PRIMARY KEY,
  guild_a TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  guild_b TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  winner TEXT,
  score JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
