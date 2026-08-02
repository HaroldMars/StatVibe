// Client-side revenue math (mirrors lib/revenue.js series logic).

export function revenueEntries(accountOrList) {
  if (Array.isArray(accountOrList)) return accountOrList.slice();
  const list = (accountOrList && accountOrList.revenueEntries) || [];
  return Array.isArray(list) ? list.slice() : [];
}

export function totalRevenue(entries) {
  return revenueEntries(entries).reduce((s, e) => s + (Number(e.amount) || 0), 0);
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

export function cumulativeSeries(entries, period = 'day') {
  const p = period === 'week' || period === 'month' ? period : 'day';
  const sorted = revenueEntries(entries).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const buckets = new Map();
  for (const e of sorted) {
    const k = bucketKey(e.createdAt || Date.now(), p);
    buckets.set(k, (buckets.get(k) || 0) + (Number(e.amount) || 0));
  }
  const keys = [...buckets.keys()].sort();
  let run = 0;
  return keys.map((key) => {
    const periodTotal = buckets.get(key);
    run += periodTotal;
    return { key, label: key, periodTotal, cumulative: run };
  });
}

/** Build an SVG path for a cumulative line chart (viewBox 0 0 W H). */
export function seriesToSvg(series, { width = 300, height = 100, padY = 12 } = {}) {
  if (!series.length) {
    return { line: '', area: '', points: [], max: 0 };
  }
  const max = Math.max(...series.map((s) => s.cumulative), 1);
  const n = series.length;
  const pts = series.map((s, i) => {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
    const y = height - padY - ((s.cumulative / max) * (height - padY * 2));
    return { x, y, ...s };
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area = `M${first.x.toFixed(1)},${height} L${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} L${last.x.toFixed(1)},${height} Z`;
  return { line, area, points: pts, max };
}
