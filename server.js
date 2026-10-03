// Local development entry point: node server.js  (or: npm run dev)
require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./db');

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log('AquaCare running at http://localhost:' + PORT);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
