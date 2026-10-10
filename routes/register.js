const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { registerLimiter } = require('../middleware/rateLimit');
const { MIN_PASSWORD_LENGTH, normalizeEmail, isValidEmail } = require('../utils/validators');

const router = express.Router();

const SALT_ROUNDS = 10;

// Create a new regular user account. Mounted at /api/register.
router.post('/', registerLimiter, async (req, res) => {
  const { surname, firstName, middleName, password } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!surname?.trim() || !firstName?.trim() || !email || !password) {
    return res.status(400).json({ error: 'Surname, first name, email, and password are required.' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (surname, first_name, middle_name, email, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, surname, first_name, email`,
      [surname.trim(), firstName.trim(), middleName?.trim() || null, email, hashedPassword]
    );

    res.status(201).json({ message: 'Registration successful.', user: result.rows[0] });
  } catch (err) {
    // Two sign-ups with the same email at the same moment: the database unique rule catches it.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong during registration.' });
  }
});

module.exports = router;
