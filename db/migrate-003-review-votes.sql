-- Review voting: one row per (review, voter), vote is +1 (up) or -1 (down).
-- Toggling a vote off deletes the row; counts are aggregated at read time.
CREATE TABLE IF NOT EXISTS review_votes (
  review_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,        -- user id, or 'anon:<device-id>' for signed-out voters
  vote       INTEGER NOT NULL,        -- 1 = up, -1 = down
  created_at TEXT NOT NULL,
  PRIMARY KEY (review_id, user_id),
  FOREIGN KEY (review_id) REFERENCES reviews(id)
);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes (review_id);
