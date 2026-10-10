// Runs when no route matched.
function notFound(req, res) {
  res.status(404).json({ error: 'Route not found.' });
}

// Runs when something throws and no route handled it. Never leaks internal details to the client.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Malformed JSON in the request body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'This website is not allowed to use the API.' });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
}

module.exports = { notFound, errorHandler };
