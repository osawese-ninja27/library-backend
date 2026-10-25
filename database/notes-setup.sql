-- Notes: one private note per user per book.
-- Run once, as the database owner (postgres). Safe to run again: it skips what already exists.

CREATE TABLE IF NOT EXISTS notes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_note_per_book UNIQUE (user_id, book_id),
  CONSTRAINT note_not_too_long CHECK (char_length(content) <= 5000)
);

-- Makes "my notes, newest first" fast even when someone has many notes.
CREATE INDEX IF NOT EXISTS notes_user_created_idx ON notes (user_id, created_at DESC);

-- Let the app's database role use the table (library_app is the role from your .env).
GRANT SELECT, INSERT, UPDATE, DELETE ON notes TO library_app;
GRANT USAGE, SELECT ON SEQUENCE notes_id_seq TO library_app;
