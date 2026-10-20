const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const { LOAN_DAYS } = require('../config/borrowing');

const router = express.Router();

// Every route in this file is admin only.
router.use(requireAuth, requireAdmin);

// Reject non-numeric ids like /abc before they reach the database
router.param('id', validateId);

// The three tabs of the Borrowed Books page. These are fixed pieces of SQL chosen by name,
// never built from what the browser sends, so nothing the user types can reach the query.
const TABS = {
  // Waiting for the person to come and collect (still inside the 24-hour hold). Oldest first.
  pending: {
    where: `b.status = 'pending' AND b.expires_at > now()`,
    order: 'b.requested_at ASC',
  },
  // Books currently out. The one due soonest comes first.
  borrowed: {
    where: `b.status = 'borrowed'`,
    order: 'b.due_date ASC',
  },
  // Finished: returned, rejected, or never collected within 24 hours. Newest first.
  history: {
    where: `b.status IN ('returned', 'rejected', 'expired')
            OR (b.status = 'pending' AND b.expires_at <= now())`,
    order: 'b.requested_at DESC',
  },
};

// List borrowings for one tab.  GET /api/admin/borrowings?tab=pending|borrowed|history&limit=50&offset=0
router.get('/', async (req, res) => {
  const tab = TABS[req.query.tab];
  if (!tab) {
    return res.status(400).json({ error: 'tab must be pending, borrowed or history.' });
  }

  // Pages of up to 100 rows, so the history tab stays fast as it grows.
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT b.id, b.user_id, u.email, u.surname, u.first_name, u.middle_name,
                b.book_id, books.title,
                CASE WHEN b.status = 'pending' AND b.expires_at <= now() THEN 'expired' ELSE b.status END AS status,
                b.requested_at, b.expires_at, b.approved_at, b.due_date, b.returned_at,
                (b.status = 'borrowed' AND b.due_date < now()) AS is_overdue,
                CASE WHEN b.approved_at IS NULL THEN NULL
                     ELSE FLOOR(EXTRACT(EPOCH FROM (COALESCE(b.returned_at, now()) - b.approved_at)) / 86400)::int
                END AS days_held,
                now() AS server_time
         FROM borrowings b
         JOIN users u ON u.id = b.user_id
         JOIN books ON books.id = b.book_id
         WHERE ${tab.where}
         ORDER BY ${tab.order}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM borrowings b WHERE ${tab.where}`),
    ]);

    res.json({ items: rows.rows, total: count.rows[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching borrowings.' });
  }
});

// When an update changes no row, work out WHY so the admin gets a useful message
// (not found, already handled, hold expired, user blocked).
async function explainFailure(id, expectedStatus) {
  const check = await pool.query(
    `SELECT b.status, (b.expires_at <= now()) AS expired, u.is_blocked
     FROM borrowings b JOIN users u ON u.id = b.user_id
     WHERE b.id = $1`,
    [id]
  );
  if (check.rows.length === 0) {
    return { status: 404, error: 'Borrowing record not found.' };
  }
  const row = check.rows[0];
  if (row.status !== expectedStatus) {
    return { status: 409, error: `This record is already "${row.status}", so this action does not apply.` };
  }
  if (expectedStatus === 'pending' && row.expired) {
    return { status: 409, error: 'The 24-hour hold on this request has expired. The user must request again.' };
  }
  if (expectedStatus === 'pending' && row.is_blocked) {
    return { status: 409, error: 'This user is blocked. Reject the request or unblock the user first.' };
  }
  return { status: 409, error: 'This record changed while you were working. Refresh and try again.' };
}

// Approve a request: the person has come to the library and collected the book.
// This starts the 30-day timer. The request already held a copy, so availability does not change.
router.patch('/:id/approve', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE borrowings
       SET status = 'borrowed', approved_at = now(), due_date = now() + make_interval(days => $2::int)
       WHERE id = $1
         AND status = 'pending'
         AND expires_at > now()
         AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = borrowings.user_id AND users.is_blocked)
       RETURNING id, user_id, book_id, status, approved_at, due_date`,
      [id, LOAN_DAYS]
    );

    if (result.rows.length === 0) {
      const why = await explainFailure(id, 'pending');
      return res.status(why.status).json({ error: why.error });
    }

    res.json({ message: `Book handed over. Due back in ${LOAN_DAYS} days.`, borrowing: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong approving the request.' });
  }
});

// Reject a pending request. The copy it held becomes available again straight away.
router.patch('/:id/reject', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE borrowings SET status = 'rejected'
       WHERE id = $1 AND status = 'pending'
       RETURNING id, user_id, book_id, status`,
      [id]
    );

    if (result.rows.length === 0) {
      const why = await explainFailure(id, 'pending');
      return res.status(why.status).json({ error: why.error });
    }

    res.json({ message: 'Request rejected.', borrowing: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong rejecting the request.' });
  }
});

// Mark a borrowed book as returned (the librarian tells the system). The timer stops
// because returned_at is now set, and the copy becomes available again.
router.patch('/:id/return', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE borrowings SET status = 'returned', returned_at = now()
       WHERE id = $1 AND status = 'borrowed'
       RETURNING id, user_id, book_id, status, approved_at, due_date, returned_at`,
      [id]
    );

    if (result.rows.length === 0) {
      const why = await explainFailure(id, 'borrowed');
      return res.status(why.status).json({ error: why.error });
    }

    res.json({ message: 'Book marked as returned.', borrowing: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong marking the book as returned.' });
  }
});

module.exports = router;
