/**
 * Express entry for StatVibe API on Vercel.
 * CORS trusts CLIENT_URL (and optional CLIENT_URLS), plus *.vercel.app previews.
 *
 * Setup (Vercel → Project → Environment Variables):
 *   CLIENT_URL=https://stat-vibe.vercel.app
 *   DATABASE_URL=...
 *   JWT_SECRET=...
 */
'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const serverMod = require('./server');
const handle = serverMod.requestHandler || serverMod.handler;

function parseOriginList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const allow = new Set([
    ...parseOriginList(process.env.CLIENT_URL),
    ...parseOriginList(process.env.CLIENT_URLS),
    'https://stat-vibe.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ]);
  if (allow.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // Dynamically reflect CLIENT_URL / allowlist — never hard-code only one host.
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
  })
);

// Do not use express.json() — server.js reads the raw body stream via readBody().
app.all('/api', (req, res) => handle(req, res));
app.all('/api/*', (req, res) => handle(req, res));

// Local convenience: serve built client if present
const clientDist = path.join(__dirname, '../statvibe-client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

module.exports = app;

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`StatVibe API listening on http://localhost:${port}`);
    console.log(`CLIENT_URL=${process.env.CLIENT_URL || '(default allowlist)'}`);
  });
}
