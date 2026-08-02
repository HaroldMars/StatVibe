// Revenue entries — append-only log; total = sum; chart = cumulative over time.
// Shared server helpers (sanitize, migrate, series).

function newId(prefix = 'rev') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function sanitizeEntry(raw, { requireId = false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const createdAt = Number(raw.createdAt) || Date.now();
  const id = raw.id ? String(raw.id).slice(0, 40) : (requireId ? null : newId());
  if (requireId && !id) return null;
  const note = raw.note != null ? String(raw.note).trim().slice(0, 120) : '';
  const category = raw.category != null ? String(raw.category).trim().slice(0, 40) : '';
  return { id, amount, createdAt, note: note || undefined, category: category || undefined };
}

function sanitizeEntries(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const e = sanitizeEntry(raw, { requireId: true });
    if (e) out.push(e);
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

/** If legacy statsDraft.revenue exists and there are no entries, seed one entry. */
function migrateAccountRevenue(account) {
  const acct = account && typeof account === 'object' ? { ...account } : {};
  let entries = sanitizeEntries(acct.revenueEntries);
  if (!entries.length) {
    const legacy = Number(String((acct.statsDraft && acct.statsDraft.revenue) || '').replace(/[^\d.-]/g, ''));
    if (Number.isFinite(legacy) && legacy > 0) {
      entries = [{
        id: newId(),
        amount: legacy,
        createdAt: Number(acct.createdAt) || Date.now(),
        note: 'Imported from previous total',
      }];
    }
  }
  acct.revenueEntries = entries;
  return acct;
}

function totalRevenue(entries) {
  return sanitizeEntries(entries).reduce((s, e) => s + e.amount, 0);
}

function pad2(n) { return String(n).padStart(2, '0'); }

function bucketKey(ts, period) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  if (period === 'month') return `${y}-${m}`;
  if (period === 'week') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (start.getDay() + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - dow);
    return `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
  }
  return `${y}-${m}-${day}`;
}

/**
 * Group entries by day|week|month and build a cumulative running total.
 * Returns [{ key, label, periodTotal, cumulative }] sorted oldest → newest.
 */
function cumulativeSeries(entries, period = 'day') {
  const p = period === 'week' || period === 'month' ? period : 'day';
  const sorted = sanitizeEntries(entries);
  const buckets = new Map();
  for (const e of sorted) {
    const k = bucketKey(e.createdAt, p);
    buckets.set(k, (buckets.get(k) || 0) + e.amount);
  }
  const keys = [...buckets.keys()].sort();
  let run = 0;
  return keys.map((key) => {
    const periodTotal = buckets.get(key);
    run += periodTotal;
    return { key, label: key, periodTotal, cumulative: run };
  });
}

module.exports = {
  newId, sanitizeEntry, sanitizeEntries, migrateAccountRevenue,
  totalRevenue, cumulativeSeries, bucketKey,
};
