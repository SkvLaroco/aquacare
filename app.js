// The Express application (routes + middleware).
// It is exported, not started here, so it can be used by:
//   - server.js                       (local development: app.listen)
//   - netlify/functions/api.js        (Netlify: wrapped as a serverless function)
const path = require('path');
const express = require('express');
const taskRoutes = require('./routes/taskRoutes');
const { connectDB } = require('./db');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Make sure the database is connected before an API route runs.
async function withDb(req, res, next) {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    res.status(500).json({ message: 'Database connection failed' });
  }
}

// "/.netlify/functions/api" is the raw Netlify function path; it is accepted
// as well so the API works whichever URL form Netlify passes to the function.
const API_BASES = ['/api', '/.netlify/functions/api'];

app.get(API_BASES.map((base) => base + '/health'), withDb, (req, res) => {
  res.status(200).json({ status: 'ok', database: 'connected' });
});

app.use(API_BASES.map((base) => base + '/tasks'), withDb, taskRoutes);

// Unknown /api routes -> JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Error handler (e.g. malformed JSON in a request body)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

module.exports = app;
