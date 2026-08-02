const test = require('node:test');
const assert = require('node:assert');
const rev = require('../lib/revenue');

test('totalRevenue sums signed entries', () => {
  assert.equal(rev.totalRevenue([
    { id: '1', amount: 100, createdAt: 1 },
    { id: '2', amount: 40.5, createdAt: 2 },
  ]), 140.5);
});

test('totalRevenue falls when refunds are included', () => {
  assert.equal(rev.totalRevenue([
    { id: '1', amount: 1000, kind: 'sale', createdAt: 1 },
    { id: '2', amount: -250, kind: 'refund', createdAt: 2 },
  ]), 750);
});

test('cumulativeSeries grows by day', () => {
  const day1 = Date.parse('2026-07-01T12:00:00Z');
  const day2 = Date.parse('2026-07-02T12:00:00Z');
  const series = rev.cumulativeSeries([
    { id: 'a', amount: 100, createdAt: day1 },
    { id: 'b', amount: 50, createdAt: day1 },
    { id: 'c', amount: 25, createdAt: day2 },
  ], 'day');
  assert.equal(series.length, 2);
  assert.equal(series[0].periodTotal, 150);
  assert.equal(series[0].cumulative, 150);
  assert.equal(series[1].periodTotal, 25);
  assert.equal(series[1].cumulative, 175);
});

test('cumulativeSeries dips when a refund lands', () => {
  const t0 = Date.parse('2026-07-01T10:00:00Z');
  const t1 = Date.parse('2026-07-01T11:00:00Z');
  const t2 = Date.parse('2026-07-01T12:00:00Z');
  const series = rev.cumulativeSeries([
    { id: 'a', amount: 500, kind: 'sale', createdAt: t0 },
    { id: 'b', amount: 200, kind: 'sale', createdAt: t1 },
    { id: 'c', amount: -150, kind: 'refund', createdAt: t2 },
  ], 'live');
  assert.equal(series.length, 3);
  assert.equal(series[0].cumulative, 500);
  assert.equal(series[1].cumulative, 700);
  assert.equal(series[2].cumulative, 550);
  assert.equal(series[2].periodTotal, -150);
});

test('periodDelta reports down when last bucket nets lower', () => {
  const day1 = Date.parse('2026-07-01T12:00:00Z');
  const day2 = Date.parse('2026-07-02T12:00:00Z');
  const series = rev.cumulativeSeries([
    { id: 'a', amount: 400, kind: 'sale', createdAt: day1 },
    { id: 'b', amount: -100, kind: 'refund', createdAt: day2 },
  ], 'day');
  const d = rev.periodDelta(series);
  assert.equal(d.direction, 'down');
  assert.equal(d.abs, -100);
});

test('migrateAccountRevenue seeds from legacy statsDraft.revenue', () => {
  const acct = rev.migrateAccountRevenue({
    statsDraft: { revenue: '5000', products: '10', avgPrice: '50' },
    createdAt: 1000,
  });
  assert.equal(acct.revenueEntries.length, 1);
  assert.equal(acct.revenueEntries[0].amount, 5000);
  assert.equal(rev.totalRevenue(acct.revenueEntries), 5000);
});

test('cumulativeSeries live mode plots each entry', () => {
  const t0 = Date.parse('2026-07-01T10:00:00Z');
  const t1 = Date.parse('2026-07-01T11:00:00Z');
  const series = rev.cumulativeSeries([
    { id: 'a', amount: 100, createdAt: t0 },
    { id: 'b', amount: 50, createdAt: t1 },
  ], 'live');
  assert.equal(series.length, 2);
  assert.equal(series[0].cumulative, 100);
  assert.equal(series[1].cumulative, 150);
});

test('sanitizeEntry rejects zero; stores refunds as negative', () => {
  assert.equal(rev.sanitizeEntry({ amount: 0 }), null);
  const refund = rev.sanitizeEntry({ amount: 50, kind: 'refund' });
  assert.ok(refund);
  assert.equal(refund.kind, 'refund');
  assert.equal(refund.amount, -50);
  const negSale = rev.sanitizeEntry({ amount: -5 });
  assert.ok(negSale);
  assert.equal(negSale.kind, 'refund');
  assert.equal(negSale.amount, -5);
  assert.ok(rev.sanitizeEntry({ amount: 12.5 }));
});
