// services/coverStorage.js
// Copies a cover from Open Library into YOUR Cloudinary account (folder: library-books),
// so the app never depends on Open Library being online and hosting stays Vercel-friendly.
// The image address is built here from a numeric cover id, never taken from the browser.

const cloudinary = require('cloudinary').v2;
const { coverUrl } = require('./openLibrary');

// Reuse your existing Cloudinary setup if the file exists; otherwise configure from .env.
try {
  require('../config/cloudinary');
} catch (e) {
  /* no config file, fall back to env below */
}

function ensureConfigured() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

const slugify = (s) =>
  String(s || 'book')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(options, (err, result) => (err ? reject(err) : resolve(result))).end(buffer);
  });
}

// Returns the Cloudinary https URL of the saved cover.
async function uploadCover({ coverId, bookId, title }) {
  ensureConfigured();

  const sourceUrl = `${coverUrl(coverId, 'L')}?default=false`; // 404 instead of a blank placeholder
  const options = {
    folder: 'library-books',
    public_id: `book-${bookId}-${slugify(title)}`,
    overwrite: true,
    invalidate: true,
    resource_type: 'image',
  };

  try {
    const result = await cloudinary.uploader.upload(sourceUrl, options);
    return result.secure_url;
  } catch (firstErr) {
    // Backup route: download the image ourselves, then upload the bytes.
    const res = await fetch(sourceUrl, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Cover image not available (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) throw new Error('Cover image was empty');
    const result = await uploadBuffer(buffer, options);
    return result.secure_url;
  }
}

module.exports = { uploadCover };
