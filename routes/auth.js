const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { surname, firstName, middleName, email, password } = req.body;

  // Basic validation
  if (!surname || !firstName || !email || !password) {
    return res.status(400).json({ error: 'Surname, first name, email, and password are required.' });
  }

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert the new user
    const result = await pool.query(
      `INSERT INTO users (surname, first_name, middle_name, email, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, surname, first_name, email`,
      [surname, firstName, middleName || null, email, hashedPassword]
    );

    res.status(201).json({ message: 'Registration successful.', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong during registration.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, surname, first_name, email, password_hash, role, is_blocked FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Contact the librarian.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
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