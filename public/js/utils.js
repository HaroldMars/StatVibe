import { state } from './state.js';
import { api } from './api.js';
import { computeRetail, computeProduct } from './calc-math.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const app = () => document.getElementById('app');
export const CLOUD = [
  { id: 'claude', label: 'Claude', vendor: 'Anthropic' },
  { id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI' },
  { id: 'gemini', label: 'Gemini', vendor: 'Google' },
  { id: 'grok', label: 'Grok', vendor: 'xAI' },
];
export function currency() {
  const code = (state.session.account && state.session.account.currency) || 'USD';
  return (state.session.currencies || []).find((c) => c.code === code) || { code, symbol: '$', dp: 2 };
}
export const money = (n) => { const c = currency(); return c.symbol + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: c.dp, maximumFractionDigits: c.dp }); };
export const statNum = (v) => {
  const n = Number(String(v || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const hasStatInputs = () => {
  const s = state.statsDraft || {};
  return statNum(s.revenue) > 0 && statNum(s.products) > 0 && statNum(s.avgPrice) > 0;
};
export function loadStatsDraft() {
  try {
    const raw = localStorage.getItem('sv_stats_draft');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    state.statsDraft = {
      revenue: parsed.revenue || '',
      products: parsed.products || '',
      avgPrice: parsed.avgPrice || '',
    };
  } catch { /* ignore */ }
}
export function saveStatsDraft() {
  try { localStorage.setItem('sv_stats_draft', JSON.stringify(state.statsDraft)); } catch { /* ignore */ }
  scheduleAccountPersist();
}
export function applyWorkspaceFromAccount(account) {
  if (!account) return;
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  if (account.statsDraft && typeof account.statsDraft === 'object') {
    state.statsDraft = {
      revenue: account.statsDraft.revenue || '',
      products: account.statsDraft.products || '',
      avgPrice: account.statsDraft.avgPrice || '',
    };
    saveStatsDraftLocalOnly();
  }
  if (account.calc && typeof account.calc === 'object') {
    state.calc = {
      tab: ['Retail', 'Product', 'Supply'].includes(account.calc.tab) ? account.calc.tab : state.calc.tab,
      unitCost: num(account.calc.unitCost, state.calc.unitCost),
      freight: num(account.calc.freight, state.calc.freight),
      overhead: num(account.calc.overhead, state.calc.overhead),
      targetMargin: num(account.calc.targetMargin, state.calc.targetMargin),
      markup: num(account.calc.markup, state.calc.markup),
    };
  }
  if (account.supply && typeof account.supply === 'object') {
    state.supply = {
      onHand: num(account.supply.onHand, 0),
      reorder: num(account.supply.reorder, 0),
      cover: num(account.supply.cover, 0),
    };
  }
}
export function saveStatsDraftLocalOnly() {
  try { localStorage.setItem('sv_stats_draft', JSON.stringify(state.statsDraft)); } catch { /* ignore */ }
}
let accountPersistTimer = null;
export function scheduleAccountPersist() {
  if (!state.authed || !(state.session.user) || state.session.user.isGuest) return;
  clearTimeout(accountPersistTimer);
  accountPersistTimer = setTimeout(() => { persistAccountWorkspace().catch(() => {}); }, 500);
}
export async function persistAccountWorkspace() {
  if (!state.authed || !(state.session.user) || state.session.user.isGuest) return;
  const { status, data } = await api('/account', {
    method: 'PATCH',
    body: { statsDraft: state.statsDraft, calc: state.calc, supply: state.supply },
  });
  if (status === 200 && data.account) state.session.account = data.account;
}
export function calcSummary() {
  const retail = computeRetail(state.calc);
  const product = computeProduct(state.calc);
  const active = state.calc.tab === 'Product' ? product : retail;
  const inv = state.session.inventory || [];
  const onHand = inv.reduce((sum, i) => sum + (Number(i.stock) || 0), 0) || (state.supply.onHand || 0);
  return {
    landed: active.cost,
    price: active.price,
    margin: active.margin,
    profit: active.profit,
    markup: retail.markup,
    targetMargin: product.targetMargin,
    retail,
    product,
    onHand,
    items: inv.length,
  };
}
export const bizName = () => (state.session.account && state.session.account.businessName) || 'My Business';
export const userName = () => (state.session.user && state.session.user.name) || 'Guest';
export const initials = (name) => (name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '·';
const cloudinaryBase = () => {
  const c = state.session.cloudinary;
  return c && c.enabled && c.cloudName ? `https://res.cloudinary.com/${c.cloudName}/image/fetch` : null;
};
export function imgSrc(src, { w, h } = {}) {
  if (!src) return src;
  // Keep same-origin static assets as direct paths so PWA/app icons and
  // local branding images never depend on third-party fetch transforms.
  if (src.startsWith('/')) return src;
  const base = cloudinaryBase();
  if (!base) return src;
  const full = src.startsWith('http://') || src.startsWith('https://') ? src : `${location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
  const tr = [`f_auto`, `q_auto`, `c_limit`];
  if (w) tr.push(`w_${Math.round(w)}`);
  if (h) tr.push(`h_${Math.round(h)}`);
  return `${base}/${tr.join(',')}/${encodeURIComponent(full)}`;
}
export function clientEmailOk(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// tiny markdown → html for AI output (bold, bullets, line breaks)
export function mdToHtml(md) {
  const lines = esc(md).split('\n');
  let html = '', inList = false;
  for (let raw of lines) {
    let line = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>').replace(/_(.+?)_/g, '<i>$1</i>');
    const hd = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (hd) {
      if (inList) { html += '</ul>'; inList = false; }
      const sz = [17, 15, 13.5, 12.5][hd[1].length - 1];
      html += `<div style="font-weight:700;font-size:${sz}px;letter-spacing:-.2px;margin:12px 0 4px">${hd[2]}</div>`;
      continue;
    }
    if (/^\s*[-•*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      if (!inList) { html += '<ul style="margin:6px 0;padding-left:18px">'; inList = true; }
      html += '<li style="margin:3px 0">' + line.replace(/^\s*([-•*]|\d+\.)\s+/, '') + '</li>';
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += line.trim() ? '<p style="margin:6px 0">' + line + '</p>' : '';
    }
  }
  if (inList) html += '</ul>';
  return html;
}

export const AV_COLORS = ['#5865f2', '#0E7C66', '#3A6070', '#B26B00', '#8E44AD', '#C0392B', '#2E86AB'];
export function avatarColor(seed) { let h = 0; for (const c of String(seed || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }
export function convAvatar(other, size = 52) {
  const c = avatarColor(other.tag || other.name);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${c};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(size / 2.6)}px;flex-shrink:0">${esc(initials(other.name))}</div>`;
}
export function relTime(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const days = Math.floor((now - d) / 86400000);
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function guestBanner() {
  return `<div class="card mb-16" style="background:var(--teal-ink);color:#eaf0ee;border:none">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">You're exploring as a guest</div>
    <div style="font-size:12px;color:#c3d6d0;line-height:1.5;margin-bottom:12px">Create a free account to save your business, inventory and notes — and to message clients. Guest data isn't saved.</div>
    <button class="btn sm mint" data-act="toRegister">Create free account</button>
  </div>`;
}
