-- Adds the author column to books. Safe to run more than once.
-- Run as the database owner (postgres), then re-grant if needed:
--   psql -U postgres -d library -f database/02_add_book_author.sql
ALTER TABLE books ADD COLUMN IF NOT EXISTS author TEXT;
