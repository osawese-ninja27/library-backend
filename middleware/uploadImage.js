const multer = require('multer');

const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Keep the file in memory (not on disk), but only accept small images.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return callback(new Error('INVALID_IMAGE_TYPE'));
    }
    callback(null, true);
  },
}).single('image');

// Wraps multer so upload problems become clear 400 responses instead of server errors.
function uploadImage(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `Image must be ${MAX_SIZE_MB} MB or smaller.` });
    }
    if (err.message === 'INVALID_IMAGE_TYPE') {
      return res.status(400).json({ error: 'Only JPG, PNG or WebP images are allowed.' });
    }
    return res.status(400).json({ error: 'Could not read the uploaded file.' });
  });
}

module.exports = uploadImage;
