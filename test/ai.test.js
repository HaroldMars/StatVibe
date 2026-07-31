const test = require('node:test');
const assert = require('node:assert');
const ai = require('../lib/ai');

test('enrichMessages injects accuracy system prompt and keeps user turn', () => {
  const out = ai.enrichMessages(
    [{ role: 'user', content: 'What is my best next pricing move?' }],
    { account: { businessName: 'Peak Shop', industry: 'Retail', currency: 'PHP', plan: 'Free' }, user: { name: 'Jay' } },
  );
  assert.equal(out[0].role, 'system');
  assert.match(out[0].content, /main question|concern/i);
  assert.match(out[0].content, /Peak Shop/);
  assert.equal(out[1].role, 'user');
  assert.match(out[1].content, /pricing/);
});

test('simulate mirrors the ask instead of inventing a board update', () => {
  const content = ai.simulate([{ role: 'user', content: 'Help me draft a reorder email for late rice stock' }]);
  assert.match(content, /Direct answer|reorder|rice|email/i);
  assert.doesNotMatch(content, /Q3 Board Update/);
});
