const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const validateId = require('../middleware/validateId');

const router = express.Router();

// Reject non-numeric book ids like /abc before they reach the database
router.param('bookId', validateId);

// Get the logged-in user's favourite books, most recently added first.
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT books.id, books.title, books.author, books.description, books.genre,
              books.cover_image_url, books.category_id, categories.name AS category_name
       FROM favorites
       JOIN books ON books.id = favorites.book_id
       LEFT JOIN categories ON categories.id = books.category_id
       WHERE favorites.user_id = $1
       ORDER BY favorites.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching favorites.' });
  }
});

// Get only the ids of the user's favourites. Light enough to load on every page,
// so each book card knows whether to show a filled heart.
router.get('/ids', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT book_id FROM favorites WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows.map((row) => row.book_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching favorites.' });
  }
});

// Add a book to the user's favourites. Adding it twice is harmless.
router.put('/:bookId', requireAuth, async (req, res) => {
  const { bookId } = req.params;

  try {
    await pool.query(
      `INSERT INTO favorites (user_id, book_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, book_id) DO NOTHING`,
      [req.user.id, bookId]
    );
    res.json({ message: 'Added to favorites.' });
  } catch (err) {
    // 23503 = the book id does not exist
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Book not found.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong adding the favorite.' });
  }
});

// Remove a book from the user's favourites. Removing one that isn't there is harmless.
router.delete('/:bookId', requireAuth, async (req, res) => {
  const { bookId } = req.params;

  try {
    await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND book_id = $2',
      [req.user.id, bookId]
    );
    res.json({ message: 'Removed from favorites.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong removing the favorite.' });
  }
});

module.exports = router;
