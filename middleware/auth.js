const jwt = require('jsonwebtoken');
const pool = require('../db');

// Checks the login token, then checks it against the database. Attaches { id, role } to req.user.
//
// A token is only a signed pass: on its own it stays valid until it expires, even after the
// account is blocked, deleted or has a new password. So after the signature check we look the
// user up and reject the token when:
//   - the account no longer exists,
//   - the account is blocked, or
//   - the token_version inside the token is older than the one in the database
//     (the number goes up every time an admin resets that user's password).
// The role also comes from the database, so a changed role takes effect straight away.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
    const result = await pool.query(
      'SELECT role, is_blocked, token_version FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = result.rows[0];

    // Tokens issued before token_version existed carry no "tv", so they count as version 0.
    const tokenVersion = decoded.tv ?? 0;

    if (!user || user.is_blocked || user.token_version !== tokenVersion) {
      return res.status(401).json({ error: 'Your session has ended. Please log in again.' });
    }

    req.user = { id: decoded.id, role: user.role };
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong checking your login.' });
  }
}

// Must run AFTER requireAuth — checks the role.
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
