-- Borrowing: copies per book + the borrowings table. Safe to run more than once.
-- Run as the postgres user:  psql -U postgres -d library -f database/05_borrowings.sql
-- Needs 01_schema.sql (users, books) to have been run first.

-- 1) How many physical copies of each book the library owns. Existing books get 2.
--    "Available" is never stored: it is worked out from this number and the borrowings table.
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS total_copies INTEGER NOT NULL DEFAULT 2 CHECK (total_copies >= 0);

-- 2) One row per request. A row moves through these statuses:
--      pending  -> borrowed -> returned
--      pending  -> rejected      (librarian says no)
--      pending  -> expired       (nobody collected the book within the 24-hour hold)
CREATE TABLE IF NOT EXISTS borrowings (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- RESTRICT: a book that has borrowing records cannot be deleted (it would erase history).
  book_id      INTEGER     NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'borrowed', 'returned', 'rejected', 'expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,   -- requested_at + 24 hours: the end of the hold
  approved_at  TIMESTAMPTZ,            -- when the librarian handed the book over (timer starts)
  due_date     TIMESTAMPTZ,            -- approved_at + 30 days
  returned_at  TIMESTAMPTZ             -- when the librarian marked it returned (timer stops)
);

-- 3) Rules the database enforces by itself, even if the code has a bug or a user double-clicks.

-- A user can have only ONE live thing at a time: one pending request OR one borrowed book.
CREATE UNIQUE INDEX IF NOT EXISTS one_live_per_user
  ON borrowings (user_id)
  WHERE status IN ('pending', 'borrowed');

-- A user can never take the same book twice (rejected and expired requests do not count).
CREATE UNIQUE INDEX IF NOT EXISTS one_time_per_book
  ON borrowings (user_id, book_id)
  WHERE status IN ('pending', 'borrowed', 'returned');

-- 4) Indexes that keep things fast when there are many rows.
CREATE INDEX IF NOT EXISTS borrowings_book_status_idx ON borrowings (book_id, status);          -- counting copies in use
CREATE INDEX IF NOT EXISTS borrowings_status_requested_idx ON borrowings (status, requested_at); -- admin tabs
CREATE INDEX IF NOT EXISTS borrowings_user_requested_idx ON borrowings (user_id, requested_at DESC); -- "my borrowings"

-- 5) The app connects as library_app. It reads, creates and updates borrowings, never deletes them.
GRANT SELECT, INSERT, UPDATE ON borrowings TO library_app;
GRANT USAGE, SELECT ON SEQUENCE borrowings_id_seq TO library_app;
