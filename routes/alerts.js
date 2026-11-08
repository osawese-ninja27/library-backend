const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// When each reminder starts showing. Change a number here to change the rule.
const PICKUP_WARNING_HOURS = 2;  // pickup reminder: this many hours left of the 24-hour hold
const RETURN_WARNING_HOURS = 24; // return reminder: this many hours left before the loan is due

// The messages are written here, by the system. The admin does not type them and nothing is stored.
const MESSAGES = {
  pickup: 'Your request is still valid, please pick up your book at the Dreamcode library',
  return: 'Your borrowed book should be returned after 24 hours, pls endeavor to return it',
};

// The alert for the logged-in user, or { alert: null } when there is nothing to remind them about.
// It is worked out fresh on every call from the borrowings table, using the DATABASE clock
// (now()), never the clock on the user's device. Which user is asked comes from the login token
// (req.user.id), so nobody can ask for someone else's alert.
router.get('/', requireAuth, async (req, res) => {
  // The admin account cannot borrow, so it never has alerts.
  if (req.user.role === 'admin') {
    return res.json({ alert: null });
  }

  try {
    const result = await pool.query(
      `SELECT id, status
       FROM borrowings
       WHERE user_id = $1
         AND (
           -- a request still inside its 24-hour hold, with little time left to collect
           (status = 'pending'
              AND expires_at > now()
              AND expires_at <= now() + make_interval(hours => $2::int))
           OR
           -- a borrowed book that is close to (or past) its due date
           (status = 'borrowed'
              AND due_date <= now() + make_interval(hours => $3::int))
         )
       LIMIT 1`,
      [req.user.id, PICKUP_WARNING_HOURS, RETURN_WARNING_HOURS]
    );

    if (result.rows.length === 0) {
      return res.json({ alert: null });
    }

    const row = result.rows[0];
    const type = row.status === 'pending' ? 'pickup' : 'return';
    res.json({ alert: { id: row.id, type, message: MESSAGES[type] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong checking your alerts.' });
  }
});

module.exports = router;
