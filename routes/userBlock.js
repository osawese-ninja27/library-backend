const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const validateId = require('../middleware/validateId');

const router = express.Router();

// Reject non-numeric ids like /abc before they reach the database
router.param('id', validateId);

// Block or unblock a user (admin only). Body: { blocked: true | false }
router.patch('/:id/block', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { blocked } = req.body;

  if (typeof blocked !== 'boolean') {
    return res.status(400).json({ error: 'blocked must be true or false.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET is_blocked = $1
       WHERE id = $2 AND role <> 'admin'
       RETURNING id, email, is_blocked`,
      [blocked, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      message: blocked ? 'User blocked.' : 'User unblocked.',
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the user.' });
  }
});

module.exports = router;
