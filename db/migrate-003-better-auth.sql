-- Migration 003: hand-rolled auth -> Better Auth (for already-provisioned DBs;
-- a fresh schema.sql run already includes all of this).
-- Apply: wrangler d1 execute DB --local  --file db/migrate-003-better-auth.sql
--        wrangler d1 execute DB --remote --file db/migrate-003-better-auth.sql
--
-- What changes:
--  * users grows Better Auth's core columns (email_verified, updated_at) and
--    the username plugin's display_username. `username` becomes the normalized
--    lowercase handle; display_username keeps the casing the fan typed.
--  * password hashes move to Better Auth's `account` table (providerId
--    'credential'); the pbkdf2 format is unchanged, so nobody resets a password.
--  * legacy Google users ('oauth:google' sentinel, no stored Google id) get NO
--    account row — their next Google sign-in links to the existing users row by
--    verified email (account.accountLinking.trustedProviders in better-auth.ts).
--  * sessions move from stateless JWTs to DB rows: everyone is signed out once.

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN updated_at TEXT;
ALTER TABLE users ADD COLUMN display_username TEXT;

UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE users SET display_username = username WHERE username IS NOT NULL;
UPDATE users SET username = lower(username) WHERE username IS NOT NULL;
-- Google verified these emails when the account was created.
UPDATE users SET email_verified = 1 WHERE password_hash = 'oauth:google';

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
  password                 TEXT,           -- "pbkdf2$<iters>$<saltB64>$<hashB64>" for 'credential'
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

-- Move password hashes into credential account rows, then retire the column.
INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
SELECT lower(hex(randomblob(16))), id, id, 'credential', password_hash, created_at, created_at
FROM users
WHERE password_hash LIKE 'pbkdf2$%';

ALTER TABLE users DROP COLUMN password_hash;
