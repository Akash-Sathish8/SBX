-- Game-based personal diary (Letterboxd-style: log games you attended + rate them)
CREATE TABLE IF NOT EXISTS game_rankings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  away TEXT NOT NULL,
  home TEXT NOT NULL,
  away_logo TEXT,
  home_logo TEXT,
  game_date TEXT NOT NULL,
  venue TEXT NOT NULL,
  city TEXT,
  fans REAL NOT NULL CHECK(fans BETWEEN 1 AND 10),
  food REAL NOT NULL CHECK(food BETWEEN 1 AND 10),
  unique_val REAL NOT NULL CHECK(unique_val BETWEEN 1 AND 10),
  stadium REAL NOT NULL CHECK(stadium BETWEEN 1 AND 10),
  score REAL NOT NULL,
  ts INTEGER NOT NULL,
  UNIQUE(user_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_game_rankings_user ON game_rankings(user_id, ts DESC);
