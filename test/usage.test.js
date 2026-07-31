const test = require('node:test');
const assert = require('node:assert');
const usage = require('../lib/usage');

test('Free plan resets after one week', () => {
  const start = Date.now() - (8 * 24 * 3600 * 1000);
  const a = usage.ensureUsage({ plan: 'Free', aiUsed: 50000, aiPeriodStart: start });
  assert.equal(a.aiUsed, 0);
  assert.ok(a.aiPeriodStart > start);
  assert.equal(a.aiLimit, 50000);
  assert.equal(a.aiResetDays >= 6, true);
});

test('consume blocks at Free weekly token limit', () => {
  const blocked = usage.consume({ plan: 'Free', aiUsed: 50000, aiPeriodStart: Date.now() }, 100);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'quota_exceeded');
  assert.match(blocked.error, /tokens/i);
});

test('billTokens increments by real token amount', () => {
  const ok = usage.billTokens({ plan: 'Free', aiUsed: 10, aiPeriodStart: Date.now() }, 420);
  assert.equal(ok.ok, true);
  assert.equal(ok.account.aiUsed, 430);
  assert.equal(ok.usage.period, 'week');
  assert.equal(ok.usage.unit, 'tokens');
});

test('Pro uses monthly period and 1M token limit', () => {
  const v = usage.usageView({ plan: 'Pro', aiUsed: 3, aiPeriodStart: Date.now() });
  assert.equal(v.limit, 1000000);
  assert.equal(v.period, 'month');
  assert.equal(v.unit, 'tokens');
});
