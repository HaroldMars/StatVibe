// Vercel serverless entry point.
// Delegates every /api/* request to the shared request handler in server.js,
// so the exact same backend code runs locally (node server.js) and on Vercel.
const app = require('../server.js');

module.exports = (req, res) => app.handler(req, res);
