'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const billing = require('../lib/billing');

describe('VAT calculation (12% excluded from base)', () => {
  it('Pro beta sale $10 → $1.20 VAT → $11.20 total', () => {
    const tier = billing.DEFAULT_SUBSCRIPTIONS_CONFIG.tiers.Pro;
    const q = billing.quoteTier(tier, { betaSaleEnabled: true, firstTime: true, vatRate: 0.12 });
    assert.equal(q.subtotalCents, 1000);
    assert.equal(q.vatCents, 120);
    assert.equal(q.totalCents, 1120);
    assert.equal(q.display.subtotal, 10);
    assert.equal(q.display.vat, 1.2);
    assert.equal(q.display.total, 11.2);
    assert.equal(q.saleApplied, true);
  });

  it('Business beta sale $49 → $5.88 VAT → $54.88 total', () => {
    const tier = billing.DEFAULT_SUBSCRIPTIONS_CONFIG.tiers.Business;
    const q = billing.quoteTier(tier, { betaSaleEnabled: true, firstTime: true, vatRate: 0.12 });
    assert.equal(q.subtotalCents, 4900);
    assert.equal(q.vatCents, 588);
    assert.equal(q.totalCents, 5488);
    assert.equal(q.display.subtotal, 49);
    assert.equal(q.display.vat, 5.88);
    assert.equal(q.display.total, 54.88);
  });

  it('Pro full price $20 → $2.40 VAT when sale off or returning user', () => {
    const tier = billing.DEFAULT_SUBSCRIPTIONS_CONFIG.tiers.Pro;
    const off = billing.quoteTier(tier, { betaSaleEnabled: false, firstTime: true });
    assert.equal(off.subtotalCents, 2000);
    assert.equal(off.vatCents, 240);
    assert.equal(off.totalCents, 2240);
    const returning = billing.quoteTier(tier, { betaSaleEnabled: true, firstTime: false });
    assert.equal(returning.subtotalCents, 2000);
    assert.equal(returning.saleApplied, false);
  });
});

describe('subscriptions_config merge & catalog', () => {
  it('admin override of sale price is reflected in quotes', () => {
    const cfg = billing.mergeConfig({
      betaSaleEnabled: true,
      tiers: { Pro: { salePriceCents: 800, saleActive: true } },
    });
    assert.equal(cfg.tiers.Pro.salePriceCents, 800);
    assert.equal(cfg.tiers.Pro.basePriceCents, 2000);
    const { quotes } = billing.catalogQuotes(cfg, { firstTime: true });
    assert.equal(quotes.Pro.subtotalCents, 800);
    assert.equal(quotes.Pro.vatCents, 96);
    assert.equal(quotes.Pro.totalCents, 896);
  });
});

describe('PayMongo PHP conversion', () => {
  it('converts USD cents to PHP centavos at USD_PHP_RATE', () => {
    const rate = 56;
    // $11.20 * 56 = ₱627.20 → 62720 centavos
    const centavos = billing.usdCentsToPhpCentavos(1120, rate);
    assert.equal(centavos, 62720);
  });
});

describe('webhook signature', () => {
  it('verifies PayMongo-style HMAC signature', () => {
    const crypto = require('crypto');
    const secret = 'whsec_test';
    const raw = '{"data":{"attributes":{"type":"payment.paid"}}}';
    const t = String(Math.floor(Date.now() / 1000));
    const te = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
    const header = `t=${t},te=${te}`;
    assert.equal(billing.verifyPaymongoSignature(raw, header, secret), true);
    assert.equal(billing.verifyPaymongoSignature(raw, header, 'wrong'), false);
  });
});
