import { ensureSeeded } from './store';

export type RangeKey = 'day' | 'week' | 'month' | 'year';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketKey(date: Date, range: RangeKey) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (range === 'day') return `${y}-${m}-${d}`;
  if (range === 'week') {
    const tmp = startOfDay(date);
    const day = (tmp.getDay() + 6) % 7;
    tmp.setDate(tmp.getDate() - day);
    return `W ${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}-${String(tmp.getDate()).padStart(2, '0')}`;
  }
  if (range === 'month') return `${y}-${m}`;
  return String(y);
}

function lookback(range: RangeKey) {
  const now = new Date();
  const start = new Date(now);
  if (range === 'day') start.setDate(now.getDate() - 13);
  else if (range === 'week') start.setDate(now.getDate() - 7 * 11);
  else if (range === 'month') start.setMonth(now.getMonth() - 11);
  else start.setFullYear(now.getFullYear() - 4);
  return startOfDay(start);
}

export async function revenueSeries(range: RangeKey = 'month') {
  const store = await ensureSeeded();
  const from = lookback(range);
  const map = new Map<string, number>();

  for (const t of store.transactions) {
    if (t.status !== 'succeeded') continue;
    const at = new Date(t.createdAt);
    if (at < from) continue;
    const key = bucketKey(at, range);
    map.set(key, (map.get(key) || 0) + t.amount / 100);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, revenue]) => ({ label, revenue: Math.round(revenue) }));
}

export async function volumeSeries(range: RangeKey = 'month') {
  const store = await ensureSeeded();
  const from = lookback(range);
  const map = new Map<string, number>();

  for (const t of store.transactions) {
    const at = new Date(t.createdAt);
    if (at < from) continue;
    const key = bucketKey(at, range);
    map.set(key, (map.get(key) || 0) + 1);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count }));
}

export async function userSegments() {
  const store = await ensureSeeded();
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const active = store.users.filter((u) => u.status === 'APPROVED' && u.lastActiveAt).length;
  const newlyCreated = store.users.filter((u) => now - new Date(u.createdAt).getTime() <= weekMs).length;
  const pending = store.users.filter((u) => u.status === 'PENDING').length;
  return [
    { name: 'Active Users', value: active, fill: '#2563EB' },
    { name: 'Newly Created', value: newlyCreated, fill: '#10B981' },
    { name: 'Pending Approvals', value: pending, fill: '#F59E0B' },
  ];
}
