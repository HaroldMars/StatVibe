const test = require('node:test');
const assert = require('node:assert');
const rev = require('../lib/revenue');

test('totalRevenue sums entries', () => {
  assert.equal(rev.totalRevenue([
    { id: '1', amount: 100, createdAt: 1 },
    { id: '2', amount: 40.5, createdAt: 2 },
  ]), 140.5);
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

test('migrateAccountRevenue seeds from legacy statsDraft.revenue', () => {
  const acct = rev.migrateAccountRevenue({
    statsDraft: { revenue: '5000', products: '10', avgPrice: '50' },
    createdAt: 1000,
  });
  assert.equal(acct.revenueEntries.length, 1);
  assert.equal(acct.revenueEntries[0].amount, 5000);
  assert.equal(rev.totalRevenue(acct.revenueEntries), 5000);
});

test('sanitizeEntry rejects non-positive amounts', () => {
  assert.equal(rev.sanitizeEntry({ amount: 0 }), null);
  assert.equal(rev.sanitizeEntry({ amount: -5 }), null);
  assert.ok(rev.sanitizeEntry({ amount: 12.5 }));
});
