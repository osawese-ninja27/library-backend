const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// How the app finds the database:
//   Hosted (Supabase, Neon, ...): set ONE value, DATABASE_URL, in the hosting service's settings.
//   Local: leave DATABASE_URL out and use the separate DB_USER / DB_PASSWORD / DB_HOST / DB_PORT / DB_NAME in .env.
const hostedUrl = process.env.DATABASE_URL;

const config = hostedUrl
  ? { connectionString: hostedUrl }
  : {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
    };

// Hosted databases only accept encrypted connections; a local Postgres usually has no SSL.
// DB_SSL=true / DB_SSL=false overrides this guess if you ever need to.
// (Do not put ?sslmode=require in DATABASE_URL: it would override this setting and fail certificate checks.)
const useSsl = process.env.DB_SSL ? process.env.DB_SSL === 'true' : Boolean(hostedUrl);
if (useSsl) {
  const caPath = path.join(__dirname, 'certs', 'supabase-ca.crt');
  if (fs.existsSync(caPath)) {
    config.ssl = { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  } else {
    console.warn('Supabase CA file not found; connecting without certificate verification.');
    config.ssl = { rejectUnauthorized: false };
  }
}
// How many connections this server keeps open. On serverless hosting every instance has its own
// pool, so set DB_POOL_MAX=3 (or similar) there to avoid using up the database's connection limit.
config.max = Number(process.env.DB_POOL_MAX) || 10;
config.connectionTimeoutMillis = 5000; // fail fast if the database can't be reached

// A hosted database can drop an idle connection. Without this handler that would crash the server.
const pool = new Pool(config);


pool.on('error', (err) => {
  console.error('Unexpected database connection error:', err.message);
});

module.exports = pool;
