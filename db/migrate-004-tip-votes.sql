-- Tip voting: one row per (tip, voter), vote is +1 (up) or -1 (down).
-- Mirrors review_votes; counts are aggregated at read time.
CREATE TABLE IF NOT EXISTS tip_votes (
  tip_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,        -- user id, or 'anon:<device-id>' for signed-out voters
  vote       INTEGER NOT NULL,        -- 1 = up, -1 = down
  created_at TEXT NOT NULL,
  PRIMARY KEY (tip_id, user_id),
  FOREIGN KEY (tip_id) REFERENCES tips(id)
);
CREATE INDEX IF NOT EXISTS idx_tip_votes_tip ON tip_votes (tip_id);
