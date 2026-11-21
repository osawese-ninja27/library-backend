// routes/covers.js
// Cover Finder backend (admin only). Two steps so the admin can check pictures before saving:
//   POST /api/covers/search -> finds candidate covers for sheet rows (saves nothing)
//   POST /api/covers/apply  -> uploads the chosen covers to Cloudinary and updates the books
// Only books that already exist in the library are touched; this never creates books.

const express = require('express');
const router = express.Router();

const { requireAuth, requireAdmin } = require('../middleware/auth');
const dbModule = require('../db');
const { matchBook } = require('../services/bookMatch');
const { findCover, coverUrl } = require('../services/openLibrary');
const { uploadCover } = require('../services/coverStorage');

const pool = dbModule.pool || dbModule;

// Small batches keep every request short (serverless time limits on Vercel).
const MAX_SEARCH_ROWS = 5;
const MAX_APPLY_ITEMS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanIsbn(value) {
  const digits = String(value || '').replace(/[\s-]/g, '');
  return /^(\d{9}[\dXx]|\d{13})$/.test(digits) ? digits : '';
}

function cleanRows(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_SEARCH_ROWS) return null;
  const out = [];
  for (const r of rows) {
    const title = typeof r?.title === 'string' ? r.title.trim() : '';
    if (!title || title.length > 255) return null;
    out.push({
      title,
      author: typeof r.author === 'string' ? r.author.trim().slice(0, 255) : '',
      isbn: cleanIsbn(r.isbn),
    });
  }
  return out;
}

function cleanItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_APPLY_ITEMS) return null;
  const out = [];
  for (const it of items) {
    if (!Number.isInteger(it?.bookId) || it.bookId < 1) return null;
    if (!Number.isInteger(it?.coverId) || it.coverId < 1) return null;
    out.push({ bookId: it.bookId, coverId: it.coverId });
  }
  return out;
}

// Works out what to tell the admin about one sheet row.
async function checkRow(row, books) {
  const base = {
    title: row.title,
    author: row.author,
    book: null,
    status: 'not_in_library',
    confidence: null,
    coverId: null,
    previewUrl: null,
    message: 'No book with this title in the library yet.',
  };

  const match = matchBook(books, row.title, row.author);
  if (match.status === 'none') return base;
  if (match.status === 'ambiguous') {
    return { ...base, status: 'ambiguous', message: `${match.count} books in the library share this title.` };
  }

  const book = {
    id: match.book.id,
    title: match.book.title,
    author: match.book.author || '',
    currentCoverUrl: match.book.cover_image_url || null,
  };

  try {
    const found = await findCover(row);
    if (!found) {
      return { ...base, book, status: 'no_cover_found', message: 'Open Library has no cover for this title.' };
    }
    const result = {
      ...base,
      book,
      coverId: found.coverId,
      previewUrl: coverUrl(found.coverId, 'M'),
      confidence: found.confidence,
      message: '',
    };
    if (book.currentCoverUrl) return { ...result, status: 'already_has_cover', message: 'This book already has a cover.' };
    if (found.confidence === 'low') {
      return { ...result, status: 'low_confidence', message: 'Not an exact title match. Check the picture.' };
    }
    return { ...result, status: 'ready' };
  } catch (err) {
    console.error('cover lookup failed:', err.message);
    return { ...base, book, status: 'error', message: 'Could not reach Open Library. Try again.' };
  }
}

router.post('/search', requireAuth, requireAdmin, async (req, res) => {
  const rows = cleanRows(req.body?.rows);
  if (!rows) {
    return res.status(400).json({ message: `Send 1 to ${MAX_SEARCH_ROWS} rows, each with a title.` });
  }
  try {
    const { rows: books } = await pool.query('SELECT id, title, author, cover_image_url FROM books');
    const results = [];
    for (const row of rows) {
      results.push(await checkRow(row, books));
      await sleep(250); // be gentle with the free API
    }
    res.json({ results });
  } catch (err) {
    console.error('cover search failed:', err.message);
    res.status(500).json({ message: 'Could not search for covers right now.' });
  }
});

router.post('/apply', requireAuth, requireAdmin, async (req, res) => {
  const items = cleanItems(req.body?.items);
  if (!items) {
    return res.status(400).json({ message: `Send 1 to ${MAX_APPLY_ITEMS} items with bookId and coverId.` });
  }
  const results = [];
  for (const item of items) {
    try {
      const found = await pool.query('SELECT id, title FROM books WHERE id = $1', [item.bookId]);
      if (found.rows.length === 0) {
        results.push({ bookId: item.bookId, ok: false, message: 'This book no longer exists.' });
        continue;
      }
      const url = await uploadCover({ coverId: item.coverId, bookId: item.bookId, title: found.rows[0].title });
      await pool.query('UPDATE books SET cover_image_url = $1 WHERE id = $2', [url, item.bookId]);
      results.push({ bookId: item.bookId, ok: true, coverUrl: url });
    } catch (err) {
      console.error('cover apply failed:', err.message);
      results.push({ bookId: item.bookId, ok: false, message: 'Could not save this cover.' });
    }
  }
  res.json({ results });
});

module.exports = router;
