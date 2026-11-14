// scripts/seedBooks.js
// One-time script: adds the books from booksList.js to your database.
// For each book it:
//   1. looks up a description + cover image (Open Library, then Google Books as backup)
//   2. uploads the cover to YOUR Cloudinary (folder: library-books)
//   3. saves the book (title, author, description, genre, category, cover URL)
//
// Run from the library-backend folder:
//   node scripts/seedBooks.js --limit=5     (test with 5 books first)
//   node scripts/seedBooks.js               (all 100)
//   node scripts/seedBooks.js --dry         (look things up, save nothing)
// Safe to re-run: books whose title already exists are skipped.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const books = require('./booksList');

// ---------- settings you may need to adjust ----------
const INCLUDE_AUTHOR = true; // set to false if your books table has no "author" column
const CATEGORY_NAME_COLUMN = 'name'; // column in categories that holds the category name
const MAX_DESC_CHARS = 600;
const DELAY_MS = 500; // pause between books so the free APIs don't block you
// -----------------------------------------------------

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : books.length;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'library',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'DreamCodeLibrary-seed/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function cleanDescription(text) {
  if (!text) return null;
  let t = String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\(\[?source[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length < 40) return null;
  if (t.length > MAX_DESC_CHARS) {
    const cut = t.slice(0, MAX_DESC_CHARS);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = lastStop > 200 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, '') + '...';
  }
  return t;
}

async function fromOpenLibrary(title, author) {
  const out = { description: null, coverUrl: null };
  try {
    const q = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1&fields=key,cover_i`;
    const doc = (await getJson(q)).docs?.[0];
    if (!doc) return out;
    if (doc.cover_i) out.coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`;
    const work = await getJson(`https://openlibrary.org${doc.key}.json`);
    const d = typeof work.description === 'string' ? work.description : work.description?.value;
    out.description = cleanDescription(d);
  } catch (e) {
    /* ignore, we have a backup source */
  }
  return out;
}

async function fromGoogleBooks(title, author) {
  const out = { description: null, coverUrl: null };
  try {
    const q = `intitle:"${title}" inauthor:"${author}"`;
    const data = await getJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&printType=books`);
    const info = data.items?.[0]?.volumeInfo;
    if (!info) return out;
    out.description = cleanDescription(info.description);
    const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
    if (thumb) {
      out.coverUrl = thumb.replace('http://', 'https://').replace('&edge=curl', '').replace('zoom=1', 'zoom=2');
    }
  } catch (e) {
    /* ignore */
  }
  return out;
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function uploadCover(urls, title) {
  for (const url of urls.filter(Boolean)) {
    try {
      const result = await cloudinary.uploader.upload(url, {
        folder: 'library-books',
        public_id: slugify(title),
        overwrite: true,
      });
      return result.secure_url;
    } catch (e) {
      /* try the next source */
    }
  }
  return null;
}

const categoryCache = new Map();
async function getCategoryId(name) {
  if (categoryCache.has(name)) return categoryCache.get(name);
  const found = await pool.query(
    `SELECT id FROM categories WHERE lower(${CATEGORY_NAME_COLUMN}) = lower($1)`,
    [name]
  );
  let id;
  if (found.rows.length) {
    id = found.rows[0].id;
  } else {
    const created = await pool.query(
      `INSERT INTO categories (${CATEGORY_NAME_COLUMN}) VALUES ($1) RETURNING id`,
      [name]
    );
    id = created.rows[0].id;
  }
  categoryCache.set(name, id);
  return id;
}

async function main() {
  const report = { added: [], skipped: [], needsAttention: [] };
  const list = books.slice(0, LIMIT);

  for (let i = 0; i < list.length; i++) {
    const [title, author, category, genre] = list[i];
    const label = `[${i + 1}/${list.length}] ${title}`;

    try {
      const exists = await pool.query('SELECT 1 FROM books WHERE lower(title) = lower($1)', [title]);
      if (exists.rows.length) {
        console.log(`${label} - already in database, skipped`);
        report.skipped.push(title);
        continue;
      }

      const ol = await fromOpenLibrary(title, author);
      const gb = await fromGoogleBooks(title, author);
      const description = gb.description || ol.description;

      if (!description) {
        console.log(`${label} - NO DESCRIPTION FOUND, not added`);
        report.needsAttention.push({ title, author, problem: 'no description' });
        continue;
      }

      if (DRY) {
        console.log(`${label} - OK (dry run) cover:${ol.coverUrl || gb.coverUrl ? 'yes' : 'NO'}`);
        continue;
      }

      const coverUrl = await uploadCover([ol.coverUrl, gb.coverUrl], title);
      if (!coverUrl) {
        console.log(`${label} - NO COVER FOUND, not added`);
        report.needsAttention.push({ title, author, problem: 'no cover image' });
        continue;
      }

      const categoryId = await getCategoryId(category);
      const columns = ['title', 'description', 'genre', 'category_id', 'cover_image_url'];
      const values = [title, description, genre, categoryId, coverUrl];
      if (INCLUDE_AUTHOR) {
        columns.push('author');
        values.push(author);
      }
      const placeholders = values.map((_, n) => `$${n + 1}`).join(', ');
      await pool.query(`INSERT INTO books (${columns.join(', ')}) VALUES (${placeholders})`, values);

      console.log(`${label} - added`);
      report.added.push(title);
    } catch (e) {
      console.log(`${label} - ERROR: ${e.message}`);
      report.needsAttention.push({ title, author, problem: e.message });
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(path.join(__dirname, 'seed-report.json'), JSON.stringify(report, null, 2));
  console.log(
    `\nDone. Added: ${report.added.length} | Skipped: ${report.skipped.length} | Need attention: ${report.needsAttention.length}`
  );
  console.log('Details saved in scripts/seed-report.json');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
