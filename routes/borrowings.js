const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HOLD_HOURS } = require('../config/borrowing');

const router = express.Router();

// Lets us stop part-way through the transaction below and still send a clear message.
class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Request a book.  Body: { bookId }
//
// This is the most delicate route in the app: two people can ask for the last copy at the
// same instant. The whole check-then-insert runs inside ONE transaction, and the book's row
// is locked (FOR UPDATE) for the duration. A second request for the same book waits at the
// lock, then counts again and sees the first person's hold, so only one of them gets the copy.
// The lock is per book, so requests for different books never wait on each other.
router.post('/', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'The admin account cannot borrow books.' });
  }

  const { bookId } = req.body || {};
  if (!/^\d+$/.test(String(bookId)) || Number(bookId) > 2147483647) {
    return res.status(400).json({ error: 'A valid bookId is required.' });
  }

  const client = await pool.connect(); // one connection used for the whole transaction
  try {
    await client.query('BEGIN');

    // 1) The user must exist and must not be blocked.
    const userResult = await client.query('SELECT is_blocked FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      throw new RequestError(401, 'Account not found.');
    }
    if (userResult.rows[0].is_blocked) {
      throw new RequestError(403, 'Your account is blocked. Please contact the librarian.');
    }

    // 2) Tidy up: this user's own pending requests whose 24 hours have passed become 'expired'.
    //    (Expired requests already stop counting everywhere; this just frees the user to ask again.)
    await client.query(
      `UPDATE borrowings SET status = 'expired'
       WHERE user_id = $1 AND status = 'pending' AND expires_at <= now()`,
      [req.user.id]
    );

    // 3) One live request or borrowed book at a time.
    const live = await client.query(
      `SELECT status FROM borrowings WHERE user_id = $1 AND status IN ('pending', 'borrowed') LIMIT 1`,
      [req.user.id]
    );
    if (live.rows.length > 0) {
      throw new RequestError(
        409,
        live.rows[0].status === 'borrowed'
          ? 'You still have a borrowed book. Return it before borrowing another.'
          : 'You already have a pending request. Collect that book or wait for it to expire first.'
      );
    }

    // 4) Never the same book twice.
    const before = await client.query(
      `SELECT 1 FROM borrowings WHERE user_id = $1 AND book_id = $2 AND status = 'returned'`,
      [req.user.id, bookId]
    );
    if (before.rows.length > 0) {
      throw new RequestError(409, 'You have already borrowed this book before.');
    }

    // 5) Lock this book's row. Anyone else requesting the same book waits here until we commit.
    const book = await client.query('SELECT total_copies FROM books WHERE id = $1 FOR UPDATE', [bookId]);
    if (book.rows.length === 0) {
      throw new RequestError(404, 'Book not found.');
    }

    // 6) Copies in use = borrowed ones + requests still inside their 24-hour hold.
    const holds = await client.query(
      `SELECT COUNT(*)::int AS count FROM borrowings
       WHERE book_id = $1
         AND (status = 'borrowed' OR (status = 'pending' AND expires_at > now()))`,
      [bookId]
    );
    if (holds.rows[0].count >= book.rows[0].total_copies) {
      throw new RequestError(409, 'No copies of this book are available right now.');
    }

    // 7) A copy is free: create the request and start the 24-hour hold.
    const inserted = await client.query(
      `INSERT INTO borrowings (user_id, book_id, expires_at)
       VALUES ($1, $2, now() + make_interval(hours => $3::int))
       RETURNING id, book_id, status, requested_at, expires_at`,
      [req.user.id, bookId, HOLD_HOURS]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: `Request received. Please come to the library within ${HOLD_HOURS} hours to collect the book.`,
      borrowing: inserted.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {}); // undo everything done since BEGIN

    if (err instanceof RequestError) {
      return res.status(err.status).json({ error: err.message });
    }
    // 23505 = the database's own unique rules caught something (for example a double-click
    // that slipped past step 3 because both clicks ran at the same moment).
    if (err.code === '23505') {
      return res.status(409).json({
        error:
          err.constraint === 'one_time_per_book'
            ? 'You have already borrowed this book before.'
            : 'You already have an active request or a borrowed book.',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong requesting the book.' });
  } finally {
    client.release(); // always give the connection back to the pool
  }
});

// The logged-in user's own borrowings, newest first.
// A pending request whose 24 hours have passed is reported as 'expired'.
// server_time lets the frontend correct for a wrong clock on the user's device when
// it works out the countdown.
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.book_id, books.title, books.author, books.cover_image_url,
              CASE WHEN b.status = 'pending' AND b.expires_at <= now() THEN 'expired' ELSE b.status END AS status,
              b.requested_at, b.expires_at, b.approved_at, b.due_date, b.returned_at,
              now() AS server_time
       FROM borrowings b
       JOIN books ON books.id = b.book_id
       WHERE b.user_id = $1
       ORDER BY b.requested_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching your borrowings.' });
  }
});

module.exports = router;
