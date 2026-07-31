const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

describe('calc-math Retail vs Product', async () => {
  const math = await import(pathToFileURL(path.join(__dirname, '../lib/calc-math.mjs')).href);
  const base = { unitCost: 42, freight: 5.72, overhead: 5.1, markup: 55, targetMargin: 55 };

  it('shares the same total cost', () => {
    assert.equal(math.totalCost(base), 52.82);
  });

  it('Retail uses markup: price = cost × (1 + markup%)', () => {
    const r = math.computeRetail(base);
    assert.ok(Math.abs(r.price - 52.82 * 1.55) < 1e-9);
    assert.equal(r.markup, 55);
    // 55% markup → ~35.48% margin (not 55%)
    assert.ok(r.margin > 35 && r.margin < 36);
    assert.ok(Math.abs(r.profit - (r.price - 52.82)) < 1e-9);
  });

  it('Product uses target margin: price = cost / (1 − margin%)', () => {
    const p = math.computeProduct(base);
    assert.ok(Math.abs(p.price - 52.82 / 0.45) < 1e-9);
    assert.equal(p.targetMargin, 55);
    assert.ok(Math.abs(p.margin - 55) < 0.05);
  });

  it('Retail and Product prices differ for the same inputs', () => {
    const r = math.computeRetail(base);
    const p = math.computeProduct(base);
    assert.notEqual(r.price, p.price);
    assert.ok(p.price > r.price); // margin pricing yields a higher shelf price at 55%
  });

  it('computePricing dispatches by tab', () => {
    assert.equal(math.computePricing({ ...base, tab: 'Retail' }).mode, 'Retail');
    assert.equal(math.computePricing({ ...base, tab: 'Product' }).mode, 'Product');
  });
});
