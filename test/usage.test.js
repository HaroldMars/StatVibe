const test = require('node:test');
const assert = require('node:assert');
const usage = require('../lib/usage');

test('Free plan resets after one week', () => {
  const start = Date.now() - (8 * 24 * 3600 * 1000);
  const a = usage.ensureUsage({ plan: 'Free', aiUsed: 1000, aiPeriodStart: start });
  assert.equal(a.aiUsed, 0);
  assert.ok(a.aiPeriodStart > start);
  assert.equal(a.aiLimit, 1000);
  assert.equal(a.aiResetDays >= 6, true);
});

test('consume blocks at Free weekly limit', () => {
  const blocked = usage.consume({ plan: 'Free', aiUsed: 1000, aiPeriodStart: Date.now() }, 1);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'quota_exceeded');
});

test('consume increments within Free weekly limit', () => {
  const ok = usage.consume({ plan: 'Free', aiUsed: 10, aiPeriodStart: Date.now() }, 1);
  assert.equal(ok.ok, true);
  assert.equal(ok.account.aiUsed, 11);
  assert.equal(ok.usage.period, 'week');
});

test('Pro uses monthly period and higher limit', () => {
  const v = usage.usageView({ plan: 'Pro', aiUsed: 3, aiPeriodStart: Date.now() });
  assert.equal(v.limit, 10000);
  assert.equal(v.period, 'month');
});
