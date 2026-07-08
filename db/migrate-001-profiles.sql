-- Migration 001 — Letterboxd-style profiles + social graph.
-- Run ONCE against an already-provisioned DB (local or remote). A fresh
-- db/schema.sql run already includes these (users columns + follows table),
-- but SQLite's `CREATE TABLE IF NOT EXISTS` will NOT add columns to an existing
-- users table, and `ADD COLUMN` errors if the column already exists — so this
-- is a separate, run-once file, not part of the idempotent schema path.

-- Profile fields on the existing users table.
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar TEXT;
ALTER TABLE users ADD COLUMN favorites TEXT;

-- Social graph (idempotent — safe even if re-run).
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (followee_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee_id);
