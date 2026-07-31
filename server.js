// StatVibe — application server
// Zero runtime dependencies (Node built-ins only). Serves the SPA, proxies AI
// requests to a local Ollama instance (with a simulated fallback), and exposes
// a token-gated admin/developer API. Designed to run as-is in production.

const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const auth = require('./lib/auth');
const usageLib = require('./lib/usage');
const aiLib = require('./lib/ai');
const paymongo = require('./lib/paymongo');
const { PLAN_LIMITS, PLAN_PRICES, ensureUsage, usageView, canConsume, billTokens, countMessageTokens } = usageLib;

// Load .env (if present) into process.env before reading any config. Minimal,
// dependency-free parser: `KEY=value`, `#` comments, optional quotes. Existing
// environment variables always win over the file.
function loadEnvFile() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][\w.-]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch { /* no .env file — fine */ }
}
loadEnvFile();

const VERSION = '1.0.0';
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';
const OLLAMA = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const ADMIN_USER = process.env.ADMIN_USER || 'GenAdmin';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'genadmin-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'genadmin-2026';
const ADMIN_SESSION_TTL = 12 * 3600 * 1000; // 12 hours
const PUBLIC_DIR = path.join(__dirname, 'public');
const DIST_DIR = path.join(__dirname, 'dist');
// Dev serves live source from public/; production serves the built dist/.
// (On Vercel, static is served by @vercel/static-build → dist; this only
// affects the standalone `node server.js`.)
const STATIC_DIR = (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(DIST_DIR, 'index.html'))) ? DIST_DIR : PUBLIC_DIR;
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const MAX_BODY = 256 * 1024; // 256 KiB cap on request bodies
const START = Date.now();

// --- Runtime config (admin-editable, persisted to disk) -------------------
const DEFAULT_CONFIG = {
  simulateOnly: false, // force the simulated engine even if Ollama is up
  defaultBlend: true, // Blend mode default in the AI workspace
  cloudAvailable: {}, // { claude: true } flips a cloud model to "available"
};
let config = { ...DEFAULT_CONFIG };
function loadConfig() {
  try {
    config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch { /* first run — keep defaults */ }
}
function saveConfig() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) { log('warn', 'could not persist config: ' + e.message); }
}

// --- Lightweight metrics + logging ----------------------------------------
const metrics = { requests: 0, chats: 0, aiErrors: 0, simulated: 0, byModel: {}, tokens: { total: 0, prompt: 0, completion: 0, byModel: {} }, recent: [] };
const estTokens = (s) => Math.ceil((String(s || '').length) / 4); // rough approximation
function recordTokens(model, promptText, completionText) {
  const p = estTokens(promptText), c = estTokens(completionText);
  metrics.tokens.total += p + c; metrics.tokens.prompt += p; metrics.tokens.completion += c;
  const m = (metrics.tokens.byModel[model] ||= { prompt: 0, completion: 0, total: 0 });
  m.prompt += p; m.completion += c; m.total += p + c;
}
function log(level, msg) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`;
  (level === 'error' ? console.error : console.log)(line);
  metrics.recent.unshift(line);
  if (metrics.recent.length > 50) metrics.recent.pop();
}

const CLOUD_MODELS = [
  { id: 'claude', label: 'Claude', vendor: 'Anthropic' },
  { id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI' },
  { id: 'gemini', label: 'Gemini', vendor: 'Google' },
  { id: 'grok', label: 'Grok', vendor: 'xAI' },
];

// Supported display currencies (symbol + decimal places).
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', dp: 2 },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', dp: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', dp: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', dp: 2 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', dp: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', dp: 0 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', dp: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', dp: 2 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', dp: 2 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', dp: 2 },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', dp: 2 },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', dp: 2 },
];
const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));
const SESSION_TTL = 365 * 24 * 3600 * 1000; // registered: stay signed in ~1 year, sliding on each request (until logout)
const GUEST_SESSION_TTL = 12 * 3600 * 1000; // guests: 12 hours, never persisted on the client
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map(); // key → { count, resetAt }
let _lastTs = 0;
function monotonicNow() { const t = Date.now(); _lastTs = t > _lastTs ? t : _lastTs + 1; return _lastTs; }
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

// Allow Google Fonts (used by the design system) but otherwise lock things down.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https://res.cloudinary.com; " +
    "script-src 'self'; " +
    "connect-src 'self'; " +
    "worker-src 'self'; " +
    "manifest-src 'self'; " +
    "frame-ancestors 'self'",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '', size = 0, done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > MAX_BODY) { done = true; req.pause(); reject(new Error('Body too large')); return; }
      body += c;
    });
    req.on('end', () => { if (!done) { done = true; resolve(body); } });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

// --- Ollama helpers -------------------------------------------------------
function ollamaRequest(method, urlPath, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, OLLAMA);
    const data = payload ? JSON.stringify(payload) : null;
    const req = http.request(
      {
        hostname: u.hostname, port: u.port || 11434, path: u.pathname + u.search, method,
        headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
        timeout: 120000,
      },
      (r) => { let buf = ''; r.on('data', (c) => (buf += c)); r.on('end', () => resolve({ status: r.statusCode, body: buf })); }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Ollama request timed out')));
    if (data) req.write(data);
    req.end();
  });
}
async function listOllamaModels() {
  try {
    const { status, body } = await ollamaRequest('GET', '/api/tags');
    if (status !== 200) return [];
    return (JSON.parse(body).models || []).map((m) => m.name);
  } catch { return []; }
}

function simulate(messages) {
  return aiLib.simulate(messages);
}

// --- Hosted LLM (OpenAI-compatible: Groq, OpenRouter, Together, OpenAI…) -----
// Used automatically when Ollama isn't reachable (e.g. on Vercel) and AI_API_URL
// + AI_API_KEY are set. Local dev keeps using Ollama.
const AI_API_URL = process.env.AI_API_URL;   // e.g. https://api.groq.com/openai/v1/chat/completions
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'llama-3.1-8b-instant';
const hostedConfigured = () => !!(AI_API_URL && AI_API_KEY);
async function callHostedAI(messages) {
  const r = await fetch(AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + AI_API_KEY },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.35,
      max_tokens: 1800,
      stream: false,
    }),
  });
  if (!r.ok) throw new Error('status ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const d = await r.json();
  const content = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  return { model: AI_MODEL, content, usage: d.usage };
}
function recordUsage(model, usage, promptText, content) {
  if (usage && (usage.prompt_tokens || usage.completion_tokens)) {
    const p = usage.prompt_tokens || 0, c = usage.completion_tokens || 0;
    metrics.tokens.total += p + c; metrics.tokens.prompt += p; metrics.tokens.completion += c;
    const m = (metrics.tokens.byModel[model] ||= { prompt: 0, completion: 0, total: 0 });
    m.prompt += p; m.completion += c; m.total += p + c;
  } else { recordTokens(model, promptText, content); }
}

// --- API handlers ---------------------------------------------------------
async function handleModels(res) {
  const local = config.simulateOnly ? [] : await listOllamaModels();
  const ollamaModels = local.map((name) => ({
    id: name, label: name.split(':')[0].replace(/^\w/, (c) => c.toUpperCase()),
    vendor: 'Ollama (local)', kind: 'local', available: true,
  }));
  const engines = ollamaModels.length
    ? ollamaModels
    : hostedConfigured()
      ? [{ id: AI_MODEL, label: AI_MODEL, vendor: 'Hosted AI', kind: 'hosted', available: true }]
      : [{ id: 'simulated', label: 'Simulated', vendor: 'StatVibe demo', kind: 'local', available: true }];
  const cloud = CLOUD_MODELS.map((c) => ({ ...c, kind: 'cloud', available: !!config.cloudAvailable[c.id] }));
  sendJSON(res, 200, { ollama_online: ollamaModels.length > 0, hosted: hostedConfigured(), simulate_only: config.simulateOnly, default_blend: config.defaultBlend, admin_user: ADMIN_USER, engines, cloud });
}

async function handleChat(req, res, body) {
  // Metered AI requires a signed-in account so Free weekly token limits can be enforced.
  const authed = await getAuthUser(req);
  if (!authed) {
    return sendJSON(res, 401, {
      error: 'Sign in to use AI. Create a free account to get weekly AI tokens.',
      code: 'not_signed_in',
    });
  }
  const { user } = authed;

  let payload;
  try { payload = JSON.parse(body || '{}'); } catch { return sendJSON(res, 400, { error: 'Invalid JSON' }); }
  const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!rawMessages.length) return sendJSON(res, 400, { error: 'messages[] required' });

  let acct = ensureUsage(await store.getAccount(user.id) || blankAccount());
  const gate = canConsume(acct, 1);
  if (!gate.ok) {
    await store.setAccount(user.id, gate.account); // persist rolled period if any
    log('info', 'AI quota exceeded ' + (user.email || user.id) + ' plan=' + gate.account.plan);
    return sendJSON(res, 402, {
      error: gate.error,
      code: gate.code,
      usage: usageView(gate.account),
      upgradeRequired: true,
    });
  }
  acct = gate.account;

  metrics.chats++;
  const requested = payload.model;

  // Authoritative system prompt + business context so every answer targets the user's ask.
  const messages = aiLib.enrichMessages(rawMessages, { account: acct, user });
  const promptText = messages.map((m) => m.content).join('\n');
  const isCloud = CLOUD_MODELS.some((c) => c.id === requested);

  async function finish(content, { model, simulated, note, tokUsage } = {}) {
    const tokens = countMessageTokens(tokUsage, promptText, content);
    if (tokUsage && (tokUsage.prompt_tokens || tokUsage.completion_tokens)) {
      recordUsage(model, tokUsage, promptText, content);
    } else {
      recordTokens(model || 'simulated', promptText, content);
    }
    const billed = billTokens(acct, tokens);
    acct = billed.account;
    await store.setAccount(user.id, acct);
    metrics.byModel[model || 'simulated'] = (metrics.byModel[model || 'simulated'] || 0) + 1;
    return sendJSON(res, 200, {
      simulated: !!simulated,
      model: model || 'simulated',
      content,
      note,
      usage: usageView(acct),
      tokensBilled: tokens,
    });
  }

  if (config.simulateOnly) {
    metrics.simulated++;
    return finish(simulate(messages), { model: 'simulated', simulated: true });
  }

  // Prefer real hosted/local AI over cloud-label simulation so answers stay accurate.
  if (isCloud && hostedConfigured()) {
    try {
      const out = await callHostedAI(messages);
      return finish(out.content, {
        model: out.model,
        simulated: false,
        note: `${requested} routes through hosted AI for accurate answers.`,
        tokUsage: out.usage,
      });
    } catch (e) { metrics.aiErrors++; log('warn', 'hosted AI (cloud route): ' + e.message); }
  }
  if (isCloud) {
    metrics.simulated++;
    return finish(simulate(messages), {
      model: requested || 'simulated',
      simulated: true,
      note: `${requested} is unavailable live — answering from the focused simulator.`,
    });
  }

  const local = await listOllamaModels();
  let model = null;
  if (requested && local.some((m) => m === requested || m.split(':')[0] === requested)) {
    model = local.find((m) => m === requested) || local.find((m) => m.split(':')[0] === requested);
  } else if (local.length) { model = local[0]; }

  if (!model) {
    if (hostedConfigured()) {
      try {
        const out = await callHostedAI(messages);
        return finish(out.content, { model: out.model, simulated: false, tokUsage: out.usage });
      } catch (e) { metrics.aiErrors++; log('warn', 'hosted AI: ' + e.message); }
    }
    metrics.simulated++;
    return finish(simulate(messages), { model: 'simulated', simulated: true });
  }

  try {
    const { status, body: rb } = await ollamaRequest('POST', '/api/chat', {
      model, messages, stream: false, options: { temperature: payload.temperature ?? 0.35 },
    });
    if (status !== 200) throw new Error('Ollama status ' + status);
    const parsed = JSON.parse(rb);
    const content = parsed.message ? parsed.message.content : (parsed.response || '');
    const tokUsage = (parsed.prompt_eval_count || parsed.eval_count)
      ? { prompt_tokens: parsed.prompt_eval_count || 0, completion_tokens: parsed.eval_count || 0 }
      : null;
    return finish(content, { model, simulated: false, tokUsage });
  } catch (e) {
    metrics.aiErrors++;
    if (hostedConfigured()) {
      try {
        const out = await callHostedAI(messages);
        return finish(out.content, { model: out.model, simulated: false, tokUsage: out.usage });
      } catch (e2) { metrics.aiErrors++; log('warn', 'hosted AI after ollama fail: ' + e2.message); }
    }
    metrics.simulated++;
    log('warn', 'chat fallback: ' + e.message);
    return finish(simulate(messages), { model: 'simulated', simulated: true, note: String(e.message || e) });
  }
}

function handleHealth(res) {
  return Promise.all([listOllamaModels(), store.backend()]).then(([m, storage]) =>
    sendJSON(res, 200, {
      status: 'ok', version: VERSION, uptime_s: Math.round((Date.now() - START) / 1000),
      ollama: { host: OLLAMA, online: m.length > 0, models: m }, hosted_ai: hostedConfigured(), simulate_only: config.simulateOnly, admin_user: ADMIN_USER,
      storage,
    })
  );
}

// --- Admin (developer accounts) -------------------------------------------
// Seed the first ("founder") admin from env if none exist yet.
async function seedFounder() {
  if (await store.countAdmins()) return;
  await store.createAdmin({ username: ADMIN_USER.toLowerCase(), displayName: ADMIN_USER, role: 'founder', passwordHash: auth.hashPassword(ADMIN_PASSWORD), createdAt: Date.now() });
  log('info', `Seeded founder admin "${ADMIN_USER}" (change ADMIN_PASSWORD in production)`);
}

// An admin request is authorized by a valid admin session token, or the static
// ADMIN_TOKEN (kept for automation/back-compat). Returns the admin or null.
async function adminFromReq(req) {
  const t = req.headers['x-admin-token'] || (/^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '') || [])[1] || '';
  if (!t) return null;
  if (t === ADMIN_TOKEN) return { username: ADMIN_USER.toLowerCase(), displayName: ADMIN_USER, role: 'founder', viaToken: true };
  const s = await store.getAdminSession(t);
  if (!s) return null;
  const a = await store.getAdminByUsername(s.username);
  return a ? { username: a.username, displayName: a.displayName, role: a.role } : null;
}

async function handleAdmin(req, res, sub, body) {
  // Public admin endpoint: login with username + password.
  if (sub === 'login' && req.method === 'POST') {
    let b; try { b = JSON.parse(body || '{}'); } catch { return sendJSON(res, 400, { error: 'Invalid JSON' }); }
    const a = await store.getAdminByUsername(b.username || '');
    if (!a || !auth.verifyPassword(b.password || '', a.passwordHash)) return sendJSON(res, 401, { error: 'Incorrect username or password' });
    const token = auth.newToken();
    await store.createAdminSession({ token, username: a.username, createdAt: Date.now(), expiresAt: Date.now() + ADMIN_SESSION_TTL });
    log('info', `admin login: ${a.username}`);
    return sendJSON(res, 200, { token, admin: { username: a.username, displayName: a.displayName, role: a.role } });
  }

  const admin = await adminFromReq(req);
  if (!admin) return sendJSON(res, 401, { error: 'Unauthorized — sign in to the developer console' });

  if (sub === 'me' && req.method === 'GET') return sendJSON(res, 200, { admin });
  if (sub === 'logout' && req.method === 'POST') { const t = req.headers['x-admin-token'] || (/^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '') || [])[1]; if (t) await store.deleteAdminSession(t); return sendJSON(res, 200, { ok: true }); }

  // Founder-only: manage other developer admins
  if (sub === 'accounts' && req.method === 'GET') {
    if (admin.role !== 'founder') return sendJSON(res, 403, { error: 'Founder only' });
    return sendJSON(res, 200, { admins: await store.listAdmins() });
  }
  if (sub === 'accounts' && req.method === 'POST') {
    if (admin.role !== 'founder') return sendJSON(res, 403, { error: 'Founder only' });
    let b; try { b = JSON.parse(body || '{}'); } catch { return sendJSON(res, 400, { error: 'Invalid JSON' }); }
    const username = String(b.username || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return sendJSON(res, 400, { error: 'Username: 3–32 chars, letters/numbers/._-' });
    if (!auth.passwordOk(b.password)) return sendJSON(res, 400, { error: 'Password must be at least 8 characters' });
    if (await store.getAdminByUsername(username)) return sendJSON(res, 409, { error: 'That developer username already exists' });
    await store.createAdmin({ username, displayName: (b.displayName || b.username).trim(), role: b.role === 'founder' ? 'founder' : 'developer', passwordHash: auth.hashPassword(b.password), createdAt: Date.now() });
    log('info', `admin created developer: ${username}`);
    return sendJSON(res, 201, { ok: true, admins: await store.listAdmins() });
  }
  if (sub === 'accounts/delete' && req.method === 'POST') {
    if (admin.role !== 'founder') return sendJSON(res, 403, { error: 'Founder only' });
    let b; try { b = JSON.parse(body || '{}'); } catch { return sendJSON(res, 400, { error: 'Invalid JSON' }); }
    const target = String(b.username || '').toLowerCase();
    if (target === admin.username) return sendJSON(res, 400, { error: "You can't delete your own account" });
    await store.deleteAdmin(target);
    return sendJSON(res, 200, { ok: true, admins: await store.listAdmins() });
  }

  if (sub === 'summary' && req.method === 'GET') {
    const local = await listOllamaModels();
    const userStats = await store.adminUserStats();
    const payStats = await store.paymentStats();
    return sendJSON(res, 200, {
      version: VERSION, uptime_s: Math.round((Date.now() - START) / 1000),
      admin_user: ADMIN_USER, node: process.version, pid: process.pid, port: PORT,
      ollama: { host: OLLAMA, online: local.length > 0, models: local },
      config, metrics: { ...metrics, recent: metrics.recent.slice(0, 12) },
      memory_mb: Math.round(process.memoryUsage().rss / 1048576),
      users: userStats,
      payments: payStats,
      privacy: {
        note: 'Admin can see account directory + aggregate ops metrics only. Passwords, chat messages, AI prompts, phone numbers, and payment provider payloads are never exposed.',
      },
    });
  }
  if (sub === 'users' && req.method === 'GET') {
    const accounts = await store.accountsMap();
    const users = await store.listUsers();
    const rows = await Promise.all(users.map(async (u) => ({
      id: u.id,
      name: u.name || null,
      email: u.isGuest ? null : (u.email || null),
      tag: u.tag,
      isGuest: !!u.isGuest,
      createdAt: u.createdAt,
      business: (accounts[u.id] && accounts[u.id].businessName) || null,
      currency: (accounts[u.id] && accounts[u.id].currency) || null,
      setup: !!(accounts[u.id] && accounts[u.id].setupComplete),
      plan: (accounts[u.id] && accounts[u.id].plan) || 'Free',
      items: await store.inventoryCount(u.id),
    })));
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return sendJSON(res, 200, { users: rows });
  }
  if (sub === 'payments' && req.method === 'GET') {
    const payments = await store.listPayments(80);
    return sendJSON(res, 200, { payments });
  }
  if (sub === 'config' && req.method === 'POST') {
    let patch; try { patch = JSON.parse(body || '{}'); } catch { return sendJSON(res, 400, { error: 'Invalid JSON' }); }
    if (typeof patch.simulateOnly === 'boolean') config.simulateOnly = patch.simulateOnly;
    if (typeof patch.defaultBlend === 'boolean') config.defaultBlend = patch.defaultBlend;
    if (patch.cloudAvailable && typeof patch.cloudAvailable === 'object') {
      for (const k of Object.keys(patch.cloudAvailable)) config.cloudAvailable[k] = !!patch.cloudAvailable[k];
    }
    saveConfig(); log('info', 'admin updated config');
    return sendJSON(res, 200, { ok: true, config });
  }
  if (sub === 'reset' && req.method === 'POST') {
    config = { ...DEFAULT_CONFIG, cloudAvailable: {} }; saveConfig(); log('info', 'admin reset config');
    return sendJSON(res, 200, { ok: true, config });
  }
  return sendJSON(res, 404, { error: 'Unknown admin endpoint' });
}

// --- Auth / accounts / inventory ------------------------------------------
function parseJSON(body) { try { return JSON.parse(body || '{}'); } catch { return null; } }

function clientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function allowLoginAttempt(key) {
  const now = Date.now();
  let row = loginAttempts.get(key);
  if (!row || row.resetAt <= now) {
    row = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(key, row);
  }
  row.count += 1;
  return row.count <= LOGIN_MAX_ATTEMPTS;
}

function clearLoginAttempts(key) { loginAttempts.delete(key); }

async function getAuthUser(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const token = m[1].trim();
  if (!token) return null;
  const s = await store.getSession(token);
  if (!s) {
    log('warn', 'auth miss — no session for token prefix ' + token.slice(0, 8));
    return null;
  }
  const u = await store.getUserById(s.userId);
  if (!u) {
    await store.deleteSession(token);
    log('warn', 'auth miss — session user gone ' + s.userId);
    return null;
  }
  // Sliding ~1-year window for registered accounts; shorter for guests.
  // touchSession only persists periodically to reduce durable-store write races.
  const ttl = u.isGuest ? GUEST_SESSION_TTL : SESSION_TTL;
  await store.touchSession(token, Date.now() + ttl);
  return { user: u, token };
}

async function assertSessionSaved(token) {
  // Cloudinary/CDN can lag briefly after write — retry a few times before failing the auth response.
  for (let i = 0; i < 4; i++) {
    const s = await store.getSession(token);
    if (s) return s;
    await new Promise((r) => setTimeout(r, 120 * (i + 1)));
  }
  return null;
}

function blankAccount() {
  return {
    setupComplete: false, businessName: null, industry: null, currency: 'USD', teamSize: null, goals: [], sellsProducts: true, plan: 'Free', createdAt: Date.now(),
    tutorialDone: false, tutorialCompletedAt: null,
    aiUsed: 0, aiPeriodStart: Date.now(),
    statsDraft: { revenue: '', products: '', avgPrice: '' },
    calc: { tab: 'Retail', unitCost: 42, freight: 5.72, overhead: 5.1, targetMargin: 55, markup: 55 },
    supply: { onHand: 0, reorder: 0, cover: 0 },
  };
}

function sanitizeStatsDraft(raw) {
  if (!raw || typeof raw !== 'object') return { revenue: '', products: '', avgPrice: '' };
  return {
    revenue: String(raw.revenue ?? '').slice(0, 40),
    products: String(raw.products ?? '').slice(0, 40),
    avgPrice: String(raw.avgPrice ?? '').slice(0, 40),
  };
}

function sanitizeCalc(raw) {
  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const tab = ['Retail', 'Product', 'Supply'].includes(raw && raw.tab) ? raw.tab : 'Retail';
  return {
    tab,
    unitCost: n(raw && raw.unitCost, 42),
    freight: n(raw && raw.freight, 5.72),
    overhead: n(raw && raw.overhead, 5.1),
    targetMargin: n(raw && raw.targetMargin, 55),
    markup: n(raw && raw.markup, 55),
  };
}

function sanitizeSupply(raw) {
  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  return { onHand: n(raw && raw.onHand, 0), reorder: n(raw && raw.reorder, 0), cover: n(raw && raw.cover, 0) };
}

async function bootstrapUser(base) {
  const user = { id: auth.newId(base.isGuest ? 'g' : 'u'), tag: auth.newTag(), createdAt: Date.now(), ...base };
  try {
    await store.createUser(user);
    await store.setAccount(user.id, blankAccount());
    const token = auth.newToken();
    const ttl = user.isGuest ? GUEST_SESSION_TTL : SESSION_TTL;
    const expiresAt = Date.now() + ttl;
    await store.createSession({ token, userId: user.id, createdAt: Date.now(), expiresAt, lastSeenAt: Date.now() });
    const saved = await assertSessionSaved(token);
    if (!saved) {
      const err = new Error('persist_verify_failed');
      err.code = 'persist_failed';
      throw err;
    }
    return { token, user, expiresAt };
  } catch (e) {
    log('error', 'bootstrapUser failed: ' + (e && e.message));
    throw e;
  }
}

async function sessionPayload(res, status, token, user, expiresAt) {
  let account = await store.getAccount(user.id) || blankAccount();
  const prevUsed = account.aiUsed;
  const prevStart = account.aiPeriodStart;
  account = ensureUsage(account);
  if (account.aiUsed !== prevUsed || account.aiPeriodStart !== prevStart || account.aiLimit == null) {
    await store.setAccount(user.id, account);
  }
  const inventory = await store.listInventory(user.id);
  const sessionMeta = {
    expiresAt: expiresAt || null,
    ttlMs: user.isGuest ? GUEST_SESSION_TTL : SESSION_TTL,
    ttlDays: user.isGuest ? null : 365,
    persistent: !user.isGuest,
  };
  sendJSON(res, status, {
    token,
    user: auth.publicUser(user),
    account,
    inventory,
    session: sessionMeta,
    usage: usageView(account),
  });
}

async function handleAuth(req, res, sub, body) {
  // POST /api/auth/register|login|guest|logout|change-password ; GET /api/auth/me
  if (sub === 'register' && req.method === 'POST') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON', code: 'invalid_json' });
    const email = auth.normalizeEmail(b.email);
    const name = (b.name || '').trim();
    if (!name || name.length < 2) return sendJSON(res, 400, { error: 'Enter your full name', code: 'name_required' });
    if (!auth.emailOk(email)) return sendJSON(res, 400, { error: 'Enter a valid email address', code: 'invalid_email' });
    if (!auth.passwordOk(b.password)) {
      return sendJSON(res, 400, { error: auth.passwordHint, code: 'weak_password' });
    }
    if (!b.acceptedTerms) return sendJSON(res, 400, { error: 'You must accept the Terms & Privacy Policy', code: 'terms_required' });
    if (await store.getUserByEmail(email)) {
      log('info', 'register rejected — email taken: ' + email);
      return sendJSON(res, 409, { error: 'An account already exists with that email. Sign in instead.', code: 'email_taken' });
    }
    try {
      const { token, user, expiresAt } = await bootstrapUser({
        isGuest: false, email, name,
        phone: b.phone ? String(b.phone) : null, passwordHash: auth.hashPassword(b.password), termsAcceptedAt: Date.now(),
      });
      log('info', 'registered ' + user.email + ' (persistent session, login-ready)');
      return sessionPayload(res, 201, token, user, expiresAt);
    } catch (e) {
      return sendJSON(res, 503, {
        error: 'Could not save your account. Please try again in a moment.',
        code: 'persist_failed',
      });
    }
  }
  if (sub === 'login' && req.method === 'POST') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON', code: 'invalid_json' });
    const email = auth.normalizeEmail(b.email);
    const password = typeof b.password === 'string' ? b.password : '';
    const rateKey = clientKey(req) + '|' + email;
    if (!allowLoginAttempt(rateKey)) {
      log('warn', 'login rate-limited: ' + email);
      return sendJSON(res, 429, { error: 'Too many sign-in attempts. Try again in 15 minutes.', code: 'rate_limited' });
    }
    if (!auth.emailOk(email)) return sendJSON(res, 400, { error: 'Enter a valid email address', code: 'invalid_email' });
    if (!password) return sendJSON(res, 400, { error: 'Enter your password', code: 'password_required' });

    const u = await store.getUserByEmail(email);
    // Only existing registered accounts can sign in — do not push "create account" as the only path.
    if (!u || u.isGuest || !auth.isRegisteredUser(u)) {
      log('info', 'login failed — account not found: ' + email);
      return sendJSON(res, 401, {
        error: 'No account for that email. Check the spelling, or create an account if you are new.',
        code: 'account_not_found',
      });
    }
    if (!auth.verifyPassword(password, u.passwordHash)) {
      log('info', 'login failed — bad password: ' + email);
      return sendJSON(res, 401, { error: 'Incorrect email or password', code: 'invalid_credentials' });
    }
    clearLoginAttempts(rateKey);
    try {
      const token = auth.newToken();
      const expiresAt = Date.now() + SESSION_TTL;
      await store.createSession({
        token, userId: u.id, createdAt: Date.now(), expiresAt, lastSeenAt: Date.now(),
      });
      await store.updateUser(u.id, { lastLoginAt: Date.now() });
      const saved = await assertSessionSaved(token);
      if (!saved) {
        return sendJSON(res, 503, {
          error: 'Could not save your session. Please try again in a moment.',
          code: 'persist_failed',
        });
      }
      log('info', 'login ' + u.email + ' (session expires ' + new Date(expiresAt).toISOString() + ')');
      return sessionPayload(res, 200, token, u, expiresAt);
    } catch (e) {
      log('error', 'login persist failed: ' + (e && e.message));
      return sendJSON(res, 503, {
        error: 'Could not save your session. Please try again in a moment.',
        code: 'persist_failed',
      });
    }
  }
  if (sub === 'guest' && req.method === 'POST') {
    try {
      const { token, user, expiresAt } = await bootstrapUser({ isGuest: true, name: 'Guest' });
      log('info', 'guest session started ' + user.id);
      return sessionPayload(res, 201, token, user, expiresAt);
    } catch (e) {
      return sendJSON(res, 503, { error: 'Could not start guest session. Try again.', code: 'persist_failed' });
    }
  }

  // Authenticated below
  const authed = await getAuthUser(req);
  if (!authed) return sendJSON(res, 401, { error: 'Not signed in', code: 'not_signed_in' });
  const { user, token } = authed;

  if (sub === 'me' && req.method === 'GET') {
    // getAuthUser already slid the TTL — return the fresh expiry so the client stays in sync.
    const s = await store.getSession(token);
    return sessionPayload(res, 200, token, user, s && s.expiresAt);
  }
  if (sub === 'logout' && req.method === 'POST') {
    await store.deleteSession(token);
    log('info', 'logout ' + (user.email || user.id));
    return sendJSON(res, 200, { ok: true });
  }
  if (sub === 'change-password' && req.method === 'POST') {
    if (user.isGuest) return sendJSON(res, 403, { error: 'Guest accounts have no password' });
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    if (!auth.verifyPassword(b.currentPassword || '', user.passwordHash)) return sendJSON(res, 403, { error: 'Current password is incorrect' });
    if (!auth.passwordOk(b.newPassword)) return sendJSON(res, 400, { error: auth.passwordHint, code: 'weak_password' });
    await store.updateUser(user.id, { passwordHash: auth.hashPassword(b.newPassword) });
    await store.deleteSessionsForUser(user.id); // force re-login elsewhere
    const nt = auth.newToken();
    const expiresAt = Date.now() + SESSION_TTL;
    await store.createSession({
      token: nt, userId: user.id, createdAt: Date.now(), expiresAt, lastSeenAt: Date.now(),
    });
    log('info', 'password changed ' + user.email);
    return sendJSON(res, 200, { ok: true, token: nt, session: { expiresAt, ttlDays: 365 } });
  }
  return sendJSON(res, 404, { error: 'Unknown auth endpoint' });
}

async function handleAccount(req, res, sub, body) {
  const authed = await getAuthUser(req);
  if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
  const { user } = authed;

  if (sub === '' && req.method === 'GET') {
    return sendJSON(res, 200, { user: auth.publicUser(user), account: await store.getAccount(user.id), inventory: await store.listInventory(user.id) });
  }
  if (sub === 'setup' && req.method === 'POST') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    if (!b.businessName || !String(b.businessName).trim()) return sendJSON(res, 400, { error: 'Business name is required' });
    const currency = CURRENCY_CODES.has(b.currency) ? b.currency : 'USD';
    const prev = await store.getAccount(user.id) || blankAccount();
    const acct = { ...prev, setupComplete: true,
      businessName: String(b.businessName).trim(), industry: b.industry || null, currency,
      teamSize: b.teamSize || null, goals: Array.isArray(b.goals) ? b.goals : [], sellsProducts: b.sellsProducts !== false,
      // Fresh setup should see the first-run tutorial unless already completed.
      tutorialDone: !!prev.tutorialDone,
      tutorialCompletedAt: prev.tutorialCompletedAt || null,
    };
    await store.setAccount(user.id, acct);
    if (!user.isGuest && b.ownerName) await store.updateUser(user.id, { name: String(b.ownerName).trim() });
    log('info', 'setup complete ' + (user.email || user.id));
    return sendJSON(res, 200, { ok: true, account: acct });
  }
  if (sub === 'tutorial' && req.method === 'POST') {
    const b = parseJSON(body) || {};
    const acct = await store.getAccount(user.id) || blankAccount();
    acct.tutorialDone = true;
    acct.tutorialCompletedAt = Date.now();
    acct.tutorialAction = b.action === 'skip' ? 'skip' : 'complete';
    await store.setAccount(user.id, acct);
    log('info', 'tutorial ' + acct.tutorialAction + ' ' + (user.email || user.id));
    return sendJSON(res, 200, { ok: true, account: acct });
  }
  if (sub === '' && req.method === 'PATCH') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const acct = await store.getAccount(user.id) || blankAccount();
    if (b.currency !== undefined) { if (!CURRENCY_CODES.has(b.currency)) return sendJSON(res, 400, { error: 'Unsupported currency' }); acct.currency = b.currency; }
    if (b.businessName !== undefined) acct.businessName = String(b.businessName).trim();
    if (b.industry !== undefined) acct.industry = b.industry;
    // Plan changes only via paid PayMongo flow (/api/pay/status or /account/upgrade with verified intent).
    if (b.statsDraft !== undefined) acct.statsDraft = sanitizeStatsDraft(b.statsDraft);
    if (b.calc !== undefined) acct.calc = sanitizeCalc(b.calc);
    if (b.supply !== undefined) acct.supply = sanitizeSupply(b.supply);
    await store.setAccount(user.id, acct);
    return sendJSON(res, 200, { ok: true, account: acct });
  }
  if (sub === 'upgrade' && req.method === 'POST') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const plan = String(b.plan || '');
    if (!PLAN_PRICES.hasOwnProperty(plan)) return sendJSON(res, 400, { error: 'Unknown plan' });
    if (plan === 'Enterprise') return sendJSON(res, 400, { error: 'Enterprise — our team will reach out' });
    if (plan === 'Free') return sendJSON(res, 400, { error: 'Already on Free, or choose a paid plan' });

    const amount = PLAN_PRICES[plan] || 0;
    const intentId = b.paymentIntentId ? String(b.paymentIntentId) : '';

    // Live mode (.env has PayMongo keys): plan upgrades ONLY after PayMongo confirms payment.
    if (amount > 0 && paymongo.configured()) {
      if (!intentId) {
        return sendJSON(res, 402, {
          error: 'Pay with the PayMongo QR first. Your plan upgrades only after payment succeeds.',
          code: 'payment_required',
          plan,
          amount,
          currency: 'PHP',
        });
      }
      try {
        const intent = await paymongo.retrievePaymentIntent(intentId);
        if (!paymongo.intentSucceeded(intent)) {
          return sendJSON(res, 402, {
            error: 'Payment not completed yet. Scan the QR, then wait for confirmation.',
            code: 'payment_pending',
            status: paymongo.intentStatus(intent),
          });
        }
        const row = await store.findPaymentBySourceId(intentId);
        if (!row || row.userId !== user.id) {
          return sendJSON(res, 404, { error: 'Payment not found for this account', code: 'payment_not_found' });
        }
        if (row.plan && row.plan !== plan) {
          return sendJSON(res, 400, { error: 'Payment is for a different plan', code: 'plan_mismatch' });
        }
        const upgraded = await applyPaidPlan(user, plan, row);
        return sendJSON(res, 200, {
          ok: true,
          account: upgraded.account,
          payment: await store.findPaymentBySourceId(intentId),
          usageLimit: PLAN_LIMITS[plan] || PLAN_LIMITS.Free,
          usage: upgraded.usage,
        });
      } catch (e) {
        return sendJSON(res, 502, { error: 'Could not verify payment: ' + e.message, code: 'paymongo_error' });
      }
    }

    // No PayMongo keys in .env (local/tests only) — allow recording a demo upgrade.
    const acct = ensureUsage(await store.getAccount(user.id) || blankAccount());
    const prev = acct.plan || 'Free';
    acct.plan = plan;
    acct.aiUsed = 0;
    acct.aiPeriodStart = Date.now();
    const normalized = ensureUsage(acct);
    await store.setAccount(user.id, normalized);
    const payment = await store.addPayment({
      id: auth.newId('pay'),
      userId: user.id,
      email: user.isGuest ? null : (user.email || null),
      name: user.name || null,
      plan,
      previousPlan: prev,
      amount,
      currency: 'PHP',
      status: amount > 0 ? 'demo' : 'free',
      source: 'in-app-upgrade',
      createdAt: Date.now(),
    });
    log('info', `plan upgrade ${user.id} ${prev} → ${plan} (demo — PayMongo not in .env)`);
    return sendJSON(res, 200, {
      ok: true,
      account: normalized,
      payment,
      usageLimit: PLAN_LIMITS[plan] || PLAN_LIMITS.Free,
      usage: usageView(normalized),
    });
  }
  if (sub === '' && req.method === 'DELETE') {
    await store.deleteUser(user.id); log('info', 'deleted account ' + user.id);
    return sendJSON(res, 200, { ok: true });
  }
  return sendJSON(res, 404, { error: 'Unknown account endpoint' });
}

function normalizeItem(b) {
  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  return {
    id: auth.newId('itm'),
    name: String(b.name || 'Untitled').trim(),
    sku: b.sku ? String(b.sku).trim() : null,
    category: b.category ? String(b.category).trim() : null,
    stock: num(b.stock),
    unit: b.unit ? String(b.unit).trim() : 'units',
    price: num(b.price),
    cost: num(b.cost),
    quantity: num(b.quantity) || null,   // pack/quantity per unit
    size: b.size ? String(b.size).trim() : null,
    weight: b.weight ? String(b.weight).trim() : null,
    ratePerDay: num(b.ratePerDay),       // units consumed/sold per day
    rateBasis: b.rateBasis === 'consumption' ? 'consumption' : 'sales',
    createdAt: Date.now(),
  };
}

async function handleInventory(req, res, sub, body) {
  const authed = await getAuthUser(req);
  if (!authed) return sendJSON(res, 401, { error: 'Not signed in', code: 'not_signed_in' });
  const { user } = authed;

  if (sub === '' && req.method === 'GET') return sendJSON(res, 200, { inventory: await store.listInventory(user.id) });
  if (sub === '' && req.method === 'POST') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    if (!b.name || !String(b.name).trim()) return sendJSON(res, 400, { error: 'Item name is required' });
    const item = await store.addInventory(user.id, normalizeItem(b));
    log('info', 'inventory add ' + (user.email || user.id) + ' · ' + item.name);
    return sendJSON(res, 201, { item });
  }
  // /api/inventory/:id
  const id = sub;
  if (id && req.method === 'PATCH') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const patch = {};
    for (const k of ['name', 'sku', 'category', 'unit', 'size', 'weight', 'rateBasis']) if (b[k] !== undefined) patch[k] = b[k];
    for (const k of ['stock', 'price', 'cost', 'quantity', 'ratePerDay']) if (b[k] !== undefined) patch[k] = Number(b[k]) || 0;
    const it = await store.updateInventory(user.id, id, patch);
    return it ? sendJSON(res, 200, { item: it }) : sendJSON(res, 404, { error: 'Item not found' });
  }
  if (id && req.method === 'DELETE') { await store.deleteInventory(user.id, id); return sendJSON(res, 200, { ok: true }); }
  return sendJSON(res, 404, { error: 'Unknown inventory endpoint' });
}

// Days-to-last prediction: deterministic math + an optional LLM insight sentence.
async function handlePredict(req, res, body) {
  const authed = await getAuthUser(req);
  if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
  const { user } = authed;
  const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });

  let item = null;
  if (b.itemId) { item = (await store.listInventory(user.id)).find((x) => x.id === b.itemId) || null; if (!item) return sendJSON(res, 404, { error: 'Item not found' }); }
  const stock = item ? item.stock : Number(b.stock) || 0;
  const rate = item ? item.ratePerDay : Number(b.ratePerDay) || 0;
  const name = item ? item.name : (b.name || 'this product');
  const basis = (item ? item.rateBasis : b.rateBasis) || 'sales';

  if (rate <= 0) return sendJSON(res, 200, { days: null, note: `Add a daily ${basis} rate for “${name}” to project how long stock will last.` });
  const days = Math.floor(stock / rate);
  const runoutDate = new Date(Date.now() + days * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  // Human-readable horizon: days → weeks → months
  const human = days >= 60 ? `~${(days / 30).toFixed(1)} months` : days >= 14 ? `~${(days / 7).toFixed(1)} weeks` : `${days} days`;

  // LLM insight (best-effort). Falls back to a computed message.
  const local = config.simulateOnly ? [] : await listOllamaModels();
  let note = `At ~${rate}/${'day'} (${basis}), ${stock} ${item ? item.unit : 'units'} of ${name} lasts about ${days} days — runs out around ${runoutDate}.`;
  if (local.length) {
    try {
      metrics.chats++;
      const { status, body: rb } = await ollamaRequest('POST', '/api/chat', { model: local[0], stream: false, options: { temperature: 0.4 },
        messages: [
          { role: 'system', content: 'You are StatVibe, a concise inventory analyst. Reply in ONE short sentence (max 30 words) with a practical reorder recommendation. No preamble.' },
          { role: 'user', content: `Product "${name}": ${stock} ${item ? item.unit : 'units'} in stock, ${basis} rate ${rate}/day, so ~${days} days of cover (out ~${runoutDate}). Give a reorder recommendation.` },
        ] });
      if (status === 200) { const parsed = JSON.parse(rb); const c = (parsed.message && parsed.message.content || '').trim(); if (c) { note = c; metrics.byModel[local[0]] = (metrics.byModel[local[0]] || 0) + 1; recordTokens(local[0], `${name} ${stock} ${rate} ${basis}`, c); } }
    } catch (e) { metrics.aiErrors++; log('warn', 'predict LLM: ' + e.message); }
  } else if (hostedConfigured()) {
    try {
      metrics.chats++;
      const { model: hm, content, usage } = await callHostedAI([
        { role: 'system', content: 'You are StatVibe, a concise inventory analyst. Reply in ONE short sentence (max 30 words) with a practical reorder recommendation. No preamble.' },
        { role: 'user', content: `Product "${name}": ${stock} ${item ? item.unit : 'units'} in stock, ${basis} rate ${rate}/day, so ~${days} days of cover (out ~${runoutDate}). Give a reorder recommendation.` },
      ]);
      if (content.trim()) { note = content.trim(); metrics.byModel[hm] = (metrics.byModel[hm] || 0) + 1; recordUsage(hm, usage, `${name} ${stock} ${rate} ${basis}`, content); }
    } catch (e) { metrics.aiErrors++; log('warn', 'predict hosted AI: ' + e.message); }
  } else { metrics.simulated++; }

  const status = days <= 3 ? 'critical' : days <= 10 ? 'low' : 'healthy';
  return sendJSON(res, 200, { days, human, runoutDate, status, rate, basis, ai: local.length > 0 || hostedConfigured(), note });
}

function handleMeta(res) {
  sendJSON(res, 200, {
    currencies: CURRENCIES,
    cloudinary: CLOUDINARY_CLOUD_NAME ? { enabled: true, cloudName: CLOUDINARY_CLOUD_NAME } : { enabled: false, cloudName: null },
  });
}

// --- Idea Hub -------------------------------------------------------------
async function handleIdeas(req, res, sub, body) {
  const authed = await getAuthUser(req);
  if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
  const { user } = authed;
  if (sub === '' && req.method === 'GET') return sendJSON(res, 200, { ideas: await store.listIdeas(user.id) });
  if (sub === '' && req.method === 'POST') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    if (!b.title || !String(b.title).trim()) return sendJSON(res, 400, { error: 'Idea title is required' });
    const idea = { id: auth.newId('idea'), title: String(b.title).trim(), notes: String(b.notes || '').trim(), status: ['Backlog', 'Building', 'Launched'].includes(b.status) ? b.status : 'Backlog', createdAt: Date.now(), updatedAt: Date.now() };
    return sendJSON(res, 201, { idea: await store.addIdea(user.id, idea) });
  }
  const id = sub;
  if (id && req.method === 'PATCH') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const patch = {};
    if (b.title !== undefined) patch.title = String(b.title).trim();
    if (b.notes !== undefined) patch.notes = String(b.notes).trim();
    if (b.status !== undefined && ['Backlog', 'Building', 'Launched'].includes(b.status)) patch.status = b.status;
    const it = await store.updateIdea(user.id, id, patch);
    return it ? sendJSON(res, 200, { idea: it }) : sendJSON(res, 404, { error: 'Idea not found' });
  }
  if (id && req.method === 'DELETE') { await store.deleteIdea(user.id, id); return sendJSON(res, 200, { ok: true }); }
  return sendJSON(res, 404, { error: 'Unknown ideas endpoint' });
}

// --- AI workspace history -------------------------------------------------
async function handleAIHistory(req, res, sub, body) {
  const authed = await getAuthUser(req);
  if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
  const { user } = authed;
  if (sub === 'history' && req.method === 'GET') return sendJSON(res, 200, { history: await store.listHistory(user.id) });
  if (sub === 'history' && req.method === 'POST') {
    const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
    const entry = { id: auth.newId('ai'), title: String(b.title || 'AI Output').slice(0, 80), prompt: String(b.prompt || '').slice(0, 2000), content: String(b.content || '').slice(0, 8000), model: String(b.model || ''), simulated: !!b.simulated, at: Date.now() };
    return sendJSON(res, 201, { entry: await store.addHistory(user.id, entry) });
  }
  if (sub === 'history' && req.method === 'DELETE') { await store.clearHistory(user.id); return sendJSON(res, 200, { ok: true }); }
  return sendJSON(res, 404, { error: 'Unknown ai endpoint' });
}

// --- Messaging (real cross-user chat; contacts added by StatVibe QR/tag) ----
async function convSummary(conv, uid) {
  const otherId = conv.participants.find((id) => id !== uid);
  const other = otherId ? await store.getUserById(otherId) : null;
  const msgs = await store.listMessages(conv.id);
  const readAt = (conv.read && conv.read[uid]) || 0;
  const unread = msgs.filter((m) => m.from !== uid && m.at > readAt).length;
  return {
    id: conv.id,
    other: other ? { id: other.id, name: other.name || 'StatVibe user', tag: other.tag, isGuest: !!other.isGuest } : { name: 'Unknown', tag: '' },
    lastText: conv.lastText || '', lastAt: conv.lastAt || conv.createdAt, lastSender: conv.lastSender || null,
    mine: conv.lastSender === uid, unread,
  };
}

async function handleConversations(req, res, sub, body) {
  const authed = await getAuthUser(req);
  if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
  const { user } = authed;
  const parts = sub.split('/').filter(Boolean); // [] | [id] | [id,'messages'|'read']

  if (parts.length === 0) {
    if (req.method === 'GET') {
      const convs = await store.getConversationsFor(user.id);
      const list = (await Promise.all(convs.map((c) => convSummary(c, user.id)))).sort((a, b) => b.lastAt - a.lastAt);
      return sendJSON(res, 200, { conversations: list, unreadTotal: list.reduce((n, c) => n + c.unread, 0) });
    }
    if (req.method === 'POST') {
      const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
      const tag = String(b.tag || '').trim().toUpperCase().replace(/^STATVIBE:/, '').replace(/^USER:/, '').trim();
      if (!tag) return sendJSON(res, 400, { error: 'Enter or scan a StatVibe code' });
      const target = await store.getUserByTag(tag);
      if (!target) return sendJSON(res, 404, { error: 'No StatVibe user has that code' });
      if (target.id === user.id) return sendJSON(res, 400, { error: "That's your own code — share it so others can message you" });
      let conv = await store.findConversation(user.id, target.id);
      if (!conv) { conv = { id: auth.newId('conv'), participants: [user.id, target.id], createdAt: Date.now(), read: {} }; await store.saveConversation(conv); }
      return sendJSON(res, 200, { conversation: await convSummary(conv, user.id) });
    }
    return sendJSON(res, 405, { error: 'Method not allowed' });
  }

  const conv = await store.getConversation(parts[0]);
  if (!conv || !conv.participants.includes(user.id)) return sendJSON(res, 404, { error: 'Conversation not found' });

  if (parts[1] === 'messages') {
    if (req.method === 'GET') {
      await store.markConversationRead(conv.id, user.id);
      return sendJSON(res, 200, { messages: await store.listMessages(conv.id), other: (await convSummary(conv, user.id)).other });
    }
    if (req.method === 'POST') {
      const b = parseJSON(body); if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
      const text = String(b.text || '').trim();
      if (!text) return sendJSON(res, 400, { error: 'Message is empty' });
      const msg = await store.addMessage(conv.id, { id: auth.newId('m'), from: user.id, text: text.slice(0, 4000), at: monotonicNow() });
      await store.markConversationRead(conv.id, user.id);
      return sendJSON(res, 201, { message: msg });
    }
  }
  if (parts[1] === 'read' && req.method === 'POST') { await store.markConversationRead(conv.id, user.id); return sendJSON(res, 200, { ok: true }); }
  return sendJSON(res, 404, { error: 'Unknown conversation endpoint' });
}

// --- PayMongo QR Ph (real when PAYMONGO_* keys are set) --------------------
async function applyPaidPlan(user, plan, paymentRow) {
  const acct = ensureUsage(await store.getAccount(user.id) || blankAccount());
  const prev = acct.plan || 'Free';
  acct.plan = plan;
  acct.aiUsed = 0;
  acct.aiPeriodStart = Date.now();
  const normalized = ensureUsage(acct);
  await store.setAccount(user.id, normalized);
  if (paymentRow && paymentRow.id) {
    await store.updatePayment(paymentRow.id, { status: 'paid', paidAt: Date.now(), previousPlan: prev });
  }
  log('info', `plan upgrade ${user.id} ${prev} → ${plan} (paymongo)`);
  return { account: normalized, usage: usageView(normalized), previousPlan: prev };
}

async function handlePay(req, res, sub, body) {
  const authed = await getAuthUser(req);
  if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
  const { user } = authed;

  if (sub === 'qr' && req.method === 'POST') {
    const b = parseJSON(body) || {};
    const plan = b.plan && PLAN_PRICES.hasOwnProperty(b.plan) ? String(b.plan) : null;
    const amount = plan ? PLAN_PRICES[plan] : Math.max(0, Number(b.amount) || 0);
    if (!amount || amount <= 0) {
      return sendJSON(res, 400, { error: 'Choose a paid plan to generate a QR', code: 'invalid_amount' });
    }
    if (!paymongo.configured()) {
      await store.addPayment({
        id: auth.newId('pay'),
        userId: user.id,
        email: user.isGuest ? null : (user.email || null),
        name: user.name || null,
        plan,
        amount,
        currency: 'PHP',
        status: 'pending_unconfigured',
        source: 'paymongo-qr',
        createdAt: Date.now(),
      });
      return sendJSON(res, 200, {
        configured: false,
        amount,
        currency: 'PHP',
        plan,
        message: 'PayMongo not configured. Set PAYMONGO_SECRET_KEY and PAYMONGO_PUBLIC_KEY on the server.',
      });
    }
    try {
      const qr = await paymongo.createQrPhPayment({
        amountPesos: amount,
        description: plan ? `StatVibe ${plan} plan` : 'StatVibe subscription',
        metadata: { userId: user.id, plan: plan || '', email: user.email || '' },
      });
      const payment = await store.addPayment({
        id: auth.newId('pay'),
        userId: user.id,
        email: user.isGuest ? null : (user.email || null),
        name: user.name || null,
        plan,
        amount: qr.amount,
        currency: 'PHP',
        status: 'pending',
        source: 'paymongo-qr',
        sourceId: qr.intentId,
        createdAt: Date.now(),
      });
      return sendJSON(res, 200, {
        configured: true,
        plan,
        amount: qr.amount,
        currency: 'PHP',
        intentId: qr.intentId,
        status: qr.status,
        qrImageUrl: qr.qrImageUrl,
        redirectUrl: qr.redirectUrl,
        paymentId: payment.id,
        expiresAt: qr.expiresAt,
      });
    } catch (e) {
      log('error', 'PayMongo QR failed: ' + e.message);
      return sendJSON(res, 502, { configured: true, error: 'PayMongo request failed: ' + e.message });
    }
  }

  if (sub === 'status' && req.method === 'GET') {
    const url = new URL(req.url, 'http://x');
    const intentId = url.searchParams.get('intentId') || url.searchParams.get('id');
    if (!intentId) return sendJSON(res, 400, { error: 'intentId required' });
    const row = await store.findPaymentBySourceId(intentId);
    if (!row || row.userId !== user.id) return sendJSON(res, 404, { error: 'Payment not found' });
    if (!paymongo.configured()) {
      return sendJSON(res, 200, { status: row.status, paid: false, configured: false });
    }
    try {
      const intent = await paymongo.retrievePaymentIntent(intentId);
      const status = paymongo.intentStatus(intent);
      if (paymongo.intentSucceeded(intent) && row.plan && row.status !== 'paid') {
        const upgraded = await applyPaidPlan(user, row.plan, row);
        return sendJSON(res, 200, {
          status: 'succeeded',
          paid: true,
          plan: row.plan,
          account: upgraded.account,
          usage: upgraded.usage,
        });
      }
      return sendJSON(res, 200, { status, paid: status === 'succeeded', plan: row.plan, amount: row.amount });
    } catch (e) {
      return sendJSON(res, 502, { error: 'PayMongo status failed: ' + e.message });
    }
  }

  return sendJSON(res, 404, { error: 'Unknown pay endpoint' });
}

// --- Static files ---------------------------------------------------------
function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/') rel = '/index.html';
  const normalizedRel = path.normalize(rel);
  const filePath = path.join(STATIC_DIR, normalizedRel);
  if (!filePath.startsWith(STATIC_DIR)) return send(res, 403, 'Forbidden');
  const ext = path.extname(filePath).toLowerCase();
  const cache = ext === '.html' ? 'no-cache' : 'public, max-age=3600';

  fs.readFile(filePath, (err, data) => {
    if (!err) return send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });

    // Vite production build fingerprints assets into /dist/assets/*. Keep legacy
    // direct paths working (e.g. /app.js, /styles.css, /logo.svg) by falling
    // back to the original public files when a dist file is not found.
    if (STATIC_DIR === DIST_DIR) {
      const fallback = path.join(PUBLIC_DIR, normalizedRel);
      if (!fallback.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
      return fs.readFile(fallback, (err2, data2) => {
        if (!err2) return send(res, 200, data2, { 'Content-Type': MIME[path.extname(fallback).toLowerCase()] || 'application/octet-stream', 'Cache-Control': cache });
        return fs.readFile(path.join(STATIC_DIR, 'index.html'), (e2, d2) =>
          e2 ? send(res, 404, 'Not found') : send(res, 200, d2, { 'Content-Type': MIME['.html'] })
        );
      });
    }

    return fs.readFile(path.join(STATIC_DIR, 'index.html'), (e2, d2) =>
      e2 ? send(res, 404, 'Not found') : send(res, 200, d2, { 'Content-Type': MIME['.html'] })
    );
  });
}

// --- Router ---------------------------------------------------------------
// Exported so it can back both the standalone Node server (local/VPS/Docker)
// and a Vercel serverless function (api/[...path].js) — same code, no rewrites.
async function requestHandler(req, res) {
  metrics.requests++;
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (p === '/api/health') return handleHealth(res);
    if (p === '/api/meta' && req.method === 'GET') return handleMeta(res);
    if (p === '/api/models' && req.method === 'GET') return handleModels(res);
    if (p === '/api/chat' && req.method === 'POST') return handleChat(req, res, await readBody(req));
    if (p.startsWith('/api/auth/')) return handleAuth(req, res, p.slice('/api/auth/'.length), ['POST', 'PATCH'].includes(req.method) ? await readBody(req) : null);
    if (p === '/api/account' || p.startsWith('/api/account/')) {
      const sub = p === '/api/account' ? '' : p.slice('/api/account/'.length);
      return handleAccount(req, res, sub, ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : null);
    }
    if (p === '/api/inventory' || p.startsWith('/api/inventory/')) return handleInventory(req, res, p === '/api/inventory' ? '' : p.slice('/api/inventory/'.length), ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : null);
    if (p === '/api/predict' && req.method === 'POST') return handlePredict(req, res, await readBody(req));
    if (p === '/api/ideas' || p.startsWith('/api/ideas/')) return handleIdeas(req, res, p === '/api/ideas' ? '' : p.slice('/api/ideas/'.length), ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : null);
    if (p.startsWith('/api/ai/')) return handleAIHistory(req, res, p.slice('/api/ai/'.length), ['POST'].includes(req.method) ? await readBody(req) : null);
    if (p === '/api/conversations' || p.startsWith('/api/conversations/')) return handleConversations(req, res, p === '/api/conversations' ? '' : p.slice('/api/conversations'.length), ['POST', 'PATCH'].includes(req.method) ? await readBody(req) : null);
    if (p.startsWith('/api/pay/')) return handlePay(req, res, p.slice('/api/pay/'.length), req.method === 'POST' ? await readBody(req) : null);
    if (p.startsWith('/api/admin/')) return handleAdmin(req, res, p.slice('/api/admin/'.length), req.method === 'POST' ? await readBody(req) : null);
    if (p.startsWith('/api/')) return sendJSON(res, 404, { error: 'Unknown endpoint' });

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    // Separate developer console app, served at /admin (its own page, not the SPA).
    if (p === '/admin' || p === '/admin/') { req.url = '/admin.html'; return serveStatic(req, res); }
    return serveStatic(req, res);
  } catch (e) {
    log('error', (req.method + ' ' + req.url + ' → ' + (e.message || e)));
    if (!res.headersSent) sendJSON(res, e.message === 'Body too large' ? 413 : 500, { error: e.message || 'Server error' });
  }
}

// --- Boot / lifecycle -----------------------------------------------------
// Runs once per process (and per Vercel cold start): load config + seed founder.
loadConfig();
const ready = seedFounder().catch((e) => log('error', 'seedFounder: ' + e.message));

const server = http.createServer(requestHandler);

// Only listen when run directly (node server.js) — NOT when imported by the
// Vercel serverless function, which calls requestHandler per request instead.
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    log('info', `StatVibe v${VERSION} listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    log('info', `Developer console: /admin  ·  founder: ${ADMIN_USER}`);
    log('info', `Ollama proxy target: ${OLLAMA}`);
    listOllamaModels().then((m) =>
      log('info', m.length ? `Local models: ${m.join(', ')}` : 'No local models — simulated AI active.')
    );
  });
  server.on('error', (e) => { log('error', 'server error: ' + e.message); process.exit(1); });
  const shutdown = (sig) => { log('info', `${sig} received — shutting down`); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000); };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Vercel serverless entry awaits `ready` (founder seed) then dispatches.
async function handler(req, res) { await ready; return requestHandler(req, res); }

module.exports = server;          // standalone server (also used by tests)
module.exports.handler = handler; // serverless handler (api/[...path].js)
module.exports.requestHandler = requestHandler;
