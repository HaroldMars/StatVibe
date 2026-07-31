// PayMongo QR Ph helpers (Payment Intent → Payment Method → Attach).
// Secret/public keys stay in env; never send the secret key to the browser.

const PAYMONGO_API = 'https://api.paymongo.com/v1';

function secretKey() { return process.env.PAYMONGO_SECRET_KEY || ''; }
function publicKey() { return process.env.PAYMONGO_PUBLIC_KEY || ''; }
function configured() { return !!(secretKey() && publicKey()); }

function authHeader(key) {
  return 'Basic ' + Buffer.from(String(key) + ':').toString('base64');
}

function request(method, path, { key, body } = {}) {
  const https = require('https');
  const payload = body != null ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const u = new URL(PAYMONGO_API + path);
    const headers = { Authorization: authHeader(key), Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers,
    }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        let json = null;
        try { json = d ? JSON.parse(d) : null; } catch { /* ignore */ }
        if (r.statusCode >= 200 && r.statusCode < 300) return resolve(json);
        const msg = (json && json.errors && json.errors[0] && json.errors[0].detail)
          || (json && json.error)
          || (`PayMongo ${r.statusCode}`);
        const err = new Error(msg);
        err.status = r.statusCode;
        err.body = json;
        reject(err);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Create a scannable QR Ph payment for amountPesos (whole pesos). */
async function createQrPhPayment({ amountPesos, description, metadata = {} }) {
  if (!configured()) {
    const err = new Error('PayMongo not configured');
    err.code = 'not_configured';
    throw err;
  }
  const centavos = Math.max(2000, Math.round(Number(amountPesos) * 100)); // min ₱20
  const intent = await request('POST', '/payment_intents', {
    key: secretKey(),
    body: {
      data: {
        attributes: {
          amount: centavos,
          currency: 'PHP',
          payment_method_allowed: ['qrph'],
          description: String(description || 'StatVibe subscription').slice(0, 255),
          metadata: Object.fromEntries(
            Object.entries(metadata).map(([k, v]) => [k, String(v == null ? '' : v).slice(0, 500)])
          ),
        },
      },
    },
  });
  const intentId = intent.data.id;
  const clientKey = intent.data.attributes.client_key;

  const method = await request('POST', '/payment_methods', {
    key: publicKey(),
    body: { data: { attributes: { type: 'qrph' } } },
  });
  const methodId = method.data.id;

  const attached = await request('POST', `/payment_intents/${intentId}/attach`, {
    key: publicKey(),
    body: {
      data: {
        attributes: {
          payment_method: methodId,
          client_key: clientKey,
        },
      },
    },
  });

  const attrs = (attached && attached.data && attached.data.attributes) || {};
  const next = attrs.next_action || {};
  const code = next.code || {};
  const imageUrl = code.image_url || null;
  const redirectUrl = (next.redirect && next.redirect.url) || attrs.redirect?.url || null;

  return {
    intentId,
    clientKey,
    methodId,
    status: attrs.status || 'awaiting_next_action',
    amount: centavos / 100,
    currency: 'PHP',
    qrImageUrl: imageUrl,
    redirectUrl,
    expiresAt: code.amount != null ? null : (attrs.next_action && attrs.next_action.code && attrs.next_action.code.expiry_seconds
      ? Date.now() + (Number(attrs.next_action.code.expiry_seconds) * 1000)
      : Date.now() + 30 * 60 * 1000),
    raw: attached,
  };
}

async function retrievePaymentIntent(intentId) {
  return request('GET', `/payment_intents/${encodeURIComponent(intentId)}`, { key: secretKey() });
}

function intentStatus(intentJson) {
  return intentJson && intentJson.data && intentJson.data.attributes
    ? intentJson.data.attributes.status
    : null;
}

function intentSucceeded(intentJson) {
  const s = intentStatus(intentJson);
  return s === 'succeeded';
}

module.exports = {
  configured, createQrPhPayment, retrievePaymentIntent, intentStatus, intentSucceeded, secretKey, publicKey,
};
