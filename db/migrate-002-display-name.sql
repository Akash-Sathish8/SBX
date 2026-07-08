-- Migration 002 — friendly display name on profiles.
-- Run ONCE against an already-provisioned DB (local or remote). Fresh schema.sql
-- runs already include this column via the CREATE TABLE users body.
-- The username stays the unique URL handle (/u/<username>); display_name is the
-- readable name shown on the profile header (e.g. "Jack Settleman").
ALTER TABLE users ADD COLUMN display_name TEXT;
