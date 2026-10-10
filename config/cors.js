const cors = require('cors');

// Websites allowed to call this API. Set ALLOWED_ORIGINS in .env as a comma-separated list,
// e.g. ALLOWED_ORIGINS=https://my-library.vercel.app,http://localhost:5173
const DEFAULT_ORIGINS = ['http://localhost:5173'];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

module.exports = cors({
  origin(origin, callback) {
    // Requests with no Origin header (Postman, curl, server-to-server) are allowed.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
});
