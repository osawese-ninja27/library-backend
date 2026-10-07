const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all regular users (admin only). The admin account is never listed.
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, surname, first_name, middle_name, is_blocked, created_at
       FROM users
       WHERE role <> 'admin'
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching users.' });
  }
});

module.exports = router;
