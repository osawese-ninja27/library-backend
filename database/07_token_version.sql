-- Lets the server end old logins: a password reset adds 1 to this number, and any login
-- token carrying an older number stops working. Safe to run more than once.
-- Run as the postgres user:  psql -U postgres -d library -f database/06_token_version.sql
-- Needs 01_schema.sql (users) to have been run first.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- No GRANT needed: library_app already has UPDATE on the users table, and that covers new columns.
