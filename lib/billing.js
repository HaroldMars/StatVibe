/**
 * StatVibe billing — Beta Sale pricing, 12% VAT (excluded from base), PayMongo helpers.
 *
 * Catalog amounts are stored in USD cents. PayMongo charges PHP centavos using
 * USD_PHP_RATE (default 56) unless PAYMONGO_CURRENCY=USD is supported/set.
 */
'use strict';

const VAT_RATE = 0.12;
const DEFAULT_USD_PHP_RATE = Number(process.env.USD_PHP_RATE) || 56;

/** Default Beta Sale catalog (USD cents). */
const DEFAULT_SUBSCRIPTIONS_CONFIG = {
  currency: 'USD',
  vatRate: VAT_RATE,
  betaSaleEnabled: true,
  updatedAt: null,
  updatedBy: null,
  tiers: {
    Free: {
      id: 'Free',
      label: 'Free',
      basePriceCents: 0,
      salePriceCents: 0,
      saleActive: false,
      discountPercent: 0,
      tokenLimit: 50000,
    },
    Pro: {
      id: 'Pro',
      label: 'Pro',
      basePriceCents: 2000, // $20.00
      salePriceCents: 1000, // $10.00 first-time / beta
      saleActive: true,
      discountPercent: 50,
      tokenLimit: 1000000,
    },
    Business: {
      id: 'Business',
      label: 'Business',
      basePriceCents: 7900, // $79.00
      salePriceCents: 4900, // $49.00 (~38% off)
      saleActive: true,
      discountPercent: 38,
      tokenLimit: 5000000,
    },
    Enterprise: {
      id: 'Enterprise',
      label: 'Enterprise',
      basePriceCents: 0,
      salePriceCents: 0,
      saleActive: false,
      discountPercent: 0,
      tokenLimit: 999999999,
      contactSales: true,
    },
  },
};

function roundCents(n) {
  return Math.max(0, Math.round(Number(n) || 0));
}

/**
 * Resolve checkout amounts for a tier.
 * @param {object} tier - tier config
 * @param {{ betaSaleEnabled?: boolean, firstTime?: boolean, vatRate?: number }} opts
 */
function quoteTier(tier, opts = {}) {
  const vatRate = opts.vatRate != null ? Number(opts.vatRate) : VAT_RATE;
  const saleOn = !!(opts.betaSaleEnabled && tier && tier.saleActive && (opts.firstTime !== false));
  const base = roundCents(tier && tier.basePriceCents);
  const sale = roundCents(tier && tier.salePriceCents);
  const subtotalCents = saleOn && sale > 0 && sale < base ? sale : base;
  const vatCents = roundCents(subtotalCents * vatRate);
  const totalCents = subtotalCents + vatCents;
  return {
    plan: tier && tier.id,
    currency: 'USD',
    basePriceCents: base,
    salePriceCents: sale,
    saleApplied: saleOn && subtotalCents === sale && sale > 0,
    subtotalCents,
    vatRate,
    vatCents,
    totalCents,
    display: {
      base: base / 100,
      sale: sale / 100,
      subtotal: subtotalCents / 100,
      vat: vatCents / 100,
      total: totalCents / 100,
    },
  };
}

function mergeConfig(raw) {
  const cfg = JSON.parse(JSON.stringify(DEFAULT_SUBSCRIPTIONS_CONFIG));
  if (!raw || typeof raw !== 'object') return cfg;
  if (typeof raw.betaSaleEnabled === 'boolean') cfg.betaSaleEnabled = raw.betaSaleEnabled;
  if (raw.vatRate != null && !Number.isNaN(Number(raw.vatRate))) cfg.vatRate = Number(raw.vatRate);
  if (raw.currency) cfg.currency = String(raw.currency);
  cfg.updatedAt = raw.updatedAt || null;
  cfg.updatedBy = raw.updatedBy || null;
  for (const [id, tier] of Object.entries(raw.tiers || {})) {
    if (!cfg.tiers[id]) {
      cfg.tiers[id] = { id, label: id, basePriceCents: 0, salePriceCents: 0, saleActive: false, discountPercent: 0, tokenLimit: 50000 };
    }
    const t = cfg.tiers[id];
    const src = tier || {};
    if (src.label != null) t.label = String(src.label);
    if (src.basePriceCents != null) t.basePriceCents = roundCents(src.basePriceCents);
    if (src.salePriceCents != null) t.salePriceCents = roundCents(src.salePriceCents);
    if (typeof src.saleActive === 'boolean') t.saleActive = src.saleActive;
    if (src.discountPercent != null) t.discountPercent = Math.max(0, Math.min(100, Number(src.discountPercent) || 0));
    if (src.tokenLimit != null) t.tokenLimit = Math.max(0, Number(src.tokenLimit) || 0);
    if (typeof src.contactSales === 'boolean') t.contactSales = src.contactSales;
  }
  return cfg;
}

function catalogQuotes(config, { firstTime = true } = {}) {
  const cfg = mergeConfig(config);
  const out = {};
  for (const [id, tier] of Object.entries(cfg.tiers)) {
    out[id] = quoteTier(tier, { betaSaleEnabled: cfg.betaSaleEnabled, firstTime, vatRate: cfg.vatRate });
  }
  return { config: cfg, quotes: out };
}

/** Convert USD cents → PHP centavos for PayMongo. */
function usdCentsToPhpCentavos(usdCents, rate = DEFAULT_USD_PHP_RATE) {
  const php = (roundCents(usdCents) / 100) * Number(rate || DEFAULT_USD_PHP_RATE);
  return Math.max(2000, Math.round(php * 100)); // PayMongo min often ₱20.00
}

function phpPesosFromUsdCents(usdCents, rate = DEFAULT_USD_PHP_RATE) {
  return Math.round(((roundCents(usdCents) / 100) * Number(rate || DEFAULT_USD_PHP_RATE)) * 100) / 100;
}

async function paymongoRequest(method, path, body, secretKey) {
  const https = require('https');
  const key = secretKey || process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error('PAYMONGO_SECRET_KEY not set');
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.paymongo.com',
        path: path.startsWith('/') ? path : `/${path}`,
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => {
          let json = null;
          try {
            json = d ? JSON.parse(d) : {};
          } catch {
            return reject(new Error('Invalid PayMongo JSON'));
          }
          if (r.statusCode >= 400) {
            const msg = (json.errors && json.errors[0] && json.errors[0].detail) || `PayMongo HTTP ${r.statusCode}`;
            const err = new Error(msg);
            err.status = r.statusCode;
            err.body = json;
            return reject(err);
          }
          resolve(json);
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Create a PayMongo Checkout Session for a subscription quote.
 * Amount charged = PHP conversion of totalCents (USD + VAT).
 */
async function createCheckoutSession({
  quote,
  user,
  successUrl,
  cancelUrl,
  description,
  metadata = {},
}) {
  const rate = DEFAULT_USD_PHP_RATE;
  const phpCentavos = usdCentsToPhpCentavos(quote.totalCents, rate);
  const attrs = {
    send_email_receipt: true,
    show_description: true,
    show_line_items: true,
    description: description || `StatVibe ${quote.plan} subscription`,
    line_items: [
      {
        currency: 'PHP',
        amount: phpCentavos,
        name: `StatVibe ${quote.plan}${quote.saleApplied ? ' (Beta Sale)' : ''}`,
        quantity: 1,
        description: `Subtotal $${(quote.subtotalCents / 100).toFixed(2)} + 12% VAT $${(quote.vatCents / 100).toFixed(2)}`,
      },
    ],
    payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay', 'qrph'],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...metadata,
      plan: quote.plan,
      subtotal_usd_cents: String(quote.subtotalCents),
      vat_usd_cents: String(quote.vatCents),
      total_usd_cents: String(quote.totalCents),
      user_id: user && user.id ? String(user.id) : '',
    },
  };
  const result = await paymongoRequest('POST', '/v1/checkout_sessions', { data: { attributes: attrs } });
  return {
    result,
    phpCentavos,
    usdPhpRate: rate,
    checkoutId: result && result.data && result.data.id,
    checkoutUrl:
      result &&
      result.data &&
      result.data.attributes &&
      (result.data.attributes.checkout_url || result.data.attributes.url),
  };
}

function verifyPaymongoSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  const crypto = require('crypto');
  // PayMongo sends: t=timestamp,te=test_sig,li=live_sig
  const parts = String(signatureHeader).split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const timestamp = parts.t;
  const sig = parts.te || parts.li || parts.v1;
  if (!timestamp || !sig) return false;
  const payload = `${timestamp}.${typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return expected === sig;
  }
}

const NOTIFICATION_CATEGORIES = [
  'maintenance',
  'sale',
  'system_update',
  'urgent',
];

module.exports = {
  VAT_RATE,
  DEFAULT_USD_PHP_RATE,
  DEFAULT_SUBSCRIPTIONS_CONFIG,
  NOTIFICATION_CATEGORIES,
  roundCents,
  quoteTier,
  mergeConfig,
  catalogQuotes,
  usdCentsToPhpCentavos,
  phpPesosFromUsdCents,
  paymongoRequest,
  createCheckoutSession,
  verifyPaymongoSignature,
};
