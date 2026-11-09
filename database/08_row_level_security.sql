-- Row Level Security (RLS) on every table.
--
-- Why: Supabase automatically publishes every table in "public" through a REST API that anyone with
-- the project's public (anon) key can call. With RLS ON and no policy for a role, that role sees
-- nothing, so the public API is shut. Your Express server is unaffected: it connects as library_app,
-- and the policy below gives that one role full access (its table GRANTs still decide what it may do,
-- for example it can never DELETE from borrowings). The owner (postgres) bypasses RLS, so this
-- migration runner and pg_dump keep working.
--
-- Needs the library_app role to exist first. Safe to run more than once.
-- When you add a NEW table later, add it to the list below in a new numbered file.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'library_app') THEN
    RAISE EXCEPTION 'Role library_app does not exist. Create it first (see database/README.md).';
  END IF;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'categories', 'books', 'favorites', 'notes', 'borrowings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS library_app_full_access ON %I', t);
    EXECUTE format(
      'CREATE POLICY library_app_full_access ON %I FOR ALL TO library_app USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
