const express = require('express');
const pool = require('./db');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const bookRoutes = require('./routes/books');
const uploadRoutes = require('./routes/upload');
const userRoutes = require('./routes/users');
const app = express();

app.use(express.json());
app.use(cors());
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database connection failed' });
  }
});

app.get('/', (req, res) => {
  res.send('Library server is running');
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});