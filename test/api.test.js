// StatVibe API tests — Node built-in test runner, zero dependencies.
// Run: npm test   (or: node --test test/)
//
// Uses a bogus OLLAMA_HOST so AI calls fall back to the simulated engine
// quickly and deterministically (no model latency, no network).

process.env.PORT = process.env.TEST_PORT || '4199';
process.env.HOST = '127.0.0.1';
process.env.OLLAMA_HOST = 'http://127.0.0.1:9'; // unused → fast fallback
process.env.ADMIN_TOKEN = 'test-token';
// Isolate the database so tests never touch the dev data/db.json.
const os = require('node:os');
const pathMod = require('node:path');
process.env.STATVIBE_DB = pathMod.join(os.tmpdir(), 'statvibe-test-' + process.pid + '.json');

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const BASE = `http://127.0.0.1:${process.env.PORT}`;
let server;

function req(method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(path, BASE);
    const r = http.request(
      { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search,
        headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => {
        let json; try { json = JSON.parse(b); } catch { json = null; }
        resolve({ status: res.statusCode, headers: res.headers, body: b, json });
      }); }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
async function waitHealthy(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const r = await req('GET', '/api/health'); if (r.status === 200) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not become healthy');
}

test.before(async () => { server = require('../server.js'); await waitHealthy(); });
test.after(() => { try { server.close(); } catch { /* ignore */ } });

test('GET /api/health → ok with version + security headers', async () => {
  const r = await req('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
  assert.ok(r.json.version, 'has version');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.ok(r.headers['content-security-policy'], 'has CSP');
});

test('GET / serves the SPA', async () => {
  const r = await req('GET', '/');
  assert.equal(r.status, 200);
  assert.match(r.body, /StatVibe/);
});

test('static assets served (logo.svg, app.js, styles.css)', async () => {
  for (const [p, type] of [['/logo.svg', /svg/], ['/app.js', /javascript/], ['/styles.css', /css/]]) {
    const r = await req('GET', p);
    assert.equal(r.status, 200, `${p} status`);
    assert.match(r.headers['content-type'], type, `${p} type`);
  }
});

test('unknown deep-link path falls back to index (SPA routing)', async () => {
  const r = await req('GET', '/anything/here');
  assert.equal(r.status, 200);
  assert.match(r.body, /StatVibe/);
});

test('GET /api/models → engines + 4 cloud models', async () => {
  const r = await req('GET', '/api/models');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.engines) && r.json.engines.length >= 1);
  assert.equal(r.json.cloud.length, 4);
  assert.equal(r.json.cloud.every((c) => c.available === false), true, 'cloud default unavailable');
});

test('POST /api/chat with no messages → 400', async () => {
  const r = await req('POST', '/api/chat', { body: { messages: [] } });
  assert.equal(r.status, 400);
});

test('POST /api/chat → simulated content (Ollama unreachable)', async () => {
  const r = await req('POST', '/api/chat', { body: { messages: [{ role: 'user', content: 'Draft a board update' }] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.simulated, true);
  assert.ok(r.json.content.length > 20, 'has content');
});

test('POST /api/chat with a cloud model → simulated with note', async () => {
  const r = await req('POST', '/api/chat', { body: { model: 'claude', messages: [{ role: 'user', content: 'hi' }] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.simulated, true);
  assert.match(r.json.note || '', /hosted/i);
});

test('unknown /api endpoint → 404', async () => {
  const r = await req('GET', '/api/nope');
  assert.equal(r.status, 404);
});

test('non-GET on static → 405', async () => {
  const r = await req('DELETE', '/');
  assert.equal(r.status, 405);
});

test('admin summary without token → 401', async () => {
  const r = await req('GET', '/api/admin/summary');
  assert.equal(r.status, 401);
});

test('admin summary with token → 200 with metrics + config', async () => {
  const r = await req('GET', '/api/admin/summary', { headers: { 'x-admin-token': 'test-token' } });
  assert.equal(r.status, 200);
  assert.ok(r.json.metrics, 'has metrics');
  assert.ok(r.json.config, 'has config');
  assert.ok(typeof r.json.uptime_s === 'number');
});

test('admin can flip a cloud model to available, reflected in /api/models', async () => {
  const set = await req('POST', '/api/admin/config', { headers: { 'x-admin-token': 'test-token' }, body: { cloudAvailable: { claude: true } } });
  assert.equal(set.status, 200);
  assert.equal(set.json.config.cloudAvailable.claude, true);

  const models = await req('GET', '/api/models');
  const claude = models.json.cloud.find((c) => c.id === 'claude');
  assert.equal(claude.available, true);

  // reset so the suite leaves no state behind
  const reset = await req('POST', '/api/admin/reset', { headers: { 'x-admin-token': 'test-token' } });
  assert.equal(reset.status, 200);
  assert.equal(reset.json.config.cloudAvailable.claude, undefined);
});

test('admin simulateOnly forces simulated engine list', async () => {
  await req('POST', '/api/admin/config', { headers: { 'x-admin-token': 'test-token' }, body: { simulateOnly: true } });
  const models = await req('GET', '/api/models');
  assert.equal(models.json.simulate_only, true);
  await req('POST', '/api/admin/reset', { headers: { 'x-admin-token': 'test-token' } });
});

test('request body over cap → 413', async () => {
  const big = 'x'.repeat(300 * 1024);
  const r = await req('POST', '/api/chat', { body: { messages: [{ role: 'user', content: big }] } });
  assert.equal(r.status, 413);
});

// --- Accounts / inventory / prediction ---
test('GET /api/meta → currency list', async () => {
  const r = await req('GET', '/api/meta');
  assert.equal(r.status, 200);
  const codes = r.json.currencies.map((c) => c.code);
  assert.ok(codes.includes('USD') && codes.includes('PHP'));
});

const auth = (token) => ({ Authorization: 'Bearer ' + token });
let userToken = null;

test('register validates email, password, and terms', async () => {
  assert.equal((await req('POST', '/api/auth/register', { body: { email: 'bad', password: 'x', acceptedTerms: true } })).status, 400);
  assert.equal((await req('POST', '/api/auth/register', { body: { email: 'a@b.co', password: 'short', acceptedTerms: true } })).status, 400);
  assert.equal((await req('POST', '/api/auth/register', { body: { email: 'a@b.co', password: 'longenough', acceptedTerms: false } })).status, 400);
});

test('register creates a blank account and never returns the password hash', async () => {
  const r = await req('POST', '/api/auth/register', { body: { email: 'owner@test.co', password: 'supersecret', name: 'Test Owner', acceptedTerms: true } });
  assert.equal(r.status, 201);
  assert.ok(r.json.token);
  assert.equal('passwordHash' in r.json.user, false, 'hash not exposed');
  assert.ok(r.json.user.tag && r.json.user.tag.startsWith('SV-'));
  assert.equal(r.json.account.setupComplete, false, 'blank account');
  userToken = r.json.token;
});

test('duplicate email → 409', async () => {
  const r = await req('POST', '/api/auth/register', { body: { email: 'owner@test.co', password: 'supersecret', acceptedTerms: true } });
  assert.equal(r.status, 409);
});

test('login rejects wrong password, accepts correct', async () => {
  assert.equal((await req('POST', '/api/auth/login', { body: { email: 'owner@test.co', password: 'wrong' } })).status, 401);
  const ok = await req('POST', '/api/auth/login', { body: { email: 'owner@test.co', password: 'supersecret' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token);
});

test('guest session works and is flagged', async () => {
  const r = await req('POST', '/api/auth/guest');
  assert.equal(r.status, 201);
  assert.equal(r.json.user.isGuest, true);
});

test('protected endpoints require auth', async () => {
  assert.equal((await req('GET', '/api/inventory')).status, 401);
  assert.equal((await req('GET', '/api/account')).status, 401);
});

test('account setup requires business name and validates currency', async () => {
  assert.equal((await req('POST', '/api/account/setup', { headers: auth(userToken), body: {} })).status, 400);
  const r = await req('POST', '/api/account/setup', { headers: auth(userToken), body: { businessName: 'Test Store', currency: 'PHP', industry: 'Retail' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.account.setupComplete, true);
  assert.equal(r.json.account.currency, 'PHP');
});

let itemId = null;
test('inventory: add item with all fields', async () => {
  const r = await req('POST', '/api/inventory', { headers: auth(userToken), body: { name: 'Rice 5kg', stock: 120, price: 320, ratePerDay: 8, size: '5kg', weight: '5kg', unit: 'sacks' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.item.name, 'Rice 5kg');
  assert.equal(r.json.item.stock, 120);
  itemId = r.json.item.id;
  const list = await req('GET', '/api/inventory', { headers: auth(userToken) });
  assert.equal(list.json.inventory.length, 1);
});

test('inventory: item name required', async () => {
  assert.equal((await req('POST', '/api/inventory', { headers: auth(userToken), body: { stock: 5 } })).status, 400);
});

test('predict computes days-to-last from stock and rate', async () => {
  const r = await req('POST', '/api/predict', { headers: auth(userToken), body: { itemId } });
  assert.equal(r.status, 200);
  assert.equal(r.json.days, 15); // 120 / 8
  assert.ok(['healthy', 'low', 'critical'].includes(r.json.status));
  assert.ok(r.json.note.length > 0);
});

test('predict without a rate returns a helpful note, no crash', async () => {
  const r = await req('POST', '/api/predict', { headers: auth(userToken), body: { stock: 50, ratePerDay: 0, name: 'Widget' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.days, null);
});

test('inventory update + delete', async () => {
  const up = await req('PATCH', '/api/inventory/' + itemId, { headers: auth(userToken), body: { stock: 200 } });
  assert.equal(up.status, 200);
  assert.equal(up.json.item.stock, 200);
  const del = await req('DELETE', '/api/inventory/' + itemId, { headers: auth(userToken) });
  assert.equal(del.status, 200);
  assert.equal((await req('GET', '/api/inventory', { headers: auth(userToken) })).json.inventory.length, 0);
});

test('change password requires correct current password', async () => {
  assert.equal((await req('POST', '/api/auth/change-password', { headers: auth(userToken), body: { currentPassword: 'nope', newPassword: 'brandnewpass' } })).status, 403);
  const ok = await req('POST', '/api/auth/change-password', { headers: auth(userToken), body: { currentPassword: 'supersecret', newPassword: 'brandnewpass' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.json.token, 'issues a fresh session token');
});

test('delete account removes it (login then fails)', async () => {
  const login = await req('POST', '/api/auth/login', { body: { email: 'owner@test.co', password: 'brandnewpass' } });
  assert.equal(login.status, 200);
  const del = await req('DELETE', '/api/account', { headers: auth(login.json.token) });
  assert.equal(del.status, 200);
  assert.equal((await req('POST', '/api/auth/login', { body: { email: 'owner@test.co', password: 'brandnewpass' } })).status, 401);
});

// --- Developer console: separate admin app with real accounts ---
test('/admin serves the separate developer console page', async () => {
  const r = await req('GET', '/admin');
  assert.equal(r.status, 200);
  assert.match(r.body, /Developer Console/);
});

test('founder admin (seeded from env) logs in with username + password', async () => {
  assert.equal((await req('POST', '/api/admin/login', { body: { username: 'GenAdmin', password: 'wrong' } })).status, 401);
  const r = await req('POST', '/api/admin/login', { body: { username: 'GenAdmin', password: 'genadmin-2026' } });
  assert.equal(r.status, 200);
  assert.ok(r.json.token);
  assert.equal(r.json.admin.role, 'founder');
});

test('an admin session token authorizes the admin API', async () => {
  const login = await req('POST', '/api/admin/login', { body: { username: 'GenAdmin', password: 'genadmin-2026' } });
  const r = await req('GET', '/api/admin/summary', { headers: { 'x-admin-token': login.json.token } });
  assert.equal(r.status, 200);
  assert.ok(r.json.metrics);
});

test('founder creates a developer account; that developer can log in', async () => {
  const founder = (await req('POST', '/api/admin/login', { body: { username: 'GenAdmin', password: 'genadmin-2026' } })).json.token;
  const create = await req('POST', '/api/admin/accounts', { headers: { 'x-admin-token': founder }, body: { username: 'devtest', displayName: 'Dev Test', password: 'devpass123' } });
  assert.equal(create.status, 201);
  assert.ok(create.json.admins.some((a) => a.username === 'devtest'));
  const devLogin = await req('POST', '/api/admin/login', { body: { username: 'devtest', password: 'devpass123' } });
  assert.equal(devLogin.status, 200);
  assert.equal(devLogin.json.admin.role, 'developer');
});

test('a non-founder developer cannot list or create admin accounts', async () => {
  const dev = (await req('POST', '/api/admin/login', { body: { username: 'devtest', password: 'devpass123' } })).json.token;
  assert.equal((await req('GET', '/api/admin/accounts', { headers: { 'x-admin-token': dev } })).status, 403);
  assert.equal((await req('POST', '/api/admin/accounts', { headers: { 'x-admin-token': dev }, body: { username: 'x2', password: 'password1' } })).status, 403);
});

test('admin API rejects a bogus token', async () => {
  assert.equal((await req('GET', '/api/admin/summary', { headers: { 'x-admin-token': 'not-a-real-token' } })).status, 401);
});

// --- Alpha additions: ideas, ai history, admin users/tokens, predict-human, paymongo ---
let alphaToken = null;
test('setup a user for alpha feature tests', async () => {
  const r = await req('POST', '/api/auth/register', { body: { email: 'alpha@test.co', password: 'password1', name: 'Al Pha', acceptedTerms: true } });
  alphaToken = r.json.token;
  await req('POST', '/api/account/setup', { headers: auth(alphaToken), body: { businessName: 'Alpha Co', currency: 'PHP' } });
});

test('ideas: create, edit, list, delete', async () => {
  const c = await req('POST', '/api/ideas', { headers: auth(alphaToken), body: { title: 'Loyalty', notes: 'points' } });
  assert.equal(c.status, 201);
  const id = c.json.idea.id;
  assert.equal((await req('POST', '/api/ideas', { headers: auth(alphaToken), body: {} })).status, 400); // title required
  const e = await req('PATCH', '/api/ideas/' + id, { headers: auth(alphaToken), body: { notes: 'points + tiers', status: 'Building' } });
  assert.equal(e.json.idea.notes, 'points + tiers');
  assert.equal(e.json.idea.status, 'Building');
  assert.equal((await req('GET', '/api/ideas', { headers: auth(alphaToken) })).json.ideas.length, 1);
  await req('DELETE', '/api/ideas/' + id, { headers: auth(alphaToken) });
  assert.equal((await req('GET', '/api/ideas', { headers: auth(alphaToken) })).json.ideas.length, 0);
});

test('ai history: save + list + clear', async () => {
  await req('POST', '/api/ai/history', { headers: auth(alphaToken), body: { title: 'Board update', prompt: 'draft', content: 'hello', model: 'gemma2' } });
  assert.equal((await req('GET', '/api/ai/history', { headers: auth(alphaToken) })).json.history.length, 1);
  await req('DELETE', '/api/ai/history', { headers: auth(alphaToken) });
  assert.equal((await req('GET', '/api/ai/history', { headers: auth(alphaToken) })).json.history.length, 0);
});

test('predict returns human-readable weeks/months', async () => {
  assert.equal((await req('POST', '/api/predict', { headers: auth(alphaToken), body: { stock: 300, ratePerDay: 3 } })).json.human, '~3.3 months');
  assert.equal((await req('POST', '/api/predict', { headers: auth(alphaToken), body: { stock: 21, ratePerDay: 1 } })).json.human, '~3.0 weeks');
  assert.equal((await req('POST', '/api/predict', { headers: auth(alphaToken), body: { stock: 6, ratePerDay: 1 } })).json.human, '6 days');
});

test('admin: registered users list + token metrics present', async () => {
  const r = await req('GET', '/api/admin/users', { headers: { 'x-admin-token': 'test-token' } });
  assert.equal(r.status, 200);
  assert.ok(r.json.users.some((u) => u.email === 'alpha@test.co' && u.business === 'Alpha Co' && u.currency === 'PHP'));
  const s = await req('GET', '/api/admin/summary', { headers: { 'x-admin-token': 'test-token' } });
  assert.ok(s.json.users.total >= 1);
  assert.ok(s.json.metrics.tokens && typeof s.json.metrics.tokens.total === 'number');
});

test('AI chat records token usage', async () => {
  await req('POST', '/api/chat', { body: { messages: [{ role: 'user', content: 'Say hello briefly.' }] } });
  const s = await req('GET', '/api/admin/summary', { headers: { 'x-admin-token': 'test-token' } });
  assert.ok(s.json.metrics.tokens.total > 0, 'tokens counted');
});

test('paymongo QR: clear "not configured" when no key set', async () => {
  const r = await req('POST', '/api/pay/qr', { headers: auth(alphaToken), body: { amount: 79 } });
  assert.equal(r.status, 200);
  assert.equal(r.json.configured, false);
  assert.match(r.json.message, /PayMongo/);
});
