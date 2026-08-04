const test = require('node:test');
const assert = require('node:assert');

// Mirror of public/js/features/messaging.js parseStatVibeCode (keep in sync).
function parseStatVibeCode(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const tagged = s.match(/(?:statvibe:|user:)\s*([A-Z0-9-]{4,})/i);
  if (tagged) return tagged[1].toUpperCase();
  const sv = s.match(/\b(SV-[A-Z0-9]{4,})\b/i);
  if (sv) return sv[1].toUpperCase();
  return s.toUpperCase().replace(/^STATVIBE:/i, '').replace(/^USER:/i, '').trim();
}

function mergeMessages(prev, next) {
  const map = new Map();
  const msgId = (m) => m && (m.id || m.clientId || `${m.from || ''}:${m.at || ''}:${String(m.text || '').slice(0, 24)}`);
  for (const m of [...(prev || []), ...(next || [])]) {
    if (!m) continue;
    const id = msgId(m);
    if (!id) continue;
    if (!map.has(id)) map.set(id, m);
    else {
      const cur = map.get(id);
      if (String(cur.id || '').startsWith('tmp_') && m.id && !String(m.id).startsWith('tmp_')) map.set(id, m);
      else if (m.id && !cur.id) map.set(id, m);
      else map.set(id, { ...cur, ...m });
    }
  }
  const list = [...map.values()].sort((a, b) => (a.at || 0) - (b.at || 0));
  const out = [];
  for (const m of list) {
    const prevM = out[out.length - 1];
    if (
      prevM
      && prevM.from === m.from
      && String(prevM.text || '').trim() === String(m.text || '').trim()
      && Math.abs((prevM.at || 0) - (m.at || 0)) < 4000
    ) {
      if (String(prevM.id || '').startsWith('tmp_') && m.id && !String(m.id).startsWith('tmp_')) out[out.length - 1] = m;
      continue;
    }
    out.push(m);
  }
  return out;
}

test('parseStatVibeCode extracts SV tags from QR payloads', () => {
  assert.equal(parseStatVibeCode('statvibe:SV-ABC123'), 'SV-ABC123');
  assert.equal(parseStatVibeCode('USER:SV-ZZ99'), 'SV-ZZ99');
  assert.equal(parseStatVibeCode('Hello SV-HELLO1 world'), 'SV-HELLO1');
  assert.equal(parseStatVibeCode('sv-lower1'), 'SV-LOWER1');
});

test('mergeMessages drops optimistic duplicates when server id arrives', () => {
  const merged = mergeMessages(
    [{ id: 'tmp_1', from: 'u1', text: 'Hi', at: 1000 }],
    [{ id: 'm_real', from: 'u1', text: 'Hi', at: 1001 }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'm_real');
});

test('mergeMessages keeps distinct messages', () => {
  const merged = mergeMessages(
    [{ id: 'a', from: 'u1', text: 'One', at: 1 }],
    [{ id: 'b', from: 'u2', text: 'Two', at: 2 }],
  );
  assert.equal(merged.length, 2);
});
