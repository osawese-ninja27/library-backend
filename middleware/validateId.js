// Use with router.param('id', validateId) so a bad id like /books/abc returns 400, not a server error.
function validateId(req, res, next, value) {
  if (!/^\d+$/.test(value)) {
    return res.status(400).json({ error: 'Invalid id.' });
  }
  next();
}

module.exports = validateId;
