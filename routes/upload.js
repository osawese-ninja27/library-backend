const express = require('express');
const cloudinary = require('../config/cloudinary');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const uploadImage = require('../middleware/uploadImage');

const router = express.Router();

router.post('/', requireAuth, requireAdmin, uploadImage, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  try {
    // Convert the file buffer into a format Cloudinary's upload function accepts
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'library-books', // keeps uploads organized in Cloudinary's dashboard
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong uploading the image.' });
  }
});

module.exports = router;