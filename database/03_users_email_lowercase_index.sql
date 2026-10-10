-- Makes email uniqueness ignore upper/lower case, matching how the app now stores emails.
-- If this fails with "could not create unique index", two accounts share an email that differs
-- only by case. Find them with:
--   SELECT LOWER(email), COUNT(*) FROM users GROUP BY 1 HAVING COUNT(*) > 1;
-- Run as the postgres user:  psql -U postgres -d library -f database/03_users_email_lowercase_index.sql
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));
