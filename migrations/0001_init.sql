-- Field Guide v2 — community + social schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  google_id TEXT UNIQUE,
  password_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id TEXT,
  game_id TEXT,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 10),
  body TEXT CHECK(length(body) <= 4000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(venue_id IS NOT NULL OR game_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS tips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id TEXT,
  game_id TEXT,
  section TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) <= 500),
  upvotes INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experience_id TEXT NOT NULL,
  game_id TEXT,
  fans_score INTEGER CHECK(fans_score BETWEEN 1 AND 10),
  food_score INTEGER CHECK(food_score BETWEEN 1 AND 10),
  unique_score INTEGER CHECK(unique_score BETWEEN 1 AND 10),
  stadium_score INTEGER CHECK(stadium_score BETWEEN 1 AND 10),
  notes TEXT,
  attended_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, experience_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS pinned_venues (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 4),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_reviews_venue ON reviews(venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_game ON reviews(game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tips_venue ON tips(venue_id, section);
CREATE INDEX IF NOT EXISTS idx_tips_game ON tips(game_id, section);
CREATE INDEX IF NOT EXISTS idx_rankings_user ON rankings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_experience ON rankings(experience_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
