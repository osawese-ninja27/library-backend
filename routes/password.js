const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// Set a new password for a user (admin only). Body: { email, newPassword }
// Mounted at /api/users/password.
// The admin account's own password can only be changed directly in the database.
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  try {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const result = await pool.query(
      `UPDATE users SET password_hash = $1
       WHERE email = $2 AND role <> 'admin'
       RETURNING id`,
      [hash, email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email.' });
    }

    res.json({ message: 'Password updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the password.' });
  }
});

module.exports = router;
