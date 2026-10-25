const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const validateId = require('../middleware/validateId');

const router = express.Router();

const MAX_LENGTH = 5000; // characters in one note (the database enforces the same limit)

// Every notes route needs a logged-in regular user. Notes are private, so each query below
// also filters by req.user.id: nobody can read or change another person's note.
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'The admin account cannot write notes.' });
  }
  next();
});

// Reject non-numeric book ids like /abc, and numbers too big for the database's integer column
router.param('bookId', validateId);
router.param('bookId', (req, res, next, value) => {
  if (Number(value) > 2147483647) {
    return res.status(400).json({ error: 'Invalid id.' });
  }
  next();
});

// The list of books the user has written on, newest note first.
// Each row has the book title, the day the note was started, and the first part of the text.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.book_id, books.title, n.created_at, LEFT(n.content, 300) AS preview
       FROM notes n
       JOIN books ON books.id = n.book_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching your notes.' });
  }
});

// One book's note. A book with no note yet comes back with empty text, so the page opens blank.
router.get('/:bookId', async (req, res) => {
  const { bookId } = req.params;

  try {
    const result = await pool.query(
      `SELECT books.id AS book_id, books.title, COALESCE(n.content, '') AS content
       FROM books
       LEFT JOIN notes n ON n.book_id = books.id AND n.user_id = $1
       WHERE books.id = $2`,
      [req.user.id, bookId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching your note.' });
  }
});

// Save a book's note.  Body: { content }
// The first save creates the note, later saves replace the text. Saving the same text twice is
// harmless. If the text is emptied, the note is removed so the list only shows books written on.
router.put('/:bookId', async (req, res) => {
  const { bookId } = req.params;
  const { content } = req.body || {};

  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be text.' });
  }
  if (content.length > MAX_LENGTH) {
    return res.status(400).json({ error: `A note can be at most ${MAX_LENGTH} characters.` });
  }

  try {
    if (content.trim() === '') {
      await pool.query('DELETE FROM notes WHERE user_id = $1 AND book_id = $2', [req.user.id, bookId]);
      return res.json({ message: 'Saved.' });
    }

    await pool.query(
      `INSERT INTO notes (user_id, book_id, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, book_id)
       DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
      [req.user.id, bookId, content]
    );
    res.json({ message: 'Saved.' });
  } catch (err) {
    // 23503 = the book id does not exist
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Book not found.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong saving your note.' });
  }
});

module.exports = router;
