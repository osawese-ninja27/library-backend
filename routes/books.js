const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const validateId = require('../middleware/validateId');

const router = express.Router();

// Reject non-numeric ids like /abc before they reach the database
router.param('id', validateId);

// Reads the copies number from a request. Returns null when it was left out,
// the number when valid, or false when it is not a whole number from 0 to 100.
function parseCopies(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : false;
}

// Create a new book
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, author, description, genre, categoryId, coverImageUrl, totalCopies } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Book title is required.' });
  }

  // Number of physical copies. Left out = 2 (the database default).
  const copies = parseCopies(totalCopies);
  if (copies === false) {
    return res.status(400).json({ error: 'totalCopies must be a whole number from 0 to 100.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO books (title, author, description, genre, category_id, cover_image_url, total_copies)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 2))
       RETURNING id, title, author, description, genre, category_id, cover_image_url, total_copies`,
      [title, author || null, description || null, genre || null, categoryId || null, coverImageUrl || null, copies]
    );

    res.status(201).json({ message: 'Book created.', book: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating the book.' });
  }
});

// Get all books, with their category name attached
router.get('/',  async (req, res) => {
  try {
    // available_copies = total copies minus copies in use (borrowed, or held by a request that
    // is still inside its 24-hour window). It is worked out fresh every time, never stored.
    const result = await pool.query(`
      SELECT books.id, books.title, books.author, books.description, books.genre,
             books.cover_image_url, books.category_id, categories.name AS category_name,
             books.total_copies,
             GREATEST(books.total_copies - COALESCE(in_use.count, 0), 0)::int AS available_copies
      FROM books
      LEFT JOIN categories ON books.category_id = categories.id
      LEFT JOIN (
        SELECT book_id, COUNT(*) AS count
        FROM borrowings
        WHERE status = 'borrowed' OR (status = 'pending' AND expires_at > now())
        GROUP BY book_id
      ) AS in_use ON in_use.book_id = books.id
      ORDER BY books.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching books.' });
  }
});

// Update a book
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, author, description, genre, categoryId, coverImageUrl, totalCopies } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Book title is required.' });
  }

  // Left out = keep the current number of copies.
  const copies = parseCopies(totalCopies);
  if (copies === false) {
    return res.status(400).json({ error: 'totalCopies must be a whole number from 0 to 100.' });
  }

  // A dedicated connection, because the lock, the check and the update must run as one transaction.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock this book's row. This is the same lock the request route (routes/borrowings.js) takes,
    // so nobody can request a copy in the split second between our check and our update.
    const found = await client.query('SELECT id FROM books WHERE id = $1 FOR UPDATE', [id]);
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Book not found.' });
    }

    // The total can never drop below the copies already borrowed or held by a live request.
    if (copies !== null) {
      const inUse = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM borrowings
         WHERE book_id = $1
           AND (status = 'borrowed' OR (status = 'pending' AND expires_at > now()))`,
        [id]
      );
      const taken = inUse.rows[0].count;
      if (copies < taken) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Cannot set the total to ${copies}: ${taken} ${taken === 1 ? 'copy is' : 'copies are'} currently borrowed or held by a request.`,
        });
      }
    }

    const result = await client.query(
      `UPDATE books
       SET title = $1, author = $2, description = $3, genre = $4, category_id = $5, cover_image_url = $6,
           total_copies = COALESCE($7, total_copies)
       WHERE id = $8
       RETURNING id, title, author, description, genre, category_id, cover_image_url, total_copies`,
      [title, author || null, description || null, genre || null, categoryId || null, coverImageUrl || null, copies, id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Book updated.', book: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the book.' });
  } finally {
    client.release(); // always hand the connection back to the pool
  }
});

// Delete a book
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM books WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    res.json({ message: 'Book deleted.' });
  } catch (err) {
    // 23503 = the book still has borrowing records, which are kept as the library's history
    if (err.code === '23503') {
      return res.status(409).json({ error: 'This book has borrowing records, so it cannot be deleted.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong deleting the book.' });
  }
});

module.exports = router;
