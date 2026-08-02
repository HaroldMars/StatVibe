// Client-side revenue math — signed amounts so charts rise and fall (Stripe/Shopify style).

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

export function cumulativeSeries(entries, period = 'live') {
  const sorted = revenueEntries(entries).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (period === 'live' || period === 'entry') {
    let run = 0;
    return sorted.map((e, i) => {
      const amount = Number(e.amount) || 0;
      run += amount;
      const d = new Date(e.createdAt || Date.now());
      const label = `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      return { key: e.id || String(i), label, periodTotal: amount, cumulative: run, kind: e.kind || (amount < 0 ? 'refund' : 'sale') };
    });
  }
  const p = period === 'week' || period === 'month' ? period : 'day';
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

/** Last step of the cumulative line — badge rises on sales, falls on refunds. */
export function periodDelta(series) {
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

/** Net of all period totals in the visible window (up / down / flat). */
export function trendDelta(series) {
  if (!series || !series.length) return { abs: 0, pct: null, direction: 'flat' };
  const abs = series.reduce((s, p) => s + (Number(p.periodTotal) || 0), 0);
  const direction = abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat';
  return { abs, pct: null, direction };
}

/**
 * SVG line that can rise OR fall (handles negative / refund dips).
 * Similar visual language to Stripe net volume / Shopify sales charts.
 */
export function seriesToSvg(series, { width = 300, height = 100, padY = 14, padX = 4 } = {}) {
  if (!series.length) {
    return { line: '', area: '', points: [], max: 0, min: 0, zeroY: height / 2 };
  }
  const vals = series.map((s) => s.cumulative);
  let min = Math.min(...vals, 0);
  let max = Math.max(...vals, 0);
  if (min === max) {
    max = min + 1;
    min = min - 1;
  }
  const span = max - min || 1;
  const n = series.length;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const pts = series.map((s, i) => {
    const x = padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = padY + ((max - s.cumulative) / span) * innerH;
    return { x, y, ...s };
  });
  const zeroY = padY + ((max - 0) / span) * innerH;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area = `M${first.x.toFixed(1)},${zeroY.toFixed(1)} L${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} L${last.x.toFixed(1)},${zeroY.toFixed(1)} Z`;
  return { line, area, points: pts, max, min, zeroY };
}

/** Stroke / fill for net-volume charts (green up, red down) — Stripe/Shopify style. */
export function chartTone(series) {
  const d = periodDelta(series);
  if (d.direction === 'down') {
    return { stroke: '#DC2626', fillId: 'svRevDown', stop: '#DC2626', direction: d.direction, delta: d };
  }
  return { stroke: '#0F766E', fillId: 'svRevUp', stop: '#0F766E', direction: d.direction, delta: d };
}

export function chartSvgMarkup(series, { width = 300, height = 100, gradId = 'svRevFill' } = {}) {
  const { line, area, zeroY, min, max } = seriesToSvg(series, { width, height });
  const tone = chartTone(series);
  const showZero = min < 0 && max > 0;
  const zero = showZero
    ? `<line x1="0" y1="${zeroY.toFixed(1)}" x2="${width}" y2="${zeroY.toFixed(1)}" stroke="rgba(15,23,42,.18)" stroke-width="1" stroke-dasharray="4 3"/>`
    : '';
  return {
    ...tone,
    html: `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${Math.round(height * 0.92)}" preserveAspectRatio="none" aria-label="Net revenue chart">
      <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone.stop}" stop-opacity=".28"/><stop offset="1" stop-color="${tone.stop}" stop-opacity="0"/></linearGradient></defs>
      ${zero}
      <path d="${area}" fill="url(#${gradId})"/>
      <path d="${line}" fill="none" stroke="${tone.stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  };
}
