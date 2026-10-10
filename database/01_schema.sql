-- Reference schema for the library app (matches what the routes query).
-- For a NEW empty database only. If your tables already exist, skip this file.
-- Run as the postgres user:  psql -U postgres -d library -f database/01_schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  surname       TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  middle_name   TEXT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_blocked    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS books (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  author          TEXT,
  description     TEXT,
  genre           TEXT,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  cover_image_url TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- The app connects as library_app, which can read and write data but not change tables.
-- Create it first if needed:  CREATE ROLE library_app LOGIN PASSWORD 'choose-a-strong-password';
GRANT CONNECT ON DATABASE library TO library_app;
GRANT USAGE ON SCHEMA public TO library_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO library_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO library_app;
