-- Favourite books: one row per (user, book). Safe to run more than once.
-- Deleting a user or a book automatically removes their favourite rows.
-- Run as the postgres user:  psql -U postgres -d library -f database/04_favorites.sql

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id    INTEGER   NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

-- The primary key already covers lookups by user; this covers deleting a book.
CREATE INDEX IF NOT EXISTS favorites_book_id_idx ON favorites (book_id);

-- The app connects as library_app: it needs to read, add and remove favourites.
GRANT SELECT, INSERT, DELETE ON favorites TO library_app;
