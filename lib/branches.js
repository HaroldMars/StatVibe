// Branch profiles for multi-location StatVibe map.

function newId(prefix = 'br') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const VIS = new Set(['private', 'public', 'shared']);

function deriveStatus(stockLevel, threshold) {
  const stock = Number(stockLevel);
  const thr = Number(threshold);
  if (!Number.isFinite(stock)) return 'healthy';
  const t = Number.isFinite(thr) ? thr : 20;
  if (stock <= Math.max(5, t * 0.35)) return 'critical';
  if (stock <= t) return 'low';
  return 'healthy';
}

function sanitizeBranch(raw, { requireId = false } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim().slice(0, 80);
  if (!name) return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const visibility = VIS.has(String(raw.visibility || '').toLowerCase())
    ? String(raw.visibility).toLowerCase()
    : 'private';
  const stockLevel = Math.max(0, Number(raw.stockLevel) || 0);
  const stockThreshold = Math.max(0, Number(raw.stockThreshold) || 20);
  const id = raw.id ? String(raw.id).slice(0, 40) : (requireId ? null : newId());
  if (requireId && !id) return null;
  const sharedWith = Array.isArray(raw.sharedWith)
    ? raw.sharedWith.map((s) => String(s).trim().slice(0, 80)).filter(Boolean).slice(0, 40)
    : [];
  return {
    id,
    name,
    address: String(raw.address || '').trim().slice(0, 160) || undefined,
    lat,
    lng,
    visibility,
    sharedWith: visibility === 'shared' ? sharedWith : [],
    stockLevel,
    stockThreshold,
    supplyStatus: deriveStatus(stockLevel, stockThreshold),
    dailyRevenue: Math.max(0, Number(raw.dailyRevenue) || 0),
    staffCount: Math.max(0, Math.min(9999, Number(raw.staffCount) || 0)),
    icon: String(raw.icon || 'store').slice(0, 24),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Date.now(),
  };
}

function sanitizeBranches(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const b = sanitizeBranch(raw, { requireId: true });
    if (b) out.push(b);
  }
  return out;
}

module.exports = { newId, sanitizeBranch, sanitizeBranches, deriveStatus };
