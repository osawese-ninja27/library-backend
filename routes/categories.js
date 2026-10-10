const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const validateId = require('../middleware/validateId');

const router = express.Router();

// Reject non-numeric ids like /abc before they reach the database
router.param('id', validateId);

// Create a new category
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM categories WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This category already exists.' });
    }

    const result = await pool.query(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id, name`,
      [name]
    );

    res.status(201).json({ message: 'Category created.', category: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating the category.' });
  }
});

// Get all categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong fetching categories.' });
  }
});

// Update a category
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    const result = await pool.query(
      `UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name`,
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ message: 'Category updated.', category: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong updating the category.' });
  }
});

// Delete a category
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM categories WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ message: 'Category deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong deleting the category.' });
  }
});

module.exports = router;