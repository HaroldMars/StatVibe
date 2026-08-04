const test = require('node:test');
const assert = require('node:assert');
const br = require('../lib/branches');
const rev = require('../lib/revenue');

test('sanitizeBranch derives healthy / low / critical supply status', () => {
  const healthy = br.sanitizeBranch({ name: 'Alpha', lat: 14.6, lng: 120.9, stockLevel: 100, stockThreshold: 25 });
  assert.equal(healthy.supplyStatus, 'healthy');
  const low = br.sanitizeBranch({ name: 'Beta', lat: 14.6, lng: 120.9, stockLevel: 20, stockThreshold: 25 });
  assert.equal(low.supplyStatus, 'low');
  const critical = br.sanitizeBranch({ name: 'Gamma', lat: 14.6, lng: 120.9, stockLevel: 5, stockThreshold: 25 });
  assert.equal(critical.supplyStatus, 'critical');
});

test('sanitizeBranch enforces visibility and sharedWith', () => {
  const priv = br.sanitizeBranch({ name: 'HQ', lat: 0, lng: 0, visibility: 'private', sharedWith: ['a@b.com'] });
  assert.equal(priv.visibility, 'private');
  assert.deepEqual(priv.sharedWith, []);
  const shared = br.sanitizeBranch({ name: 'HQ', lat: 0, lng: 0, visibility: 'shared', sharedWith: ['ops@team.com', ''] });
  assert.equal(shared.visibility, 'shared');
  assert.deepEqual(shared.sharedWith, ['ops@team.com']);
});

test('sanitizeEntry keeps clientRequestId and branchId for idempotency', () => {
  const e = rev.sanitizeEntry({
    amount: 100,
    kind: 'sale',
    clientRequestId: 'cr_abc123',
    branchId: 'br_1',
  });
  assert.equal(e.clientRequestId, 'cr_abc123');
  assert.equal(e.branchId, 'br_1');
});
