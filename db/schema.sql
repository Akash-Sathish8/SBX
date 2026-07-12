-- SBX system-of-record schema (Cloudflare D1 / SQLite).
-- ESPN is an ingest SOURCE; this DB is the live backend the app queries.
-- Finished games never change (ingest once); live/today games get refreshed.
-- Future UGC tables (reviews, ratings, tips, profiles, attended, bucket_list)
-- will foreign-key to games(league,id) and venues(id).

CREATE TABLE IF NOT EXISTS leagues (
  key       TEXT PRIMARY KEY,          -- 'mlb' | 'nfl' | 'nba'
  label     TEXT NOT NULL,             -- 'MLB'
  sport     TEXT NOT NULL,             -- 'Baseball'
  espn_path TEXT NOT NULL              -- 'baseball/mlb'
);

-- ESPN team ids repeat across leagues, so the key is (league, id).
CREATE TABLE IF NOT EXISTS teams (
  league       TEXT NOT NULL,
  id           TEXT NOT NULL,
  abbr         TEXT,
  location     TEXT,
  name         TEXT,
  display_name TEXT,
  color        TEXT,
  alt_color    TEXT,
  logo         TEXT,
  PRIMARY KEY (league, id)
);

CREATE TABLE IF NOT EXISTS venues (
  id      TEXT PRIMARY KEY,            -- ESPN venue id (globally unique)
  name    TEXT NOT NULL,
  city    TEXT,
  state   TEXT,
  zip     TEXT,
  surface TEXT,                        -- 'grass' | 'turf'
  indoor  INTEGER,                     -- 0/1/NULL
  image   TEXT
);

-- One home team per (league, venue) tenant link — handles shared buildings.
CREATE TABLE IF NOT EXISTS venue_teams (
  venue_id TEXT NOT NULL,
  league   TEXT NOT NULL,
  team_id  TEXT NOT NULL,
  PRIMARY KEY (venue_id, league, team_id)
);

-- ESPN event ids can repeat across leagues, so the key is (league, id).
CREATE TABLE IF NOT EXISTS games (
  league       TEXT NOT NULL,
  id           TEXT NOT NULL,
  date         TEXT NOT NULL,          -- ISO timestamp
  season       INTEGER,
  season_type  INTEGER,                -- 1=pre 2=regular 3=post
  state        TEXT,                   -- 'pre' | 'in' | 'post'
  detail       TEXT,                   -- 'Final', 'Top 5th', '7:05 PM'
  completed    INTEGER,                -- 0/1
  name         TEXT,
  short_name   TEXT,
  venue_id     TEXT,
  venue_name   TEXT,
  venue_city   TEXT,
  venue_state  TEXT,
  home_team_id TEXT, home_abbr TEXT, home_location TEXT, home_name TEXT, home_display TEXT, home_color TEXT, home_logo TEXT, home_score INTEGER, home_winner INTEGER,
  away_team_id TEXT, away_abbr TEXT, away_location TEXT, away_name TEXT, away_display TEXT, away_color TEXT, away_logo TEXT, away_score INTEGER, away_winner INTEGER,
  updated_at   TEXT,
  PRIMARY KEY (league, id)
);

CREATE INDEX IF NOT EXISTS idx_games_date        ON games (date);
CREATE INDEX IF NOT EXISTS idx_games_league_date ON games (league, date);
CREATE INDEX IF NOT EXISTS idx_games_state       ON games (state);
CREATE INDEX IF NOT EXISTS idx_games_venue       ON games (venue_id);
CREATE INDEX IF NOT EXISTS idx_games_home_team   ON games (league, home_team_id);
CREATE INDEX IF NOT EXISTS idx_venue_teams_venue ON venue_teams (venue_id);

-- ---------------------------------------------------------------------------
-- Accounts — Better Auth (email+password via the username plugin, plus Google
-- OAuth). The library owns users/session/account/verification through the
-- drizzle schema in src/server/auth-schema.ts; app code keeps querying `users`
-- directly for profile/UGC joins. Sessions are DB rows referenced by an
-- httpOnly cookie. Better Auth's camelCase field names map onto these
-- snake_case columns; timestamps stay ISO TEXT like the rest of this schema.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,     -- crypto.randomUUID()
  email            TEXT NOT NULL,        -- stored lowercased
  username         TEXT,                 -- normalized (lowercase) public handle; NULL for OAuth users who haven't picked one
  display_username TEXT,                 -- the handle as typed (case preserved for display)
  email_verified   INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,        -- ISO timestamp
  updated_at       TEXT NOT NULL,        -- ISO timestamp
  bio              TEXT,                 -- short profile bio (app-capped ~280 chars)
  avatar           TEXT,                 -- 'data:image/...' (128px webp), 'preset:N', or NULL (initials)
  favorites        TEXT,                 -- JSON array of up to 4 favorite venue ids, e.g. ["3632","43"]
  display_name     TEXT                  -- friendly name shown on the profile; Better Auth's `name` field. username stays the URL handle
);
-- NOTE: bio/avatar/favorites shipped as db/migrate-001-profiles.sql, display_name
-- as db/migrate-002-display-name.sql, and the Better Auth columns/tables as
-- db/migrate-003-better-auth.sql for already-provisioned DBs (a fresh schema.sql
-- run includes everything via the bodies here, but it can't ALTER existing tables).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
-- Case-insensitive uniqueness backstop: "CoolGuy" and "coolguy" can't both exist
-- (Better Auth normalizes to lowercase before insert anyway). NULLs are distinct
-- in SQLite, so OAuth users (no username yet) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username COLLATE NOCASE);

-- Better Auth session/account/verification (see src/server/auth-schema.ts).
CREATE TABLE IF NOT EXISTS session (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires_at TEXT NOT NULL,             -- ISO timestamp
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_token ON session (token);
CREATE INDEX IF NOT EXISTS idx_session_user ON session (user_id);

CREATE TABLE IF NOT EXISTS account (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL,
  account_id               TEXT NOT NULL,  -- provider's user id; equals user_id for 'credential'
  provider_id              TEXT NOT NULL,  -- 'credential' | 'google'
  access_token             TEXT,
  refresh_token            TEXT,
  id_token                 TEXT,
  access_token_expires_at  TEXT,
  refresh_token_expires_at TEXT,
  scope                    TEXT,
  password                 TEXT,           -- "pbkdf2$<iters>$<saltB64>$<hashB64>" for 'credential' (src/server/password.ts)
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_account_user ON account (user_id);
CREATE INDEX IF NOT EXISTS idx_account_provider ON account (provider_id, account_id);

CREATE TABLE IF NOT EXISTS verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification (identifier);

-- One row per (user, game). Denormalized snapshot mirroring MyRank in rank.tsx,
-- so the list renders without re-joining games (which may be re-seeded).
CREATE TABLE IF NOT EXISTS user_rankings (
  user_id    TEXT NOT NULL,
  game_id    TEXT NOT NULL,
  league     TEXT NOT NULL,
  away       TEXT NOT NULL,
  home       TEXT NOT NULL,
  away_logo  TEXT,
  home_logo  TEXT,
  date       TEXT NOT NULL,
  venue      TEXT NOT NULL,
  city       TEXT,
  fans       REAL NOT NULL,
  food       REAL NOT NULL,
  unique_    REAL NOT NULL,              -- `unique` is a SQL keyword
  stadium    REAL NOT NULL,
  score      REAL NOT NULL,
  ts         INTEGER NOT NULL,           -- MyRank.ts (ms) — merge tie-break
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_user_rankings_user ON user_rankings (user_id);

-- Crowdsourced "what to know" tips (WhatToKnow.tsx). One row per submission,
-- scoped to a venue id or 'league:gameId' (ESPN event ids repeat across leagues).
-- Real fan input only — never seeded with fabricated content.
CREATE TABLE IF NOT EXISTS tips (
  id         TEXT PRIMARY KEY,        -- crypto.randomUUID()
  scope      TEXT NOT NULL,           -- 'venue' | 'event'
  target_id  TEXT NOT NULL,           -- venue id, or 'league:gameId'
  section    TEXT NOT NULL,           -- 'getting-there' | 'best-seats' | 'food' | ...
  user_id    TEXT NOT NULL,
  author     TEXT NOT NULL,           -- display name snapshot (email local-part)
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tips_target ON tips (scope, target_id);

-- Tip voting: one row per (tip, voter), vote is +1 (up) or -1 (down).
-- Mirrors review_votes; counts are aggregated at read time.
CREATE TABLE IF NOT EXISTS tip_votes (
  tip_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,           -- user id, or 'anon:<device-id>' for signed-out voters
  vote       INTEGER NOT NULL,        -- 1 = up, -1 = down
  created_at TEXT NOT NULL,
  PRIMARY KEY (tip_id, user_id),
  FOREIGN KEY (tip_id) REFERENCES tips(id)
);
CREATE INDEX IF NOT EXISTS idx_tip_votes_tip ON tip_votes (tip_id);

-- Extensive fan reviews of a gameday experience (longer than a tip). Scoped to a
-- venue id (or 'league:gameId'), optionally tied to the game attended. Real fan
-- input only — never seeded with fabricated content.
CREATE TABLE IF NOT EXISTS reviews (
  id         TEXT PRIMARY KEY,        -- crypto.randomUUID()
  scope      TEXT NOT NULL,           -- 'venue' | 'event'
  target_id  TEXT NOT NULL,           -- venue id, or 'league:gameId'
  game_id    TEXT,                    -- optional: the game the review is about
  user_id    TEXT NOT NULL,
  author     TEXT NOT NULL,           -- username (or email local-part) snapshot
  rating     INTEGER,                 -- optional overall 1-10
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews (scope, target_id);

-- Review voting: one row per (review, voter), vote is +1 (up) or -1 (down).
-- Toggling a vote off deletes the row; counts are aggregated at read time.
CREATE TABLE IF NOT EXISTS review_votes (
  review_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,           -- user id, or 'anon:<device-id>' for signed-out voters
  vote       INTEGER NOT NULL,        -- 1 = up, -1 = down
  created_at TEXT NOT NULL,
  PRIMARY KEY (review_id, user_id),
  FOREIGN KEY (review_id) REFERENCES reviews(id)
);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes (review_id);

-- Snapback editorial "expert notes" — curated insider knowledge extracted from
-- first-party sources (e.g. transcripts of games the team actually attended).
-- NOT user UGC: there is deliberately no users FK. Every note keeps source_url +
-- source_quote so the claim stays checkable (honours the no-fabricated-data rule).
-- scope/target mirror `tips` so notes render in the same WhatToKnow sections AND
-- ground the AI assistant. Written by scripts/build-expert-notes.mjs.
CREATE TABLE IF NOT EXISTS expert_notes (
  id           TEXT PRIMARY KEY,        -- deterministic hash of target+section+body
  scope        TEXT NOT NULL,           -- 'venue' | 'event'
  target_id    TEXT NOT NULL,           -- venue id, or 'league:gameId'
  section      TEXT NOT NULL,           -- WhatToKnow section key (getting-there, food, …)
  body         TEXT NOT NULL,
  source_url   TEXT,                    -- the video/page the note came from
  source_quote TEXT,                    -- verbatim line that supports the note
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expert_notes_target ON expert_notes (scope, target_id);

-- Per-user hourly rate-limit counter for the AI assistant — bounds model spend and
-- abuse. One row per (user, hour bucket like '2026-06-21T18'). In-memory counters
-- don't survive across Worker isolates, so the limit lives in D1.
CREATE TABLE IF NOT EXISTS assistant_usage (
  user_id TEXT NOT NULL,
  bucket  TEXT NOT NULL,                -- ISO hour, e.g. '2026-06-21T18'
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);

-- NCAA D1 conferences + member schools (college-football [FBS] / college-basketball).
-- College teams live in the `teams` table (league = the college key); these two
-- tables register the conferences and link members (join-table like venue_teams).
CREATE TABLE IF NOT EXISTS conferences (
  league     TEXT NOT NULL,            -- 'college-football' | 'college-basketball'
  id         TEXT NOT NULL,            -- ESPN group id
  name       TEXT NOT NULL,            -- 'Southeastern Conference'
  short_name TEXT,                     -- 'SEC'
  sort       INTEGER,                  -- display order
  PRIMARY KEY (league, id)
);
CREATE TABLE IF NOT EXISTS conference_teams (
  league        TEXT NOT NULL,
  conference_id TEXT NOT NULL,
  team_id       TEXT NOT NULL,
  PRIMARY KEY (league, conference_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_conf_teams ON conference_teams (league, conference_id);

-- ---------------------------------------------------------------------------
-- Social graph (Letterboxd-style follows). follower_id follows followee_id.
-- The PK dedupes + answers "who do I follow" / isFollowing (left-prefix); the
-- index answers "who follows me" / follower counts. Self-follows blocked in API.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,            -- the user doing the following
  followee_id TEXT NOT NULL,            -- the user being followed
  created_at  TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (followee_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee_id);
