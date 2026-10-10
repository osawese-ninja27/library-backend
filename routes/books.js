const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const validateId = require('../middleware/validateId');

const router = express.Router();

// Reject non-numeric ids like /abc before they reach the database
router.param('id', validateId);

// Create a new book
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, author, description, genre, categoryId, coverImageUrl } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Book title is required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO books (title, author, description, genre, category_id, cover_image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, author, description, genre, category_id, cover_image_url`,
      [title, author || null, description || null, genre || null, categoryId || null, coverImageUrl || null]
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
    const result = await pool.query(`
      SELECT books.id, books.title, books.author, books.description, books.genre,
             books.cover_image_url, books.category_id, categories.name AS category_name
      FROM books
      LEFT JOIN categories ON books.category_id = categories.id
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
  const { title, author, description, genre, categoryId, coverImageUrl } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Book title is required.' });
  }

  try {
    const result = await pool.query(
      `UPDATE books
       SET title = $1, author = $2, description = $3, genre = $4, category_id = $5, cover_image_url = $6
       WHERE id = $7
       RETURNING id, title, author, description, genre, category_id, cover_image_url`,
      [title, author || null, description || null, genre || null, categoryId || null, coverImageUrl || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    res.json({ message: 'Book updated.', book: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the book.' });
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
    console.error(err);
    res.status(500).json({ error: 'Something went wrong deleting the book.' });
  }
});

module.exports = router;