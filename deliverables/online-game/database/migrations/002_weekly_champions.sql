-- Weekly champion (LiveOps §47/§54): written once per ISO week by the worker; the game server grants title_weekly to that character.
CREATE TABLE IF NOT EXISTS weekly_champions (
  week TEXT NOT NULL,
  kind TEXT NOT NULL,
  character_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value BIGINT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (week, kind)
);
