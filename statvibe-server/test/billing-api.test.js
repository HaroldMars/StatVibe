// Billing API integration tests (isolated DB + port).
process.env.PORT = process.env.TEST_BILLING_PORT || '4198';
process.env.HOST = '127.0.0.1';
process.env.OLLAMA_HOST = 'http://127.0.0.1:9';
process.env.ADMIN_USER = 'GenAdmin';
process.env.ADMIN_PASSWORD = 'genadmin-2026';
process.env.ADMIN_TOKEN = 'test-token';
process.env.AI_API_URL = ''; process.env.AI_API_KEY = '';
process.env.KV_REST_API_URL = ''; process.env.KV_REST_API_TOKEN = '';
process.env.PAYMONGO_SECRET_KEY = '';
delete process.env.PAYMONGO_WEBHOOK_SECRET;
const os = require('node:os');
const pathMod = require('node:path');
process.env.STATVIBE_DB = pathMod.join(os.tmpdir(), 'statvibe-billing-api-' + process.pid + '.json');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = `http://127.0.0.1:${process.env.PORT}`;
let server;

function req(method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(path, BASE);
    const r = http.request(
      {
        method, hostname: u.hostname, port: u.port, path: u.pathname + u.search,
        headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => {
          let json; try { json = JSON.parse(b); } catch { json = null; }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function waitHealthy(tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await req('GET', '/api/health');
      if (r.status === 200) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('billing test server did not become healthy');
}

test.before(async () => {
  server = require('../server.js');
  await new Promise((r) => server.listen(Number(process.env.PORT), '127.0.0.1', r));
  await waitHealthy();
});
test.after(() => { try { server.close(); } catch { /* ignore */ } });

test('GET /api/billing/catalog → Pro $10 + VAT $1.20, Business $49 + VAT $5.88', async () => {
  const r = await req('GET', '/api/billing/catalog');
  assert.equal(r.status, 200);
  assert.equal(r.json.vatRate, 0.12);
  assert.equal(r.json.quotes.Pro.subtotalCents, 1000);
  assert.equal(r.json.quotes.Pro.vatCents, 120);
  assert.equal(r.json.quotes.Pro.totalCents, 1120);
  assert.equal(r.json.quotes.Business.subtotalCents, 4900);
  assert.equal(r.json.quotes.Business.vatCents, 588);
  assert.equal(r.json.quotes.Business.totalCents, 5488);
});

test('POST /api/billing/checkout demoActivate activates Pro with VAT fields', async () => {
  const email = `bill${Date.now()}@example.com`;
  const reg = await req('POST', '/api/auth/register', {
    body: { name: 'Billing Tester', email, password: 'Password1!', acceptedTerms: true },
  });
  assert.ok(reg.status === 200 || reg.status === 201, JSON.stringify(reg.json));
  const token = reg.json.token;

  const checkout = await req('POST', '/api/billing/checkout', {
    headers: { Authorization: `Bearer ${token}` },
    body: { plan: 'Pro', demoActivate: true },
  });
  assert.equal(checkout.status, 200, JSON.stringify(checkout.json));
  assert.equal(checkout.json.demo, true);
  assert.equal(checkout.json.quote.vatCents, 120);
  assert.equal(checkout.json.account.plan, 'Pro');
  assert.equal(checkout.json.subscription.status, 'ACTIVE');
});

test('webhook payment.paid is idempotent for already-paid tx', async () => {
  const email = `idem${Date.now()}@example.com`;
  const reg = await req('POST', '/api/auth/register', {
    body: { name: 'Idem Tester', email, password: 'Password1!', acceptedTerms: true },
  });
  const token = reg.json.token;
  const checkout = await req('POST', '/api/billing/checkout', {
    headers: { Authorization: `Bearer ${token}` },
    body: { plan: 'Business', demoActivate: true },
  });
  assert.equal(checkout.status, 200);
  const txId = checkout.json.transactionId;

  const wh1 = await req('POST', '/api/webhooks/paymongo', {
    body: {
      data: {
        attributes: {
          type: 'payment.paid',
          data: {
            id: 'pay_idem_1',
            attributes: { metadata: { transaction_id: txId }, source: { type: 'gcash' } },
          },
        },
      },
    },
  });
  assert.equal(wh1.status, 200);
  // already paid via demo — should idempotent skip or re-handle safely
  assert.ok(['idempotent_skip', 'paid'].includes(wh1.json.handled), JSON.stringify(wh1.json));

  const wh2 = await req('POST', '/api/webhooks/paymongo', {
    body: {
      data: {
        attributes: {
          type: 'payment.paid',
          data: {
            id: 'pay_idem_1',
            attributes: { metadata: { transaction_id: txId } },
          },
        },
      },
    },
  });
  assert.equal(wh2.status, 200);
  assert.equal(wh2.json.handled, 'idempotent_skip');
});

test('admin pricing override reflects in public catalog without redeploy', async () => {
  const login = await req('POST', '/api/admin/login', {
    body: { username: 'GenAdmin', password: 'genadmin-2026' },
  });
  assert.equal(login.status, 200, JSON.stringify(login.json));
  const token = login.json.token;

  const put = await req('PUT', '/api/admin/billing/subscriptions-config', {
    headers: { 'x-admin-token': token },
    body: { betaSaleEnabled: true, tiers: { Pro: { salePriceCents: 999, saleActive: true } } },
  });
  assert.equal(put.status, 200, JSON.stringify(put.json));
  assert.equal(put.json.preview.Pro.subtotalCents, 999);
  assert.equal(put.json.preview.Pro.vatCents, 120);
  assert.equal(put.json.preview.Pro.totalCents, 1119);

  const catalog = await req('GET', '/api/billing/catalog');
  assert.equal(catalog.json.quotes.Pro.subtotalCents, 999);
});

test('admin notifications broadcast to public feed', async () => {
  const login = await req('POST', '/api/admin/login', {
    body: { username: 'GenAdmin', password: 'genadmin-2026' },
  });
  assert.equal(login.status, 200);
  const created = await req('POST', '/api/admin/notifications', {
    headers: { 'x-admin-token': login.json.token },
    body: {
      title: 'Beta Sale Live',
      body: 'Upgrade to Pro at $10 + 12% VAT.',
      category: 'sale',
      channels: ['in_app', 'email'],
      ctaLabel: 'Upgrade to Beta Sale',
      ctaUrl: '/#plans',
      dismissible: true,
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const pub = await req('GET', '/api/notifications');
  assert.equal(pub.status, 200);
  assert.ok(pub.json.notifications.some((n) => n.title === 'Beta Sale Live'));
});
