// Migration runner.
// Runs every numbered .sql file in this folder, in order, exactly once, and remembers which ones
// ran in a table called schema_migrations. Run it from the project root:
//   npm run migrate          -> apply anything new
//   npm run migrate:status   -> only show what has / has not been applied
//
// It must connect as the database OWNER (it creates tables), not as library_app.
// Set MIGRATE_DATABASE_URL (hosted) or MIGRATE_DB_USER + MIGRATE_DB_PASSWORD (local) in .env.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function connectionConfig() {
  const url = process.env.MIGRATE_DATABASE_URL;
  const config = url
    ? { connectionString: url }
    : {
        user: process.env.MIGRATE_DB_USER,
        password: process.env.MIGRATE_DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
      };

  if (!url && !config.user) {
    console.error('Set MIGRATE_DATABASE_URL, or MIGRATE_DB_USER and MIGRATE_DB_PASSWORD, in .env first.');
    process.exit(1);
  }

  // Same SSL rule as db.js: hosted (URL) = encrypted, local = plain unless DB_SSL says otherwise.
  const useSsl = process.env.DB_SSL ? process.env.DB_SSL === 'true' : Boolean(url);
  if (useSsl) config.ssl = { rejectUnauthorized: false };
  return config;
}

// Shown before anything runs, so you can see you are pointing at the database you meant to.
function describeTarget(config) {
  if (config.connectionString) {
    const u = new URL(config.connectionString);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  }
  return `${config.host}:${config.port || 5432}/${config.database}`;
}

async function main() {
  const statusOnly = process.argv.includes('--status');
  const config = connectionConfig();

  const files = fs
    .readdirSync(__dirname)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort(); // 01_..., 02_..., so the zero-padded number decides the order

  const client = new Client(config);
  await client.connect();
  console.log(`Database: ${describeTarget(config)}`);

  try {
    // Only one runner at a time (two people or two terminals can't collide).
    await client.query('SELECT pg_advisory_lock(727274)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    // On Supabase every table in "public" is reachable through its public REST API.
    // RLS with no policy keeps this bookkeeping table closed to that API.
    await client.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    for (const f of files) {
      console.log(`  ${applied.has(f) ? 'applied ' : 'PENDING '} ${f}`);
    }
    if (statusOnly) return;
    if (pending.length === 0) {
      console.log('Nothing to do: the database is up to date.');
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      try {
        // One transaction per file: it either fully applies and is recorded, or nothing changes.
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\nFAILED on ${file}: ${err.message}`);
        if (/library_app/.test(err.message)) {
          console.error('Hint: create the library_app role first (see database/README.md).');
        }
        process.exitCode = 1;
        return; // stop: later files may depend on this one
      }
    }
    console.log('Done.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Could not run migrations:', err.message);
  process.exit(1);
});
