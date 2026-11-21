// utils/normalizeTitle.js
// Makes titles comparable: "The Great Gatsby!" and "the great  gatsby" become the same text.
// Used to match the titles in your sheet against the titles in your library,
// and to check that an Open Library result is really the book you asked for.

function normalizeTitle(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: "Brontë" -> "bronte"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ') // punctuation and extra spaces -> single space
    .trim();
}

module.exports = { normalizeTitle };
