// Netlify Function: wraps the Express app so it can run serverless.
const serverless = require('serverless-http');
const app = require('../../app');

module.exports.handler = serverless(app);
