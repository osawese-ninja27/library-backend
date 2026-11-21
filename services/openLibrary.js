// services/openLibrary.js
// The only file that talks to Open Library (free, no API key needed).
// Given a title (and optionally author / ISBN) it returns the id of the best cover.
//
// Optional: add OPENLIBRARY_CONTACT_EMAIL to .env. Open Library asks apps to identify
// themselves in the User-Agent header and gives identified apps a higher request limit.

const { normalizeTitle } = require('../utils/normalizeTitle');

const SEARCH_URL = 'https://openlibrary.org/search.json';
const COVER_BASE = 'https://covers.openlibrary.org/b/id';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function userAgent() {
  const contact = process.env.OPENLIBRARY_CONTACT_EMAIL;
  return contact ? `DreamCodeLibrary/1.0 (${contact})` : 'DreamCodeLibrary/1.0';
}

async function fetchJson(url, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Open Library responded with ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

async function search(params) {
  const qs = new URLSearchParams({ ...params, limit: '5', fields: 'key,title,author_name,cover_i' });
  const data = await fetchJson(`${SEARCH_URL}?${qs.toString()}`);
  return Array.isArray(data.docs) ? data.docs : [];
}

const hasCover = (d) => Number.isInteger(d.cover_i) && d.cover_i > 0;

// From the search results, keep only a result whose title really matches.
function pickBest(docs, title) {
  const wanted = normalizeTitle(title);
  const withCover = docs.filter(hasCover);

  const exact = withCover.find((d) => normalizeTitle(d.title) === wanted);
  if (exact) return { coverId: exact.cover_i, confidence: 'high', matchedTitle: exact.title };

  const close = withCover.find((d) => {
    const n = normalizeTitle(d.title);
    return n && wanted && (n.startsWith(wanted) || wanted.startsWith(n));
  });
  if (close) return { coverId: close.cover_i, confidence: 'low', matchedTitle: close.title };

  return null;
}

// Returns { coverId, confidence: 'high' | 'low', matchedTitle } or null if nothing suitable.
async function findCover({ title, author, isbn }) {
  if (isbn) {
    const docs = await search({ isbn });
    const hit = docs.find(hasCover);
    if (hit) return { coverId: hit.cover_i, confidence: 'high', matchedTitle: hit.title };
    await sleep(200);
  }

  if (author) {
    const pick = pickBest(await search({ title, author }), title);
    if (pick) return pick;
    await sleep(200);
  }

  const pick = pickBest(await search({ title }), title);
  if (!pick) return null;
  // Title-only search after an author was given: could be a different author's book.
  return author ? { ...pick, confidence: 'low' } : pick;
}

// size: 'S' | 'M' | 'L'
function coverUrl(coverId, size = 'M') {
  return `${COVER_BASE}/${coverId}-${size}.jpg`;
}

module.exports = { findCover, coverUrl, pickBest };
