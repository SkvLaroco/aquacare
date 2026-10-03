// Database connection helper.
// The connection is cached so it can be reused. This matters on Netlify,
// where the Express app runs as a serverless function that may be started
// many times; without caching, every request would open a new connection.
const mongoose = require('mongoose');

const cached = global._aquacareMongo || (global._aquacareMongo = { conn: null, promise: null });

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to your .env file (local) or Netlify environment variables.');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'aquacare',
      serverSelectionTimeoutMS: 8000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow a retry on the next request
    throw err;
  }
  return cached.conn;
}

module.exports = { connectDB };
