// services/bookMatch.js
// Finds which book in YOUR library a row of the sheet refers to.
// Pure logic (no database or network calls), so it is easy to test.
// A match means: same title, ignoring capital letters, punctuation and accents.
// If several library books share that title, the author is used to pick the right one.

const { normalizeTitle } = require('../utils/normalizeTitle');

function sameAuthor(a, b) {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

// books: rows from the books table ({ id, title, author, cover_image_url })
// returns { status: 'none' } | { status: 'ambiguous', count } | { status: 'one', book }
function matchBook(books, title, author) {
  const wanted = normalizeTitle(title);
  if (!wanted) return { status: 'none' };

  let hits = books.filter((b) => normalizeTitle(b.title) === wanted);

  if (hits.length > 1 && author) {
    const byAuthor = hits.filter((b) => sameAuthor(b.author, author));
    if (byAuthor.length >= 1) hits = byAuthor;
  }

  if (hits.length === 0) return { status: 'none' };
  if (hits.length > 1) return { status: 'ambiguous', count: hits.length };
  return { status: 'one', book: hits[0] };
}

module.exports = { matchBook };
