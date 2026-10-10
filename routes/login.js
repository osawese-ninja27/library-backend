const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { loginLimiter } = require('../middleware/rateLimit');
const { normalizeEmail } = require('../utils/validators');

const router = express.Router();

// Used when the email doesn't exist, so a wrong email and a wrong password take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Log a user in and return a token. Mounted at /api/login.
router.post('/', loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!email || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, surname, first_name, email, password_hash, role, is_blocked
       FROM users WHERE LOWER(email) = $1`,
      [email]
    );

    const user = result.rows[0];

    // Always check the password first, so nobody can learn an account exists (or is blocked)
    // without knowing its password.
    const isMatch = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Contact the librarian.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        surname: user.surname,
        firstName: user.first_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong during login.' });
  }
});

module.exports = router;
