require('dotenv').config(); // must be first so every file below can read .env

const express = require('express');
const helmet = require('helmet');
const corsConfig = require('./config/cors');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const registerRoutes = require('./routes/register');
const loginRoutes = require('./routes/login');
const categoryRoutes = require('./routes/categories');
const bookRoutes = require('./routes/books');
const uploadRoutes = require('./routes/upload');
const userRoutes = require('./routes/users');
const userBlockRoutes = require('./routes/userBlock');
const passwordRoutes = require('./routes/password');

const app = express();

// When hosted behind a proxy (Render, Railway, Vercel...), set TRUST_PROXY=1 in the environment
// so rate limiting sees each visitor's real address instead of the proxy's.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

app.use(helmet());
app.use(corsConfig);
app.use(express.json());

app.use('/api/register', registerRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/users/password', passwordRoutes); // keep above /api/users
app.use('/api/users', userBlockRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);

// Simple check that the server is up (used by hosting services). Reveals nothing about the database.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.send('Library server is running');
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
