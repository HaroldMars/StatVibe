// Revenue entries — signed ledger; total = sum; chart tracks up AND down.
// Mirrors public/js/revenue-math.js behavior on the server.

function newId(prefix = 'rev') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function sanitizeEntry(raw, { requireId = false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  let amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount === 0) return null;
  const kindRaw = String(raw.kind || raw.type || '').toLowerCase();
  let kind = 'sale';
  if (kindRaw === 'refund' || kindRaw === 'return' || kindRaw === 'adjustment' || kindRaw === 'adjust') {
    kind = kindRaw === 'adjustment' || kindRaw === 'adjust' ? 'adjustment' : 'refund';
  }
  // Refunds are stored as negative so totals/charts fall when money goes out.
  if (kind === 'refund' && amount > 0) amount = -amount;
  if (kind === 'sale' && amount < 0) kind = 'refund';
  if (kind === 'adjustment') {
    // keep signed amount as entered
  }
  const createdAt = Number(raw.createdAt) || Date.now();
  const id = raw.id ? String(raw.id).slice(0, 40) : (requireId ? null : newId());
  if (requireId && !id) return null;
  const note = raw.note != null ? String(raw.note).trim().slice(0, 120) : '';
  const category = raw.category != null ? String(raw.category).trim().slice(0, 40) : '';
  const clientRequestId = raw.clientRequestId != null
    ? String(raw.clientRequestId).trim().slice(0, 80)
    : (raw.idempotencyKey != null ? String(raw.idempotencyKey).trim().slice(0, 80) : '');
  const branchId = raw.branchId != null ? String(raw.branchId).trim().slice(0, 40) : '';
  return {
    id,
    amount,
    kind,
    createdAt,
    note: note || undefined,
    category: category || undefined,
    clientRequestId: clientRequestId || undefined,
    branchId: branchId || undefined,
  };
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
    if (Number.isFinite(legacy) && legacy !== 0) {
      entries = [{
        id: newId(),
        amount: legacy,
        kind: legacy < 0 ? 'adjustment' : 'sale',
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
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    return `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
  }
  return `${y}-${m}-${day}`;
}

/**
 * Cumulative running total (can fall on refunds) — Stripe/Shopify-style net volume.
 */
function cumulativeSeries(entries, period = 'live') {
  const sorted = sanitizeEntries(entries);
  if (period === 'live' || period === 'entry') {
    let run = 0;
    return sorted.map((e, i) => {
      run += e.amount;
      return { key: e.id || String(i), label: String(e.createdAt), periodTotal: e.amount, cumulative: run };
    });
  }
  const p = period === 'week' || period === 'month' ? period : 'day';
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

/** Last step of the cumulative line (sale climbs / refund dips) — for up/down badge. */
function periodDelta(series) {
  if (!series || !series.length) {
    return { abs: 0, pct: null, direction: 'flat', current: 0, previous: 0 };
  }
  if (series.length < 2) {
    const only = series[0].cumulative;
    const direction = only > 0 ? 'up' : only < 0 ? 'down' : 'flat';
    return { abs: only, pct: null, direction, current: only, previous: 0 };
  }
  const current = series[series.length - 1].cumulative;
  const previous = series[series.length - 2].cumulative;
  const abs = current - previous;
  const pct = previous === 0 ? null : (abs / Math.abs(previous)) * 100;
  const direction = abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat';
  return { abs, pct, direction, current, previous };
}

module.exports = {
  newId, sanitizeEntry, sanitizeEntries, migrateAccountRevenue,
  totalRevenue, cumulativeSeries, bucketKey, periodDelta,
};
