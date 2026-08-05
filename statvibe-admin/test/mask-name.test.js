const { test } = require('node:test');
const assert = require('node:assert/strict');

/** Mirror of src/lib/utils.ts maskName for a lightweight Node test. */
function maskName(fullName) {
  if (!fullName || !String(fullName).trim()) return '—';
  return String(fullName)
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 1) return part;
      if (part.length === 2) return `${part[0]}*`;
      const mid = '*'.repeat(Math.max(1, part.length - 2));
      return `${part[0]}${mid}${part[part.length - 1]}`;
    })
    .join(' ');
}

test('maskName half-masks John Smith', () => {
  assert.equal(maskName('John Smith'), 'J**n S***h');
});

test('maskName handles short tokens', () => {
  assert.equal(maskName('Al Bo'), 'A* B*');
});
