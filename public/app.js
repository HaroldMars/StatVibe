/* ==========================================================================
   StatVibe — application logic
   Vanilla JS SPA. Faithful to the Slate Ledger design system.
   Every button/route is wired; AI surfaces call the local Ollama proxy.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------------- */
/* State                                                                   */
/* ----------------------------------------------------------------------- */
const state = {
  authed: false,
  session: { token: null, user: null, account: null, inventory: [], ideas: [], history: [], conversations: [], unreadTotal: 0, agentAutoReply: false, currencies: [], cloudinary: null, loaded: false },
  tab: 'stats',
  stack: [],            // sub-screen history: [{screen, params}]
  period: 'Month',
  calc: { tab: 'Retail', unitCost: 42.0, freight: 5.72, overhead: 5.1, targetMargin: 55, markup: 55 },
  supply: { onHand: 1240, reorder: 400, cover: 22 },
  setupDraft: { sellsProducts: true, goals: [] },
  predictions: {},   // itemId -> prediction result cache
  models: { engines: [], cloud: [], ollamaOnline: false, active: new Set(), blend: true, loaded: false },
  plan: 'Free',
  usage: { used: 780, limit: 1000, resetDays: 9 },
  statsDraft: { revenue: '', products: '', avgPrice: '' },
  aiPrefill: '',
  lastAIOutput: null,
  alerts: null,          // set on first render
  settings: { blend: true, appearance: 'System', notifications: true },
  auth: { remember: true },
  profile: { name: 'Jordan Doyle', email: 'jordan@illuminarypeak.co', role: 'Owner', phone: '+1 (555) 018-2245', tz: 'Pacific Time · PT' },
  workspace: 'Illuminary Peak',
  admin: { authed: false, token: null, summary: null, busy: false, testOut: null, user: 'GenAdmin' },
  // Real messaging: conversations live in state.session; the open thread here.
  chat: { convId: null, other: null, messages: [], draft: null, drafting: false },
};

/* ----------------------------------------------------------------------- */
/* Icons (inline SVG)                                                       */
/* ----------------------------------------------------------------------- */
const I = {
  back: `<svg width="12" height="20" viewBox="0 0 12 20" fill="none"><path d="M10 2L2 10l8 8" stroke="#5C6169" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bars: (c = '#9AA0A8', w = 21) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M5 21V11M12 21V5M19 21v-7" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  calc: (c = '#9AA0A8', w = 21) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2.5" stroke="${c}" stroke-width="1.8"/><path d="M8 8h8M8 12.5h2M12 12.5h.01M8 16.5h2M12 16.5h4" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  bulb: (c = '#9AA0A8', w = 21) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2V16h6v-.5c0-.8.3-1.3 1-2A6 6 0 0 0 12 3Z" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  spark: (c = '#9AA0A8', w = 21, fill = false) => fill
    ? `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="${c}"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2Z"/></svg>`
    : `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4L12 3Z" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  chat: (c = '#9AA0A8', w = 21) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H9l-4 3v-3H4V5Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  bell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M9.5 20a2.5 2.5 0 0 0 5 0" stroke="#5C6169" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: (c = '#0E7C66', w = 16) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  chevR: `<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="#C0C4CA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevDown: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#8A9099" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  send: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2Z"/></svg>`,
  arrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M12 5l7 7-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 15V3m0 12l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="#5C6169" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ellipsis: `<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="#5C6169"/><circle cx="12" cy="12" r="2" fill="#5C6169"/><circle cx="19" cy="12" r="2" fill="#5C6169"/></svg>`,
  copy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="#5C6169" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="#5C6169" stroke-width="1.7"/></svg>`,
  phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 5a16 16 0 0 0 15 15v-3.5l-4-1.5-2 2a12 12 0 0 1-5-5l2-2-1.5-4H4Z" stroke="#5C6169" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
};

/* ----------------------------------------------------------------------- */
/* Utilities                                                                */
/* ----------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const app = () => document.getElementById('app');
const CLOUD = [
  { id: 'claude', label: 'Claude', vendor: 'Anthropic' },
  { id: 'gpt-4o', label: 'GPT-4o', vendor: 'OpenAI' },
  { id: 'gemini', label: 'Gemini', vendor: 'Google' },
  { id: 'grok', label: 'Grok', vendor: 'xAI' },
];
function currency() {
  const code = (state.session.account && state.session.account.currency) || 'USD';
  return (state.session.currencies || []).find((c) => c.code === code) || { code, symbol: '$', dp: 2 };
}
const money = (n) => { const c = currency(); return c.symbol + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: c.dp, maximumFractionDigits: c.dp }); };
const statNum = (v) => {
  const n = Number(String(v || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const hasStatInputs = () => {
  const s = state.statsDraft || {};
  return statNum(s.revenue) > 0 && statNum(s.products) > 0 && statNum(s.avgPrice) > 0;
};
function loadStatsDraft() {
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
function saveStatsDraft() {
  try { localStorage.setItem('sv_stats_draft', JSON.stringify(state.statsDraft)); } catch { /* ignore */ }
}
const bizName = () => (state.session.account && state.session.account.businessName) || 'My Business';
const userName = () => (state.session.user && state.session.user.name) || 'Guest';
const initials = (name) => (name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '·';
const cloudinaryBase = () => {
  const c = state.session.cloudinary;
  return c && c.enabled && c.cloudName ? `https://res.cloudinary.com/${c.cloudName}/image/fetch` : null;
};
function imgSrc(src, { w, h } = {}) {
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
const STORAGE = { LOCAL_TOKEN: 'sv_token', SESSION_TOKEN: 'sv_session_token', THEME: 'sv_theme' };
function persistToken(token, remember) {
  try {
    if (remember) {
      localStorage.setItem(STORAGE.LOCAL_TOKEN, token);
      sessionStorage.removeItem(STORAGE.SESSION_TOKEN);
    } else {
      sessionStorage.setItem(STORAGE.SESSION_TOKEN, token);
      localStorage.removeItem(STORAGE.LOCAL_TOKEN);
    }
  } catch { /* ignore */ }
}
function clearTokenStorage() {
  try {
    localStorage.removeItem(STORAGE.LOCAL_TOKEN);
    sessionStorage.removeItem(STORAGE.SESSION_TOKEN);
    localStorage.removeItem('sv_remember');
  } catch { /* ignore */ }
}

// --- API + session --------------------------------------------------------
async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth && state.session.token) headers['Authorization'] = 'Bearer ' + state.session.token;
  let r;
  try { r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { return { status: 0, data: { error: 'Network error' } }; }
  let data = {}; try { data = await r.json(); } catch { /* no body */ }
  return { status: r.status, data };
}

function applySession(data, opts = {}) {
  if (data.token) {
    state.session.token = data.token;
    // Real accounts always persist; guests stay session-only.
    const remember = opts.remember != null ? opts.remember : !(data.user && data.user.isGuest);
    if (opts.persist !== false) persistToken(data.token, remember);
  }
  if (data.user) {
    state.session.user = data.user;
    state.profile.name = data.user.name || state.profile.name;
    state.profile.email = data.user.email || 'Guest session';
    state.profile.role = data.user.isGuest ? 'Guest' : 'Owner';
  }
  if (data.account) {
    state.session.account = data.account;
    if (data.account.plan) {
      state.plan = data.account.plan;
      const limits = { Free: 1000, Pro: 10000, Business: 50000, Enterprise: 999999 };
      if (limits[data.account.plan]) state.usage.limit = limits[data.account.plan];
    }
  }
  if (data.inventory) state.session.inventory = data.inventory;
  state.authed = !!state.session.user;
}

async function refreshInventory() {
  const { status, data } = await api('/inventory');
  if (status === 200) state.session.inventory = data.inventory;
}

// --- Theme (Light / Dark / System) ---------------------------------------
const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
function effectiveTheme() {
  const a = state.settings.appearance;
  if (a === 'Dark') return 'dark';
  if (a === 'Light') return 'light';
  return prefersDark() ? 'dark' : 'light'; // System / Default
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', effectiveTheme());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effectiveTheme() === 'dark' ? '#0f1214' : '#0e7c66');
}
function setAppearance(a) {
  state.settings.appearance = a;
  try { localStorage.setItem(STORAGE.THEME, a); } catch { /* ignore */ }
  applyTheme();
  closeSheet();
  render();
  toast('Appearance: ' + a);
}
function themePicker() {
  const cur = state.settings.appearance;
  const opt = (val, label, desc) => `<button class="row" data-theme-pick="${val}"><div><div style="font-size:14px">${label}</div><div style="font-size:11.5px;color:var(--muted-2)">${desc}</div></div><span class="val">${cur === val ? '✓' : ''}</span></button>`;
  openSheet(`<h3>Appearance</h3><div class="list" style="margin-top:12px">
    ${opt('Light', 'Light', 'Always light')}
    ${opt('Dark', 'Dark', 'Always dark')}
    ${opt('System', 'System (Default)', 'Match your device')}
  </div>`);
  setTimeout(() => { document.getElementById('sheet').querySelectorAll('[data-theme-pick]').forEach((b) => b.onclick = () => setAppearance(b.dataset.themePick)); }, 30);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// tiny markdown → html for AI output (bold, bullets, line breaks)
function mdToHtml(md) {
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

/* ----------------------------------------------------------------------- */
/* Sheet (bottom modal)                                                     */
/* ----------------------------------------------------------------------- */
function openSheet(html) {
  const s = document.getElementById('sheet');
  const b = document.getElementById('sheetBackdrop');
  s.innerHTML = '<div class="grab"></div>' + html;
  sheetDrag.enabled = true;
  sheetDrag.startY = 0;
  sheetDrag.deltaY = 0;
  s.style.transition = '';
  s.style.transform = '';
  b.classList.add('show');
  requestAnimationFrame(() => s.classList.add('show'));
}
function closeSheet() {
  sheetDrag.enabled = false;
  document.getElementById('sheet').classList.remove('show');
  document.getElementById('sheetBackdrop').classList.remove('show');
}
document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);

// Mobile UX: allow swipe-down to dismiss bottom sheet.
const sheetDrag = { enabled: false, startY: 0, deltaY: 0 };
const sheetEl = document.getElementById('sheet');
sheetEl.addEventListener('touchstart', (e) => {
  if (!sheetDrag.enabled) return;
  if (!sheetEl.classList.contains('show')) return;
  // Start drag only near the top/handle area so form scrolling still works.
  const t = e.touches && e.touches[0];
  if (!t) return;
  if (t.clientY > window.innerHeight - sheetEl.offsetHeight + 90) return;
  sheetDrag.startY = t.clientY;
  sheetDrag.deltaY = 0;
  sheetEl.style.transition = 'none';
}, { passive: true });
sheetEl.addEventListener('touchmove', (e) => {
  if (!sheetDrag.enabled || !sheetDrag.startY) return;
  const t = e.touches && e.touches[0];
  if (!t) return;
  const dy = t.clientY - sheetDrag.startY;
  if (dy <= 0) return;
  sheetDrag.deltaY = dy;
  sheetEl.style.transform = `translateY(${Math.min(dy, 220)}px)`;
}, { passive: true });
sheetEl.addEventListener('touchend', () => {
  if (!sheetDrag.enabled || !sheetDrag.startY) return;
  const shouldClose = sheetDrag.deltaY > 80;
  sheetEl.style.transition = 'transform 0.22s ease';
  if (shouldClose) {
    sheetEl.style.transform = 'translateY(100%)';
    setTimeout(() => {
      sheetEl.style.transform = '';
      sheetEl.style.transition = '';
      closeSheet();
    }, 170);
  } else {
    sheetEl.style.transform = '';
    setTimeout(() => { sheetEl.style.transition = ''; }, 220);
  }
  sheetDrag.startY = 0;
  sheetDrag.deltaY = 0;
}, { passive: true });

/* ----------------------------------------------------------------------- */
/* Router                                                                   */
/* ----------------------------------------------------------------------- */
function currentScreen() { return state.stack.length ? state.stack[state.stack.length - 1].screen : state.tab; }
function go(tab) { state.tab = tab; state.stack = []; render(); if (tab === 'agent') loadConversations().then(() => { if (state.tab === 'agent' && !state.stack.length) render(); }); }
function push(screen, params = {}) { state.stack.push({ screen, params }); render(); }
function back() { state.stack.pop(); render(); }

function render() {
  const el = app();
  const top = state.stack.length ? state.stack[state.stack.length - 1] : null;
  const topName = top ? top.screen : null;
  let html;
  if (topName === 'admin') {
    html = screens.admin();                                  // dev console — any time
  } else if (!state.authed) {
    html = topName === 'register' ? screens.register()
      : topName === 'login' ? screens.login()
      : topName === 'terms' ? screens.terms(top.params)
      : screens.welcome();
  } else if (!(state.session.account && state.session.account.setupComplete)) {
    html = topName === 'terms' ? screens.terms(top.params) : screens.setup();  // must finish setup first
  } else if (state.stack.length) {
    html = screens[topName](top.params);
  } else {
    html = tabScreens[state.tab]();
  }
  el.innerHTML = `<div class="screen fade-in">${html}</div>`;
  el.querySelector('.scroll') && (el.querySelector('.scroll').scrollTop = 0);
  wire(el);
}

/* ----------------------------------------------------------------------- */
/* Shared partials                                                          */
/* ----------------------------------------------------------------------- */
function tabbar(active) {
  const item = (id, label, icon, badge) => `
    <button data-tab="${id}" class="${active === id ? 'active' : ''}" style="position:relative">
      ${badge ? `<span style="position:absolute;top:-2px;right:8px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--red);color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-sizing:border-box">${badge > 9 ? '9+' : badge}</span>` : ''}
      ${icon(active === id ? '#0E7C66' : '#9AA0A8')}<span>${label}</span>
    </button>`;
  const unread = (state.session && state.session.unreadTotal) || 0;
  return `<div class="tabbar">
    ${item('stats', 'Stats', I.bars)}
    ${item('calc', 'Calc', I.calc)}
    ${item('hub', 'Hub', I.bulb)}
    ${item('ai', 'AI', (c) => I.spark(c))}
    ${item('agent', 'Agent', I.chat, active === 'agent' ? 0 : unread)}
  </div>`;
}

function appbar(title, { onSurface = false, right = '' } = {}) {
  return `<div class="appbar ${onSurface ? 'on-surface' : ''}">
    <button class="iconbtn ${onSurface ? 'plain' : ''}" data-act="back">${I.back}</button>
    <span class="title">${title}</span>
    ${right || '<div style="width:34px"></div>'}
  </div>`;
}

/* ----------------------------------------------------------------------- */
/* Auth screens                                                             */
/* ----------------------------------------------------------------------- */
const screens = {};

screens.welcome = () => `
  <div class="scroll" style="padding:70px 22px 14px;display:flex;flex-direction:column">
    <div class="flex items-center" style="gap:9px;margin-bottom:auto">
      <img src="${imgSrc('/logo-main.png', { w: 96, h: 96 })}" alt="StatVibe" style="width:34px;height:34px;border-radius:9px" />
      <span style="font-size:17px;font-weight:700;letter-spacing:-.2px">StatVibe</span>
    </div>
    <div style="margin:28px 0 26px">
      <div style="font-size:30px;font-weight:700;line-height:1.15;letter-spacing:-.6px">Run the whole business from one screen.</div>
      <div style="font-size:14px;color:var(--muted);line-height:1.5;margin-top:12px">Real-time analytics, AI planning, and client messaging — built for teams of any size, in any industry.</div>
    </div>
    <div class="stack gap-14" style="margin-bottom:26px">
      ${[['📊', 'Predictive dashboards', "See what's coming, not just what happened"],
         ['✨', 'Multi-model AI workspace', 'Blend the best models for every task'],
         ['💬', 'AgentTech assistant', 'AI handles client & partner messaging']]
        .map(([e, t, s]) => `<div class="flex items-center gap-12"><div style="width:38px;height:38px;border-radius:11px;background:var(--teal-tint);display:flex;align-items:center;justify-content:center;font-size:18px">${e}</div><div><div style="font-size:13.5px;font-weight:600">${t}</div><div style="font-size:11.5px;color:var(--muted-2)">${s}</div></div></div>`).join('')}
    </div>
    <div class="stack gap-10">
      <button class="btn" data-act="toRegister">Start free</button>
      <button class="btn outline" data-act="guest">Try as guest — no sign up</button>
      <button type="button" data-act="toLogin" style="background:none;border:none;box-shadow:none;padding:8px;color:var(--teal);font:600 13px var(--sans);cursor:pointer;-webkit-tap-highlight-color:transparent">I already have an account</button>
    </div>
    <div style="text-align:center;margin-top:14px"><span data-act="download" style="font-size:12.5px;color:var(--teal);font-weight:600;cursor:pointer">📲 Download / install the app</span></div>
    <div style="text-align:center;font-size:10.5px;color:var(--muted-3);line-height:1.6;margin-top:20px">A new, upcoming project of<br><a href="https://illuminary-peak.vercel.app/" target="_blank" rel="noopener noreferrer" style="color:var(--muted);font-weight:600;text-decoration:none">Illuminary Peak Company</a> · 2026</div>
  </div>`;

screens.register = () => `
  ${appbar('Create account')}
  <div class="scroll" style="padding:14px 22px 24px">
    <div style="font-size:24px;font-weight:700;letter-spacing:-.4px;margin-bottom:6px">Start your workspace</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:22px">Free during beta. Your account starts blank — you'll set up your business next.</div>
    <div class="field"><label>Full name</label><input id="regName" type="text" placeholder="Sam Rivera" autocomplete="name" /></div>
    <div class="field"><label>Work email</label><input id="regEmail" type="email" placeholder="you@business.com" autocomplete="email" /></div>
    <div class="field"><label>Password <span style="color:var(--muted-3);font-weight:400">· min 8 characters</span></label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="regPwd" type="password" placeholder="••••••••" autocomplete="new-password" style="flex:1" />
        <button class="pill" type="button" data-act="togglePwd" data-target="regPwd">Show</button>
      </div>
    </div>
    <label class="flex" style="gap:9px;align-items:flex-start;margin:4px 0 18px;cursor:pointer">
      <input id="regTerms" type="checkbox" style="margin-top:2px;width:16px;height:16px;accent-color:var(--teal)" />
      <span style="font-size:12px;color:var(--muted);line-height:1.5">I agree to the <b data-act="showTerms" data-tab-terms="terms" style="color:var(--teal);cursor:pointer">Terms of Service</b> and <b data-act="showTerms" data-tab-terms="privacy" style="color:var(--teal);cursor:pointer">Privacy Policy</b>.</span>
    </label>
    <button class="btn" data-act="doRegister">Create account</button>
    <div style="text-align:center;margin-top:16px;font-size:12.5px;color:var(--muted)">Have an account? <b data-act="toLogin" style="color:var(--teal);cursor:pointer">Sign in</b></div>
  </div>`;

screens.login = () => `
  ${appbar('Sign in')}
  <div class="scroll" style="padding:14px 22px 24px">
    <div style="font-size:24px;font-weight:700;letter-spacing:-.4px;margin-bottom:6px">Welcome back</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:22px">Sign in to your StatVibe workspace.</div>
    <div class="field"><label>Work email</label><input id="loginEmail" type="email" placeholder="you@business.com" autocomplete="email" /></div>
    <div class="field"><label>Password</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="loginPwd" type="password" placeholder="••••••••" autocomplete="current-password" style="flex:1" />
        <button class="pill" type="button" data-act="togglePwd" data-target="loginPwd">Show</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--muted);margin:-2px 0 14px;line-height:1.45">You'll stay signed in on this device until you sign out or delete your account.</div>
    <button class="btn" data-act="doLogin" style="margin-top:4px">Sign in</button>
    <div style="text-align:center;margin-top:16px;font-size:12.5px;color:var(--muted)">New here? <b data-act="toRegister" style="color:var(--teal);cursor:pointer">Create an account</b></div>
    <div style="text-align:center;margin-top:10px"><b data-act="guest" style="font-size:12.5px;color:var(--muted-2);cursor:pointer">Continue as guest instead</b></div>
  </div>`;

screens.terms = (p = {}) => {
  const tab = p.tab || 'terms';
  const T = {
    terms: ['Terms of Service', `<p><b>StatVibe Beta.</b> This software is provided during a beta period, as-is, for evaluation. Features may change or be unavailable.</p><p>You agree to use StatVibe lawfully, to keep your login credentials secure, and not to misuse the AI or messaging features. You are responsible for the business data you enter.</p><p>Paid plans are billed via our payment provider; taxes may apply. You can cancel anytime; access continues until the end of the billing period.</p><p>We may suspend accounts that violate these terms. Liability is limited to the amount paid in the last 3 months.</p>`],
    privacy: ['Privacy Policy', `<p><b>Your data is yours.</b> We store your account, business setup, inventory and notes to provide the service. Passwords are stored only as salted hashes — never in plaintext.</p><p>We do not sell your data. AI prompts you submit are processed to generate results; when using local models, they stay on your own infrastructure.</p><p>Other users cannot see your account or data unless <b>you</b> share your StatVibe QR/tag with them. You can export or permanently delete your account and all its data at any time from Settings → Privacy & Security.</p><p>Payment details are handled by our PCI-compliant payment provider; we never store full card numbers.</p>`],
  };
  const [title, bodyHtml] = T[tab] || T.terms;
  return `
  ${appbar(title)}
  <div class="scroll" style="padding:14px 22px 30px;font-size:13px;line-height:1.6;color:var(--ink-2)">
    <div class="flex gap-8 mb-16">
      <button class="pill ${tab === 'terms' ? 'solid' : ''}" data-act="showTerms" data-tab-terms="terms">Terms</button>
      <button class="pill ${tab === 'privacy' ? 'solid' : ''}" data-act="showTerms" data-tab-terms="privacy">Privacy</button>
    </div>
    ${bodyHtml}
    <div style="font-size:11px;color:var(--muted-3);margin-top:20px">Illuminary Peak Company · 2026</div>
  </div>`;
};

screens.setup = () => {
  const curOpts = (state.session.currencies || []).map((c) => `<option value="${c.code}" ${c.code === (state.setupDraft.currency || 'USD') ? 'selected' : ''}>${c.code} · ${esc(c.name)} (${esc(c.symbol)})</option>`).join('');
  const industries = ['Retail', 'Food & Beverage', 'E-commerce', 'Services', 'Manufacturing', 'Wholesale', 'Hospitality', 'Other'];
  const goals = ['Track sales', 'Manage inventory', 'AI planning', 'Client messaging', 'Forecasting'];
  const d = state.setupDraft;
  const g = new Set(d.goals || []);
  return `
  <div class="scroll" style="padding:54px 22px 30px">
    <div class="flex items-center gap-10 mb-16">
      <img src="${imgSrc('/logo-main.png', { w: 80, h: 80 })}" alt="StatVibe" style="width:30px;height:30px;border-radius:8px" />
      <div><div style="font-size:12px;color:var(--muted-2)">Welcome${state.session.user && state.session.user.isGuest ? ', guest' : (state.session.user ? ', ' + esc(state.session.user.name.split(' ')[0]) : '')}</div><div style="font-size:11px;color:var(--teal);font-weight:600">Set up your business</div></div>
    </div>
    <div style="font-size:23px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px">Tell us about your business</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:22px">This tunes your dashboard, calculator and AI. You can change any of it later in Settings.</div>

    <div class="field"><label>Business name</label><input id="suName" type="text" value="${esc(d.businessName || '')}" placeholder="e.g. Rivera Trading Co." /></div>
    <div class="field"><label>Industry</label><select id="suIndustry" style="width:100%;font:inherit;font-size:14px;padding:13px 14px;border:1px solid var(--line-2);border-radius:11px;background:var(--surface)">${industries.map((i) => `<option ${i === d.industry ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
    <div class="field"><label>Currency</label><select id="suCurrency" style="width:100%;font:inherit;font-size:14px;padding:13px 14px;border:1px solid var(--line-2);border-radius:11px;background:var(--surface)">${curOpts}</select></div>
    <div class="field"><label>Team size</label><select id="suTeam" style="width:100%;font:inherit;font-size:14px;padding:13px 14px;border:1px solid var(--line-2);border-radius:11px;background:var(--surface)">${['Just me', '2–10', '11–50', '51–200', '200+'].map((t) => `<option ${t === d.teamSize ? 'selected' : ''}>${t}</option>`).join('')}</select></div>

    <div class="field"><label>Do you sell or stock products?</label>
      <div class="flex gap-8">
        <button class="pill ${d.sellsProducts !== false ? 'solid' : ''}" data-act="suSells" data-v="yes">Yes — track inventory</button>
        <button class="pill ${d.sellsProducts === false ? 'solid' : ''}" data-act="suSells" data-v="no">Services only</button>
      </div>
    </div>

    <div class="field"><label>What do you want StatVibe to do? <span style="color:var(--muted-3);font-weight:400">· pick any</span></label>
      <div class="flex gap-8 flex-wrap">${goals.map((x) => `<button class="pill ${g.has(x) ? 'solid' : ''}" data-act="suGoal" data-v="${esc(x)}">${x}</button>`).join('')}</div>
    </div>

    <button class="btn" data-act="finishSetup" style="margin-top:8px">Finish setup →</button>
    <div style="text-align:center;margin-top:12px"><b data-act="logout" style="font-size:12px;color:var(--muted-2);cursor:pointer">Sign out</b></div>
  </div>`;
};

/* ----------------------------------------------------------------------- */
/* Tab screen: Stats dashboard                                              */
/* ----------------------------------------------------------------------- */
const tabScreens = {};

function statsCard() {
  const inv = state.session.inventory || [];
  const s = state.statsDraft || {};
  const revenue = statNum(s.revenue);
  const products = statNum(s.products);
  const avgPrice = statNum(s.avgPrice);
  const hasManual = hasStatInputs();
  if (!hasManual) {
    return `
    <div class="card mb-12" style="text-align:center;padding:28px 20px">
      <div style="font-size:36px;margin-bottom:10px">📊</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">No business data yet</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:18px">Enter your key stats first (revenue, products sold, and average price). StatVibe will compute and chart your dashboard after all inputs are complete.</div>
      <div class="field" style="text-align:left;margin-bottom:8px"><label>Revenue (MTD)</label><input id="statsRevenue" inputmode="decimal" placeholder="e.g. 1840000" value="${esc(s.revenue || '')}" /></div>
      <div class="field" style="text-align:left;margin-bottom:8px"><label>Products sold (MTD)</label><input id="statsProducts" inputmode="decimal" placeholder="e.g. 4207" value="${esc(s.products || '')}" /></div>
      <div class="field" style="text-align:left;margin-bottom:16px"><label>Average price</label><input id="statsAvgPrice" inputmode="decimal" placeholder="e.g. 117.38" value="${esc(s.avgPrice || '')}" /></div>
      <button class="btn" data-act="saveStatsInputs">Compute stats</button>
    </div>
    <div class="grid-3 mb-12">
      ${[['Revenue', money(0), '—', 'up'], ['Products', '0', '—', 'up'], ['Avg price', money(0), '—', 'up']]
        .map(([k, v, d]) => `<div class="card" style="padding:11px"><div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:6px">${k}</div><div class="big-num" style="font-size:18px">${v}</div><div style="font-size:10.5px;font-weight:600;margin-top:2px;color:var(--muted-3)">${d}</div></div>`).join('')}
    </div>`;
  }
  const totalStock = products || inv.reduce((sum, i) => sum + (Number(i.stock) || 0), 0);
  const totalValue = revenue;
  const p1 = Math.round(revenue * 0.16);
  const p2 = Math.round(revenue * 0.14);
  const p3 = Math.round(revenue * 0.17);
  const p4 = Math.round(revenue * 0.15);
  const p5 = Math.round(revenue * 0.19);
  const p6 = Math.round(revenue * 0.19);
  const mx = Math.max(p1, p2, p3, p4, p5, p6) || 1;
  const points = [p1, p2, p3, p4, p5, p6].map((v, i) => `${i * 60},${92 - ((v / mx) * 72)}`);
  const first = points[0].split(',');
  const last = points[points.length - 1].split(',');
  const area = `M${first[0]},92 L${points.join(' L')} L${last[0]},92 Z`;
  return `
    <div class="card mb-12" style="padding:16px 16px 14px;cursor:pointer" data-act="goto" data-s="revenue">
      <div class="row-between mb-8">
        <div class="eyebrow">Revenue · MTD</div>
      </div>
      <div class="flex items-center" style="gap:10px;align-items:baseline;margin-bottom:2px">
        <div class="big-num" style="font-size:34px">${money(totalValue)}</div>
      </div>
      <div style="font-size:11.5px;color:var(--muted-2);margin-bottom:6px">${totalStock.toLocaleString()} products sold · Avg ${money(avgPrice)}</div>
      <svg viewBox="0 0 300 100" width="100%" height="92" preserveAspectRatio="none">
        <defs><linearGradient id="svStatsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5865f2" stop-opacity=".22"/><stop offset="1" stop-color="#5865f2" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#svStatsFill)"/>
        <path d="M${points.join(' L')}" fill="none" stroke="#5865f2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="grid-3 mb-12">
      ${[['Revenue', money(revenue), '', 'up'], ['Products', totalStock.toLocaleString(), '', 'up'], ['Avg price', money(avgPrice), '', 'up']]
        .map(([k, v, d]) => `<div class="card" style="padding:11px"><div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:6px">${k}</div><div class="big-num" style="font-size:18px">${v}</div>${d ? `<div style="font-size:10.5px;font-weight:600;margin-top:2px;color:var(--teal)">${d}</div>` : ''}</div>`).join('')}
    </div>
    <div class="card dark mb-12" style="padding:14px 15px">
      <div class="flex items-center" style="gap:7px;margin-bottom:8px">
        ${I.spark('#7FE3C8', 15, true)}
        <span style="font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mint)">Stats insight</span>
      </div>
      <div style="font-size:13.5px;line-height:1.5;color:#D8E4E0">Based on your inputs, you are tracking <b style="color:#fff">${money(revenue)}</b> from <b style="color:#fff">${totalStock.toLocaleString()}</b> sold products, with an average ticket of <b style="color:#fff">${money(avgPrice)}</b>.</div>
      <div class="insight-actions">
        <button class="btn sm mint" data-act="editStatsInputs">Edit stats</button>
        <button class="btn sm" data-act="askAI" data-q="Analyze my stats: revenue ${money(revenue)}, products sold ${totalStock}, average price ${money(avgPrice)}. Give me 3 actions to grow next month." style="flex:1;background:rgba(255,255,255,.08);color:#EAF0EE">Ask AI</button>
      </div>
    </div>`;
}

tabScreens.stats = () => `
  <div class="scroll pad-top" style="padding-left:18px;padding-right:18px;padding-bottom:14px">
    <div class="row-between mb-20" style="padding-top:0">
      <div class="flex items-center gap-10">
        <div style="width:34px;height:34px;border-radius:9px;background:#0E7C66;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;letter-spacing:.5px">${initials(bizName())}</div>
        <div>
          <div class="flex items-center" style="gap:5px;font-weight:600;font-size:14px" data-act="goto" data-s="settings">${esc(bizName())} ${I.chevDown}</div>
          <div style="font-size:11px;color:var(--muted-2)">Overview · This month</div>
        </div>
      </div>
      <div class="flex gap-8">
        <button class="iconbtn" data-act="goto" data-s="alerts">${I.bell}</button>
        <button class="iconbtn accent" data-tab="ai">${I.spark('#fff', 16, true)}</button>
        <button class="iconbtn" data-act="goto" data-s="settings" title="Settings & profile" style="background:#0E7C66;border:none;color:#fff;font-weight:700;font-size:12px;letter-spacing:.3px">${initials(userName())}</button>
      </div>
    </div>

    ${statsCard()}
  </div>
  ${tabbar('stats')}`;

/* ----------------------------------------------------------------------- */
/* Tab screen: Business Calculator (live math)                              */
/* ----------------------------------------------------------------------- */
tabScreens.calc = () => {
  const c = state.calc;
  const landed = c.unitCost + c.freight + c.overhead;
  const price = landed / (1 - c.markup / 100);
  const margin = ((price - landed) / price) * 100;
  const t = c.tab;
  return `
  <div class="scroll pad">
    <div class="row-between mb-14">
      <div><div class="h-page">Calculator</div><div class="sub">Pricing · Margin · Supply</div></div>
      <button class="iconbtn accent" data-act="addItem" title="Add product">${I.plus('#fff')}</button>
    </div>
    <div class="segmented mb-14" data-seg="calc">
      ${['Retail', 'Product', 'Supply'].map((x) => `<button class="${t === x ? 'active' : ''}" data-v="${x}">${x}</button>`).join('')}
    </div>

    ${t !== 'Supply' ? `
    <div class="card mb-12">
      <div style="font-size:12px;color:var(--muted-2);margin-bottom:10px">Trailhead Jacket · SKU TH-402</div>
      ${[['Unit cost', 'unitCost'], ['Freight + duty', 'freight'], ['Overhead allocation', 'overhead']]
        .map(([lab, key]) => `<div class="row-between" style="padding:9px 0;border-bottom:1px solid var(--hairline)"><span style="font-size:13px">${lab}</span><span class="flex items-center" style="gap:2px"><span class="mono" style="font-size:14px">${esc(currency().symbol)}</span><input class="mono calc-input" data-k="${key}" value="${c[key].toFixed(2)}" inputmode="decimal" style="width:64px;border:none;background:none;text-align:right;font-size:14px;font-weight:500;outline:none;color:var(--ink);border-bottom:1px dashed var(--line-2)"/></span></div>`).join('')}
      <div class="row-between" style="padding:11px 0 2px"><span style="font-size:13px">Target markup</span><span class="flex items-center" style="gap:2px"><input class="mono calc-input" data-k="markup" value="${c.markup}" inputmode="decimal" style="width:44px;border:none;background:none;text-align:right;font-size:14px;font-weight:500;outline:none;color:var(--ink);border-bottom:1px dashed var(--line-2)"/><span class="mono" style="font-size:14px">%</span></span></div>
    </div>

    <div class="card dark mb-12" style="padding:15px 16px">
      <div class="row-between" style="align-items:flex-end;margin-bottom:12px">
        <div><div class="eyebrow" style="color:var(--mint);margin-bottom:4px">Suggested price</div><div class="big-num" style="font-size:32px">${money(price)}</div></div>
        <div style="text-align:right"><div style="font-size:11px;color:#9FBAB2;margin-bottom:4px">Gross margin</div><div class="big-num" style="font-size:24px;color:var(--mint)">${margin.toFixed(1)}%</div></div>
      </div>
      <div class="row-between" style="font-size:11px;color:#9FBAB2;margin-bottom:5px"><span>Landed cost ${money(landed)} · Target margin</span><span>${c.targetMargin}%</span></div>
      <div class="meter" style="background:rgba(255,255,255,.12)"><i style="width:${Math.min(100, margin).toFixed(0)}%;background:var(--mint)"></i></div>
      <button class="btn sm mint" data-act="calcAI" style="margin-top:12px">Ask AI to optimize this price</button>
    </div>` : ''}

    ${t === 'Supply' ? inventoryView() : `
    <div class="card">
      <div class="row-between mb-12"><div style="font-size:13px;font-weight:600">Supply preview</div><span class="tagchip green">Switch to Supply →</span></div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5">Track real inventory — stock, price, size & weight — and let AI predict how many days each item lasts. Open the <b>Supply</b> tab above.</div>
    </div>`}
  </div>
  ${tabbar('calc')}`;
};

// Real inventory list with per-item AI days-to-last prediction.
function inventoryView() {
  const items = state.session.inventory || [];
  if (!items.length) {
    return `<div class="card" style="text-align:center;padding:26px 18px">
      <div style="font-size:34px;margin-bottom:8px">📦</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">No inventory yet</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:16px">Add your products — stock, price, quantity, size and weight — and StatVibe's AI predicts how long each will last.</div>
      <button class="btn" data-act="addItem">+ Add first product</button>
    </div>`;
  }
  const rows = items.map((it) => {
    const pred = state.predictions[it.id];
    const tag = pred && pred.days != null
      ? `<span class="tagchip ${pred.status === 'critical' ? 'amber' : pred.status === 'low' ? 'amber' : 'green'}" style="${pred.status === 'critical' ? 'color:var(--red);background:var(--red-tint)' : ''}">${esc(pred.human || pred.days + ' days')} left</span>`
      : `<span class="tagchip grey">tap to predict</span>`;
    return `
    <div class="card mb-10" data-act="itemMenu" data-id="${it.id}" style="cursor:pointer">
      <div class="row-between" style="align-items:flex-start;margin-bottom:6px">
        <div><div style="font-size:14px;font-weight:600">${esc(it.name)}</div><div style="font-size:11px;color:var(--muted-2)">${[it.sku, it.size, it.weight].filter(Boolean).map(esc).join(' · ') || (it.category ? esc(it.category) : 'product')}</div></div>
        ${tag}
      </div>
      <div class="grid-3" style="margin-top:8px">
        <div><div class="big-num" style="font-size:16px">${Number(it.stock).toLocaleString()}</div><div style="font-size:10px;color:var(--muted-2)">${esc(it.unit || 'in stock')}</div></div>
        <div><div class="big-num" style="font-size:16px">${money(it.price)}</div><div style="font-size:10px;color:var(--muted-2)">price</div></div>
        <div><div class="big-num" style="font-size:16px">${it.ratePerDay || '—'}<span style="font-size:10px;color:var(--muted-2)">/d</span></div><div style="font-size:10px;color:var(--muted-2)">${esc(it.rateBasis || 'sales')}</div></div>
      </div>
      ${pred && pred.note ? `<div class="flex items-center" style="gap:7px;background:var(--teal-tint-2);border:1px solid var(--teal-tint-border);border-radius:9px;padding:8px 10px;margin-top:10px">${I.spark('#0E7C66', 13, true)}<span style="font-size:11.5px;color:var(--teal-deep);line-height:1.4">${esc(pred.note)}</span></div>`
        : `<button class="btn sm outline" data-act="predictItem" data-id="${it.id}" style="margin-top:10px;width:auto;padding:8px 12px">${I.spark('#0E7C66', 12, true)} Predict days left</button>`}
    </div>`;
  }).join('');
  return `<div class="row-between mb-10"><div style="font-size:13px;font-weight:600">Inventory · ${items.length} item${items.length > 1 ? 's' : ''}</div><button class="pill solid" data-act="addItem" style="padding:5px 11px">${I.plus('#fff', 12)} Add</button></div>${rows}`;
}

/* ----------------------------------------------------------------------- */
/* Tab screen: Idea & Project Hub                                           */
/* ----------------------------------------------------------------------- */
const IDEA_TAG = { Backlog: 'grey', Building: 'amber', Launched: 'green' };
tabScreens.hub = () => {
  const ideas = state.session.ideas || [];
  const counts = { Backlog: 0, Building: 0, Launched: 0 };
  ideas.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
  return `
  <div class="scroll pad">
    <div class="row-between mb-14">
      <div><div class="h-page">Idea Hub</div><div class="sub">${ideas.length} idea${ideas.length === 1 ? '' : 's'} · ${counts.Building} building · ${counts.Launched} launched</div></div>
      <button class="pill solid" data-act="newIdea" style="height:34px">${I.plus('#fff', 14)} New</button>
    </div>
    <div class="card mb-14" style="background:var(--teal-tint-2);border:1px solid var(--teal-tint-border);padding:12px 14px">
      <div class="flex items-center" style="gap:8px;margin-bottom:8px">${I.spark('#0E7C66', 14, true)}<span style="font-size:12.5px;font-weight:600;color:var(--teal-deep)">AIVibe — turn a rough idea into a sharp prompt</span></div>
      <input id="aivibeInput" placeholder="Describe an idea in your own words…" style="width:100%;border:1px solid var(--teal-tint-border);border-radius:9px;padding:10px;font:inherit;font-size:13px;background:var(--surface);color:var(--ink);outline:none" />
      <button class="btn sm" data-act="aivibe" style="margin-top:8px;width:auto;padding:8px 14px">Reformulate with AI →</button>
    </div>
    ${ideas.length ? ideas.map((it) => `
    <div class="card mb-12" data-act="editIdea" data-id="${it.id}" style="cursor:pointer">
      <div class="row-between" style="align-items:flex-start;margin-bottom:8px"><div style="font-size:14px;font-weight:600">${esc(it.title)}</div><span class="tagchip ${IDEA_TAG[it.status] || 'grey'}">${esc(it.status)}</span></div>
      ${it.notes ? `<div style="font-size:12px;color:var(--muted);line-height:1.45">${esc(it.notes)}</div>` : '<div style="font-size:12px;color:var(--muted-3)">No notes yet — tap to edit</div>'}
    </div>`).join('') : `<div class="card" style="text-align:center;padding:24px 18px"><div style="font-size:32px;margin-bottom:8px">💡</div><div style="font-size:15px;font-weight:600;margin-bottom:4px">No ideas yet</div><div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:16px">Capture ideas and notes; edit them anytime, and let AIVibe sharpen them into prompts.</div><button class="btn" data-act="newIdea">+ Add your first idea</button></div>`}
  </div>
  ${tabbar('hub')}`;
};

/* ----------------------------------------------------------------------- */
/* Tab screen: AI Workspace                                                 */
/* ----------------------------------------------------------------------- */
tabScreens.ai = () => {
  const m = state.models;
  const engineChips = m.engines.map((e) => {
    const on = m.active.has(e.id);
    return `<button class="pill ${on ? 'dark' : ''}" data-act="toggleEngine" data-id="${e.id}"><span class="dot" style="background:${on ? '#7FE3C8' : '#0E7C66'}"></span>${esc(e.label)}</button>`;
  }).join('');
  const cloudChips = m.cloud.map((c) => {
    if (c.available) {
      const on = m.active.has(c.id);
      return `<button class="pill ${on ? 'dark' : ''}" data-act="toggleEngine" data-id="${c.id}"><span class="dot" style="background:${on ? '#7FE3C8' : '#0E7C66'}"></span>${esc(c.label)}</button>`;
    }
    return `<button class="pill disabled" data-act="cloudUnavail" data-l="${esc(c.label)}">+ ${esc(c.label)}</button>`;
  }).join('');
  const prefill = state.aiPrefill || 'Draft a Q3 board update from our latest revenue and margin data.';
  return `
  <div class="scroll pad">
    <div class="row-between mb-14">
      <div><div class="h-page">AI Workspace</div><div class="sub">${m.ollamaOnline ? 'Local models · Ollama online' : m.hosted ? 'Hosted AI · live' : 'Simulated engine · start Ollama'} · blend for smarter output</div></div>
      <button class="pill" data-act="aiHistory" style="height:34px">🕘 History${state.session.history && state.session.history.length ? ' · ' + state.session.history.length : ''}</button>
    </div>

    <div class="eyebrow mb-8">Active models</div>
    <div class="flex gap-8 mb-14 flex-wrap">${engineChips}${cloudChips}</div>

    <div class="flex items-center row-between" style="background:var(--teal-tint-2);border:1px solid var(--teal-tint-border);border-radius:12px;padding:11px 13px;margin-bottom:16px">
      <div><div style="font-size:12.5px;font-weight:600;color:var(--teal-deep)">Blend mode</div><div style="font-size:11px;color:#5C8378">Route each task to the best model automatically</div></div>
      <button class="toggle ${m.blend ? 'on' : ''}" data-act="toggleBlend"></button>
    </div>

    <div class="card mb-14">
      <textarea id="aiPrompt" rows="2" style="width:100%;border:none;outline:none;background:none;font:inherit;font-size:13px;line-height:1.5;resize:none;color:var(--ink)">${esc(prefill)}</textarea>
      <div class="flex items-center gap-8 flex-wrap" style="margin-top:8px">
        <span class="flex items-center" style="gap:5px;font-size:11px;color:var(--muted);background:var(--chip);border-radius:8px;padding:5px 9px">${I.bars('#0E7C66', 12)}Revenue.csv</span>
        <span style="font-size:11px;color:var(--muted);background:var(--chip);border-radius:8px;padding:5px 9px">Margin report</span>
        <button class="iconbtn accent" data-act="runAI" style="margin-left:auto;border-radius:10px">${I.arrow}</button>
      </div>
    </div>

    <div class="eyebrow mb-8">Business tasks</div>
    <div class="grid-2">
      ${[['Business plan', 'From your metrics', 'Write a one-page business plan based on our current revenue, margin and channel mix.'],
         ['Documents', 'Contracts, SOPs', 'Draft a standard operating procedure for fulfilling a wholesale purchase order.'],
         ['Forecast', 'Scenario models', 'Model three revenue scenarios for next quarter (conservative, base, aggressive).'],
         ['Outreach', 'Emails at scale', 'Write a re-engagement email for customers who have not ordered in 60 days.']]
        .map(([t, s, q]) => `<button class="card" data-act="runTask" data-q="${esc(q)}" style="text-align:left;cursor:pointer;padding:12px 13px"><div style="font-size:13px;font-weight:600;margin-bottom:2px">${t}</div><div style="font-size:11px;color:var(--muted-2)">${s}</div></button>`).join('')}
    </div>
  </div>
  ${tabbar('ai')}`;
};

/* ----------------------------------------------------------------------- */
/* Tab screen: Agent — Messenger-style inbox (real cross-user messaging)     */
/* ----------------------------------------------------------------------- */
const AV_COLORS = ['#5865f2', '#0E7C66', '#3A6070', '#B26B00', '#8E44AD', '#C0392B', '#2E86AB'];
function avatarColor(seed) { let h = 0; for (const c of String(seed || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }
function convAvatar(other, size = 52) {
  const c = avatarColor(other.tag || other.name);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${c};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(size / 2.6)}px;flex-shrink:0">${esc(initials(other.name))}</div>`;
}
function relTime(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const days = Math.floor((now - d) / 86400000);
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

tabScreens.agent = () => {
  const convs = state.session.conversations || [];
  const row = (c) => {
    const preview = (c.mine ? 'You: ' : '') + (c.lastText || 'Say hello 👋');
    const unread = c.unread > 0;
    return `
    <button class="conv-row" data-act="openChat" data-id="${c.id}">
      ${convAvatar(c.other)}
      <div style="flex:1;min-width:0">
        <div class="row-between"><span style="font-size:15px;font-weight:${unread ? '700' : '600'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.other.name)}</span><span style="font-size:11.5px;color:${unread ? 'var(--teal)' : 'var(--muted-2)'};flex-shrink:0;margin-left:8px;font-weight:${unread ? '600' : '400'}">${relTime(c.lastAt)}</span></div>
        <div class="row-between" style="margin-top:2px"><span style="font-size:13px;color:${unread ? 'var(--ink)' : 'var(--muted-2)'};font-weight:${unread ? '600' : '400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(preview)}</span>${unread ? `<span class="conv-badge">${c.unread > 9 ? '9+' : c.unread}</span>` : ''}</div>
      </div>
    </button>`;
  };
  return `
  <div class="scroll pad" style="padding-top:54px">
    <div class="row-between mb-14">
      <div class="h-page">Messages</div>
      <button class="iconbtn accent" data-act="newChat" title="New message">${I.plus('#fff')}</button>
    </div>
    ${convs.length
      ? `<div class="stack" style="gap:2px">${convs.map(row).join('')}</div>`
      : `<div class="card" style="text-align:center;padding:30px 20px;margin-top:20px">
          <div style="width:64px;height:64px;border-radius:20px;background:var(--teal-tint);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:30px">💬</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px">No messages yet</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:18px">Messages appear when someone scans your StatVibe QR. Share your code, or start one by scanning theirs.</div>
          <button class="btn" data-act="newChat" style="margin-bottom:10px">Start a message</button>
          <button class="btn outline" data-act="myQR">Show my QR code</button>
        </div>`}
  </div>
  ${tabbar('agent')}`;
};

/* ---- Chat thread (a single conversation) ---- */
screens.chat = () => {
  const t = state.chat;
  const other = t.other || { name: 'Chat', tag: '' };
  const me = state.session.user && state.session.user.id;
  const auto = state.session.agentAutoReply;
  const bubbles = (t.messages || []).map((m) => m.from === me
    ? `<div class="bubble me">${esc(m.text)}</div>`
    : `<div class="bubble them">${esc(m.text)}</div>`).join('');
  const draftControls = t.draft
    ? `<div class="approve-row"><button class="pill" data-act="approveSend" style="color:var(--teal);background:var(--teal-tint);border-color:var(--teal-tint-border)">Approve &amp; send</button><button class="pill" data-act="editDraft">Edit</button></div>`
    : '';
  return `
  <div class="flex items-center" style="gap:11px;padding:54px 12px 12px;background:var(--surface);border-bottom:1px solid var(--line)">
    <button class="iconbtn plain" data-act="back" style="background:none">${I.back}</button>
    ${convAvatar(other, 36)}
    <div style="flex:1;min-width:0"><div style="font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(other.name)}</div><div style="font-size:11px;color:var(--teal)"><span style="width:6px;height:6px;border-radius:50%;background:${auto ? 'var(--teal)' : 'var(--amber)'};display:inline-block;margin-right:5px"></span>AgentTech · ${auto ? 'auto-reply' : 'approval'}</div></div>
    <button class="iconbtn plain" data-act="agentSettings" title="AgentTech settings"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z" stroke="currentColor" stroke-width="1.4"/></svg></button>
  </div>
  <div class="chat-scroll" id="chatScroll">
    ${(t.messages || []).length ? bubbles + draftControls : `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px;color:var(--muted-2)"><div style="font-size:13px;line-height:1.5">This is the start of your conversation with <b style="color:var(--ink)">${esc(other.name)}</b>.</div></div>`}
  </div>
  <div class="composer">
    <div class="inputwrap">
      <input id="agentInput" placeholder="Message…" />
      <button class="pill" data-act="agentDraft" style="padding:6px 11px;background:var(--surface)">${I.spark('#0E7C66', 12, true)} AI</button>
      <button class="send" data-act="agentSend">${I.send}</button>
    </div>
  </div>`;
};

/* ----------------------------------------------------------------------- */
/* Sub-screens                                                              */
/* ----------------------------------------------------------------------- */
screens.revenue = () => {
  const inv = state.session.inventory || [];
  const totalValue = inv.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.stock) || 0), 0);
  const topProducts = inv.slice().sort((a, b) => ((Number(b.price) || 0) * (Number(b.stock) || 0)) - ((Number(a.price) || 0) * (Number(a.stock) || 0))).slice(0, 5);
  return `
  ${appbar('Revenue', { right: `<button class="iconbtn" data-act="exportRevenue">${I.download}</button>` })}
  <div class="scroll" style="padding:8px 18px 20px">
    <div class="flex items-center" style="gap:10px;align-items:baseline;margin-bottom:4px"><div class="big-num" style="font-size:32px">${money(totalValue)}</div></div>
    <div style="font-size:11.5px;color:var(--muted-2);margin-bottom:14px">Total inventory value · ${inv.length} product${inv.length !== 1 ? 's' : ''}</div>
    ${!inv.length ? `
    <div class="card" style="text-align:center;padding:28px 20px">
      <div style="font-size:36px;margin-bottom:10px">📈</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px">No revenue data yet</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:16px">Add products and inventory to see your revenue breakdown here.</div>
      <button class="btn" data-tab="calc">Add products</button>
    </div>` : `
    <div class="eyebrow mb-10">Top products by value</div>
    <div class="list">
      ${topProducts.map((it) => {
        const val = (Number(it.price) || 0) * (Number(it.stock) || 0);
        return `<div class="row" style="cursor:default"><div><div style="font-size:13px;font-weight:500">${esc(it.name)}</div><div style="font-size:11px;color:var(--muted-2)">${Number(it.stock).toLocaleString()} ${esc(it.unit || 'units')}</div></div><div style="text-align:right"><div class="mono" style="font-size:13px;font-weight:500">${money(val)}</div><div style="font-size:11px;color:var(--muted-2)">${money(it.price)} each</div></div></div>`;
      }).join('')}
    </div>`}
  </div>`;
};

screens.aiOutput = () => {
  const out = state.lastAIOutput || { title: 'Q3 Board Update', model: 'simulated', simulated: true, content: 'No output yet.', engines: [] };
  const chips = (out.engines && out.engines.length ? out.engines : [out.model]).map((label, i) =>
    i === 0
      ? `<span class="pill dark" style="padding:4px 9px;font-size:11px"><span class="dot" style="background:#7FE3C8"></span>${esc(label)}</span>`
      : `<span class="pill" style="padding:4px 9px;font-size:11px">${esc(label)}</span>`
  ).join('<span style="font-size:11px;color:var(--muted)">+</span>');
  return `
  ${appbar(esc(out.title), { onSurface: true, right: `<button class="iconbtn plain" data-act="outputMenu">${I.ellipsis}</button>` })}
  <div class="scroll" style="padding:14px 18px 16px">
    <div class="flex items-center gap-8 flex-wrap mb-14">
      <span style="font-size:10.5px;color:var(--muted-2)">Generated by</span>
      ${chips}
      ${out.engines && out.engines.length > 1 ? '<span style="font-size:10.5px;color:var(--teal);font-weight:600;margin-left:2px">· Blend</span>' : ''}
      ${out.simulated ? '<span class="tagchip amber">Simulated</span>' : '<span class="tagchip green">Live · Ollama</span>'}
    </div>
    <div class="card" style="padding:18px">
      <div style="font-size:18px;font-weight:700;letter-spacing:-.3px;margin-bottom:4px">${esc(out.title)}</div>
      <div style="font-size:11px;color:var(--muted-2);margin-bottom:16px">Illuminary Peak · Prepared Jul 2026</div>
      <div style="font-size:13px;line-height:1.6;color:var(--ink-2)">${mdToHtml(out.content)}</div>
    </div>
  </div>
  <div class="flex gap-8" style="padding:11px 16px 26px;background:var(--surface);border-top:1px solid var(--line)">
    <button class="btn" data-act="refineAI" style="flex:1;padding:12px;border-radius:11px">Refine with AI</button>
    <button class="iconbtn plain" data-act="copyOutput" style="width:48px;border-radius:11px">${I.copy}</button>
    <button class="iconbtn plain" data-act="exportOutput" style="width:48px;border-radius:11px">${I.download}</button>
  </div>`;
};

screens.alerts = () => {
  const A = state.alerts || (state.alerts = [
    { grp: 'Today', icon: '✨', tint: 'var(--teal-tint)', title: 'Forecast beat plan', body: 'Q3 projected at $2.41M — 6.8% over plan.', time: '18m ago', unread: true },
    { grp: 'Today', icon: '⚠️', tint: 'var(--red-tint)', title: 'Low stock — Summit Pack 40L', body: 'Below reorder point. 6 days of cover left.', time: '1h ago', unread: true },
    { grp: 'Today', icon: '💬', tint: 'var(--slate-blue-tint)', title: 'Meridian Retail replied', body: '"Perfect, send the PO" — AgentTech ready.', time: '2h ago', unread: false, act: 'agent' },
    { grp: 'Earlier', icon: '⏳', tint: 'var(--amber-tint)', title: 'Free plan 78% used', body: '780 of 1,000 AI actions used this month.', time: 'Yesterday', unread: false, act: 'plans' },
  ]);
  const groups = [...new Set(A.map((a) => a.grp))];
  return `
  ${appbar('Alerts', { right: `<span style="font-size:12px;font-weight:600;color:var(--teal);cursor:pointer" data-act="markRead">Mark read</span>` })}
  <div class="scroll" style="padding:6px 18px 20px">
    ${groups.map((g) => `
      <div class="eyebrow" style="margin:8px 0 8px">${g}</div>
      <div class="stack gap-10">
        ${A.filter((a) => a.grp === g).map((a) => `
          <div class="card ${a.act ? '' : ''}" data-act="${a.act ? 'openAlert' : ''}" data-s="${a.act || ''}" style="padding:13px 14px;display:flex;gap:12px;${a.act ? 'cursor:pointer' : ''}">
            <div style="width:34px;height:34px;border-radius:10px;background:${a.tint};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px">${a.icon}</div>
            <div style="flex:1"><div style="font-size:13px;font-weight:600">${esc(a.title)}</div><div style="font-size:12px;color:var(--muted);line-height:1.4;margin-top:2px">${esc(a.body)}</div><div style="font-size:10.5px;color:var(--muted-3);margin-top:5px">${a.time}</div></div>
            ${a.unread ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--teal);flex-shrink:0;margin-top:4px"></span>' : ''}
          </div>`).join('')}
      </div>`).join('')}
  </div>`;
};

function guestBanner() {
  return `<div class="card mb-16" style="background:var(--teal-ink);color:#eaf0ee;border:none">
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">You're exploring as a guest</div>
    <div style="font-size:12px;color:#c3d6d0;line-height:1.5;margin-bottom:12px">Create a free account to save your business, inventory and notes — and to message clients. Guest data isn't saved.</div>
    <button class="btn sm mint" data-act="toRegister">Create free account</button>
  </div>`;
}

screens.settings = () => {
  const u = state.session.user || {};
  const acct = state.session.account || {};
  const isGuest = u.isGuest;
  return `
  ${appbar('Settings')}
  <div class="scroll" style="padding:6px 18px 20px">
    ${isGuest ? guestBanner() : ''}
    <button class="card mb-16" data-act="goto" data-s="profile" style="display:flex;align-items:center;gap:13px;padding:15px;width:100%;text-align:left;border:1px solid var(--line);cursor:pointer">
      <div style="width:48px;height:48px;border-radius:14px;background:#0E7C66;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px">${initials(u.name || 'Guest')}</div>
      <div style="flex:1"><div style="font-size:15px;font-weight:600">${esc(u.name || 'Guest')}</div><div style="font-size:12px;color:var(--muted-2)">${esc(u.email || 'Guest session')} · ${isGuest ? 'Guest' : 'Owner'}</div></div>
      ${I.chevR}
    </button>
    <div class="eyebrow mb-8">Account</div>
    <div class="list mb-16">
      <button class="row" data-act="goto" data-s="profile"><span>Profile &amp; personal details</span><span class="val">›</span></button>
      <button class="row" data-act="goto" data-s="security"><span>Privacy &amp; Security</span><span class="val">›</span></button>
      <button class="row" data-act="download"><span>Get the app</span><span class="val">Install ›</span></button>
      <button class="row" data-act="pickAppearance"><span>Appearance</span><span class="val">${state.settings.appearance} ›</span></button>
      <div class="row" style="cursor:default"><span>Notifications</span><button class="toggle ${state.settings.notifications ? 'on' : ''}" data-act="toggleNotifications"></button></div>
    </div>
    <div class="eyebrow mb-8">Business</div>
    <div class="list mb-16">
      <button class="row" data-act="editBusiness"><span>Business name</span><span class="val">${esc(acct.businessName || 'Set up')} ›</span></button>
      <button class="row" data-act="pickCurrency"><span>Currency</span><span class="val">${esc((acct.currency || 'USD') + ' ' + currency().symbol)} ›</span></button>
      <button class="row" data-act="goto" data-s="plans"><span>Plan</span><span class="tagchip green">${state.plan}</span></button>
    </div>
    <div class="eyebrow mb-8">AI &amp; integrations</div>
    <div class="list mb-16">
      <button class="row" data-tab="ai" data-act="gotoTab"><span>AI models</span><span class="val">${state.models.active.size || 1} active ›</span></button>
      <div class="row" style="cursor:default"><span>Blend mode</span><button class="toggle ${state.settings.blend ? 'on' : ''}" data-act="toggleSettingBlend"></button></div>
    </div>
    <div class="list">
      <button class="row" data-act="logout"><span style="color:var(--red);font-weight:500">Sign out</span></button>
    </div>
  </div>`;
};

screens.security = () => {
  const u = state.session.user || {};
  const isGuest = u.isGuest;
  return `
  ${appbar('Privacy & Security')}
  <div class="scroll" style="padding:6px 18px 24px">
    <div class="eyebrow mb-8">Security</div>
    <div class="list mb-16">
      ${isGuest
        ? `<div class="row" style="cursor:default"><span>Password</span><span class="val">Register to set ›</span></div>`
        : `<button class="row" data-act="changePwd2"><span>Change password</span><span class="val">›</span></button>`}
      <button class="row" data-act="twoFactor"><span>Two-factor authentication</span><span class="val">Off ›</span></button>
      <button class="row" data-act="activeSessions"><span>Active sessions</span><span class="val">This device ›</span></button>
    </div>
    <div class="eyebrow mb-8">Privacy</div>
    <div class="list mb-16">
      <div class="row" style="cursor:default"><span>Discoverable by QR only</span><button class="toggle on" data-act="noop"></button></div>
      <button class="row" data-act="myQR"><span>My StatVibe QR</span><span class="val">${esc(u.tag || '—')} ›</span></button>
      <button class="row" data-act="exportData"><span>Export my data</span><span class="val">›</span></button>
    </div>
    <div class="eyebrow mb-8">Billing</div>
    <div class="list mb-16">
      <button class="row" data-act="paymentMethod"><span>Payment method</span><span class="val">PayMongo QR ›</span></button>
      <button class="row" data-act="goto" data-s="plans"><span>Subscription</span><span class="val">${state.plan} ›</span></button>
    </div>
    <div class="list">
      <button class="row" data-act="deleteAccount"><span style="color:var(--red);font-weight:600">Delete account</span></button>
    </div>
    <div style="font-size:11px;color:var(--muted-3);margin-top:14px;line-height:1.5">Your data is private. Passwords are stored only as salted hashes — never in plaintext. Other accounts can't find you unless you share your StatVibe QR. See the <b data-act="showTerms" data-tab-terms="privacy" style="color:var(--teal);cursor:pointer">Privacy Policy</b>.</div>
  </div>`;
};

screens.profile = () => {
  const p = state.profile;
  const fieldRow = (label, key, type = 'text') =>
    `<div class="field" style="margin-bottom:0;padding:11px 15px;border-bottom:1px solid var(--hairline)">
      <label style="margin-bottom:3px">${label}</label>
      <input class="profile-input" data-k="${key}" type="${type}" value="${esc(p[key])}" style="border:none;border-radius:0;padding:0;font-size:14px;background:none" />
    </div>`;
  return `
  ${appbar('Profile', { right: `<span data-act="saveProfile" style="font-size:13px;font-weight:600;color:var(--teal);cursor:pointer;padding:0 4px">Done</span>` })}
  <div class="scroll" style="padding:6px 18px 24px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:10px 0 22px">
      <div style="width:76px;height:76px;border-radius:22px;background:#0E7C66;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:28px" id="pfAvatar">${initials(p.name)}</div>
      <div style="text-align:center"><div style="font-size:18px;font-weight:700;letter-spacing:-.3px" id="pfName">${esc(p.name)}</div><div style="margin-top:5px"><span class="tagchip green">${esc(p.role)}</span> <span style="font-size:11.5px;color:var(--muted-2)">· ${esc(bizName())}</span></div></div>
    </div>
    <div class="eyebrow mb-8">Personal details</div>
    <div class="list mb-16" style="padding:2px 0">
      ${fieldRow('Full name', 'name')}
      ${fieldRow('Work email', 'email', 'email')}
      ${fieldRow('Role / title', 'role')}
      ${fieldRow('Phone', 'phone', 'tel')}
      <div style="padding:11px 15px"><div class="field" style="margin:0"><label style="margin-bottom:3px">Timezone</label><input class="profile-input" data-k="tz" value="${esc(p.tz)}" style="border:none;border-radius:0;padding:0;font-size:14px;background:none" /></div></div>
    </div>
    <div class="eyebrow mb-8">Security</div>
    <div class="list mb-16">
      <button class="row" data-act="changePwd"><span>Change password</span><span class="val">›</span></button>
      <button class="row" data-act="twoFactor"><span>Two-factor authentication</span><span class="val">Off ›</span></button>
    </div>
    <button class="btn outline" data-act="signout" style="color:var(--red)">Sign out</button>
  </div>`;
};

/* ---- Admin / Developer console (full access) ---- */
screens.admin = () => {
  const a = state.admin;
  if (!a.authed) {
    return `
    ${appbar('Developer access')}
    <div class="scroll" style="padding:20px 22px">
      <div class="flex items-center" style="gap:12px;margin-bottom:16px">
        <div style="width:56px;height:56px;border-radius:16px;background:var(--teal-ink);display:flex;align-items:center;justify-content:center">${I.spark('#7FE3C8', 26, true)}</div>
        <div><div style="font-size:12px;color:var(--muted-2)">Connect as</div><div style="font-size:18px;font-weight:700;letter-spacing:-.2px">${esc(a.user || 'GenAdmin')}</div></div>
      </div>
      <div style="font-size:22px;font-weight:700;letter-spacing:-.3px;margin-bottom:4px">Admin console</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:22px">Developer-only area with full access to system health, AI engines, feature flags, metrics and every screen. Enter the <b>${esc(a.user || 'GenAdmin')}</b> token to connect.</div>
      <div class="field"><label>${esc(a.user || 'GenAdmin')} · Admin token</label><input id="admToken" type="password" placeholder="ADMIN_TOKEN" value="genadmin-2026" /></div>
      <button class="btn" data-act="adminLogin" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Connecting…' : 'Connect as ' + esc(a.user || 'GenAdmin')}</button>
      <div style="font-size:11px;color:var(--muted-3);margin-top:14px;line-height:1.5">Default dev token is <b>genadmin-2026</b>. In production set <code>ADMIN_USER</code> / <code>ADMIN_TOKEN</code> in <code>.env</code> on the server.</div>
    </div>`;
  }
  const s = a.summary || {};
  const cfg = s.config || { cloudAvailable: {} };
  const m = s.metrics || {};
  const kv = (k, v) => `<div class="row" style="cursor:default"><span>${k}</span><span class="val mono" style="color:var(--ink)">${v}</span></div>`;
  const cloudToggles = CLOUD.map((c) =>
    `<div class="row" style="cursor:default"><span>${c.label} <span style="color:var(--muted-3);font-size:11px">${c.vendor}</span></span><button class="toggle ${cfg.cloudAvailable && cfg.cloudAvailable[c.id] ? 'on' : ''}" data-act="admCloud" data-id="${c.id}"></button></div>`
  ).join('');
  const byModel = Object.entries(m.byModel || {}).map(([k, v]) => `${esc(k)}: ${v}`).join(' · ') || 'none yet';
  const engineOpts = ((state.models.engines || []).concat(state.models.cloud || [])).map((e) => `<option value="${esc(e.id)}">${esc(e.label)}</option>`).join('');
  return `
  ${appbar('Admin console', { right: `<span data-act="adminLogout" style="font-size:12px;font-weight:600;color:var(--red);cursor:pointer;padding:0 4px">Lock</span>` })}
  <div class="scroll" style="padding:6px 18px 24px">
    <div class="flex items-center row-between mb-12">
      <div class="flex items-center" style="gap:10px">
        <div style="width:38px;height:38px;border-radius:11px;background:var(--teal-ink);color:var(--mint);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${esc(initials(s.admin_user || a.user || 'GenAdmin'))}</div>
        <div><div class="h-page" style="font-size:18px">${esc(s.admin_user || a.user || 'GenAdmin')}</div><div class="sub">Full access · v${esc(s.version || '—')}</div></div>
      </div>
      <button class="pill" data-act="adminRefresh">↻ Refresh</button>
    </div>
    <div class="flex items-center" style="gap:7px;background:var(--teal-tint-2);border:1px solid var(--teal-tint-border);border-radius:10px;padding:9px 12px;margin-bottom:16px">
      <span style="width:8px;height:8px;border-radius:50%;background:var(--teal)"></span>
      <span style="font-size:12px;color:var(--teal-deep);font-weight:600">Connected as ${esc(s.admin_user || a.user || 'GenAdmin')}</span>
      <span style="font-size:11px;color:#5C8378;margin-left:auto">${(s.ollama && s.ollama.online) ? 'live' : 'degraded'}</span>
    </div>

    <div class="eyebrow mb-8">System</div>
    <div class="list mb-16">
      ${kv('Status', (s.ollama && s.ollama.online) ? 'healthy' : 'degraded (no Ollama)')}
      ${kv('Uptime', (s.uptime_s || 0) + 's')}
      ${kv('Node', esc(s.node || '—'))}
      ${kv('Memory', (s.memory_mb || 0) + ' MB')}
      ${kv('Ollama', (s.ollama && s.ollama.online) ? 'online' : 'offline')}
      ${kv('Local models', (s.ollama && s.ollama.models || []).length)}
    </div>

    <div class="eyebrow mb-8">AI engine flags</div>
    <div class="list mb-16">
      <div class="row" style="cursor:default"><span>Simulate only <span style="color:var(--muted-3);font-size:11px">force simulated AI</span></span><button class="toggle ${cfg.simulateOnly ? 'on' : ''}" data-act="admSimulate"></button></div>
      <div class="row" style="cursor:default"><span>Blend by default</span><button class="toggle ${cfg.defaultBlend ? 'on' : ''}" data-act="admBlend"></button></div>
    </div>

    <div class="eyebrow mb-8">Cloud models — flip “available”</div>
    <div class="list mb-16">${cloudToggles}</div>

    <div class="eyebrow mb-8">Metrics</div>
    <div class="list mb-16">
      ${kv('Requests', m.requests || 0)}
      ${kv('AI chats', m.chats || 0)}
      ${kv('Simulated', m.simulated || 0)}
      ${kv('AI errors', m.aiErrors || 0)}
      <div class="row" style="cursor:default"><span>By model</span><span class="val" style="max-width:190px;text-align:right;font-size:11px">${esc(byModel)}</span></div>
    </div>

    <div class="eyebrow mb-8">Raw AI console</div>
    <div class="card mb-16">
      <select id="admModel" class="mb-8" style="width:100%;font:inherit;font-size:13px;padding:9px;border:1px solid var(--line-2);border-radius:9px;background:var(--surface)">${engineOpts}</select>
      <textarea id="admPrompt" rows="2" placeholder="Test a prompt against the selected model…" style="width:100%;border:1px solid var(--line-2);border-radius:9px;padding:9px;font:inherit;font-size:13px;resize:none;outline:none">What is our gross margin trend?</textarea>
      <button class="btn sm" data-act="admRunTest" style="margin-top:8px">Run test call</button>
      ${a.testOut ? `<div style="margin-top:10px;background:var(--chip);border-radius:9px;padding:10px;font-size:12px;line-height:1.5;white-space:pre-wrap;max-height:180px;overflow:auto"><div style="font-size:10px;color:var(--muted-2);margin-bottom:5px">${a.testOut.simulated ? 'SIMULATED' : 'LIVE'} · ${esc(a.testOut.model)}</div>${esc(a.testOut.content)}</div>` : ''}
    </div>

    <div class="eyebrow mb-8">Recent server log</div>
    <div class="card mb-16" style="font-size:10.5px;line-height:1.55;color:var(--muted);max-height:150px;overflow:auto;font-family:var(--mono)">
      ${(m.recent || []).map((l) => `<div>${esc(l)}</div>`).join('') || '<div>No log entries.</div>'}
    </div>

    <div class="eyebrow mb-8">All screens (jump)</div>
    <div class="flex gap-8 flex-wrap mb-16">
      ${['stats', 'calc', 'hub', 'ai', 'agent', 'revenue', 'aiOutput', 'alerts', 'plans', 'settings', 'profile', 'welcome', 'signin'].map((sc) => `<button class="pill" data-act="admJump" data-s="${sc}">${sc}</button>`).join('')}
    </div>

    <div class="grid-2">
      <button class="btn outline" data-act="admResetConfig">Reset server config</button>
      <button class="btn outline" data-act="admResetApp" style="color:var(--red)">Reset app state</button>
    </div>
  </div>`;
};

screens.plans = () => {
  const u = state.usage;
  const pct = Math.round((u.used / u.limit) * 100);
  const plans = [
    { name: 'Free', price: '$0', desc: '1,000 AI actions · 1 workspace · core dashboard & calculator' },
    { name: 'Business', price: '$79', per: '/mo', pop: true, desc: '50,000 AI actions · unlimited workspaces · all models & Blend · AgentTech · predictive forecasting' },
    { name: 'Pro', price: '$29', per: '/mo', desc: '10,000 AI actions · 3 workspaces · 2 models · project hub' },
    { name: 'Enterprise', price: 'Custom', desc: 'Unlimited usage · SSO · audit logs · dedicated support & SLAs' },
  ];
  return `
  ${appbar('Plans')}
  <div class="scroll pad" style="padding-top:6px">
    <div class="mb-14"><div class="h-page">Plans</div><div class="sub">Scale usage as you grow · current: ${state.plan}</div></div>
    <div class="card mb-14">
      <div class="row-between mb-8"><span style="font-size:12.5px;font-weight:600">${state.plan} plan · this month</span><span style="font-size:11px;color:var(--amber);font-weight:600">${pct}% used</span></div>
      <div class="meter mb-8" style="margin-bottom:5px"><i style="width:${pct}%;background:linear-gradient(90deg,#0E7C66,#E0A030)"></i></div>
      <div style="font-size:11px;color:var(--muted-2)">${u.used.toLocaleString()} / ${u.limit.toLocaleString()} AI actions · resets in ${u.resetDays} days</div>
    </div>
    <div class="stack gap-10">
      ${plans.map((p) => p.pop ? `
        <div class="card dark" style="border:1.5px solid #0E7C66;position:relative;padding:16px">
          <span class="tagchip" style="position:absolute;top:-9px;left:16px;background:#0E7C66;color:#fff">Most popular</span>
          <div class="row-between" style="align-items:baseline"><div style="font-size:15px;font-weight:700">${p.name}</div><div><span class="mono" style="font-size:22px;font-weight:600">${p.price}</span><span style="font-size:12px;color:#9FBAB2">${p.per}</span></div></div>
          <div style="font-size:12px;color:#C3D6D0;margin:8px 0 12px;line-height:1.55">${p.desc}</div>
          <button class="btn mint sm" data-act="upgrade" data-p="${p.name}" style="padding:11px">Upgrade to ${p.name}</button>
        </div>` : `
        <button class="card" data-act="choosePlan" data-p="${p.name}" style="text-align:left;cursor:pointer">
          <div class="row-between" style="align-items:baseline"><div style="font-size:15px;font-weight:700">${p.name}</div><div><span class="mono" style="font-size:17px;font-weight:600">${p.price}</span><span style="font-size:12px;color:var(--muted-2)">${p.per || ''}</span></div></div>
          <div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5">${p.desc}</div>
        </button>`).join('')}
    </div>
  </div>`;
};

/* ----------------------------------------------------------------------- */
/* AI plumbing                                                              */
/* ----------------------------------------------------------------------- */
async function loadModels() {
  try {
    const r = await fetch('/api/models');
    const d = await r.json();
    state.models.engines = d.engines || [];
    state.models.cloud = d.cloud || [];
    state.models.ollamaOnline = !!d.ollama_online;
    state.models.hosted = !!d.hosted;
    if (d.admin_user) state.admin.user = d.admin_user;
    if (!state.models.loaded && typeof d.default_blend === 'boolean') state.models.blend = d.default_blend;
    // Drop any active model that no longer exists (e.g. a cloud model disabled by admin).
    const valid = new Set([...state.models.engines, ...state.models.cloud.filter((c) => c.available)].map((e) => e.id));
    state.models.active.forEach((id) => { if (!valid.has(id)) state.models.active.delete(id); });
    if (state.models.active.size === 0 && state.models.engines[0]) {
      state.models.active.add(state.models.engines[0].id);
    }
    state.models.loaded = true;
    const s = document.getElementById('aiStatus');
    if (s) {
      s.classList.toggle('online', state.models.ollamaOnline);
      s.classList.toggle('online', state.models.ollamaOnline || state.models.hosted);
      s.querySelector('span').textContent = state.models.ollamaOnline
        ? `Local AI online · ${state.models.engines.map((e) => e.label).join(', ')}`
        : state.models.hosted
          ? `Hosted AI online · ${state.models.engines.map((e) => e.label).join(', ')}`
          : 'AI offline · using simulated engine';
    }
  } catch (e) {
    state.models.engines = [{ id: 'simulated', label: 'Simulated', vendor: 'demo', available: true }];
    state.models.active.add('simulated');
  }
}

async function callAI(prompt, system) {
  const active = [...state.models.active];
  const model = active[0] || (state.models.engines[0] && state.models.engines[0].id);
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages }),
  });
  return r.json();
}

const SYS = 'You are StatVibe, an AI business assistant for a retail company (Illuminary Peak). Be concise, practical and specific. Use plain business language. Format with short paragraphs and bullet points where helpful.';

async function runWorkspace(prompt, title) {
  push('aiOutput', {});
  const el = app();
  // show a loading state in the card
  const card = el.querySelector('.card [style*="line-height:1.6"]') || el.querySelector('.card');
  if (card) card.innerHTML = `<div class="typing" style="color:var(--muted)"><i></i><i></i><i></i></div><div style="font-size:12px;color:var(--muted-2);margin-top:8px">Generating with ${esc((state.models.active.size && [...state.models.active][0]) || 'AI')}…</div>`;
  try {
    const d = await callAI(prompt, SYS);
    const engines = state.models.blend && state.models.active.size > 1
      ? [...state.models.active].map((id) => (state.models.engines.find((e) => e.id === id) || {}).label || id)
      : [d.model];
    state.lastAIOutput = { title: title || 'AI Output', content: d.content, model: d.model, simulated: d.simulated, engines };
    render();
    // Save to AI workspace history (best-effort).
    try {
      const { status, data } = await api('/ai/history', { method: 'POST', body: { title: title || 'AI Output', prompt, content: d.content, model: d.model, simulated: d.simulated } });
      if (status === 201) state.session.history.unshift(data.entry);
    } catch { /* ignore */ }
  } catch (e) {
    state.lastAIOutput = { title: title || 'AI Output', content: 'Could not reach the AI service. ' + e.message, model: 'error', simulated: true, engines: [] };
    render();
  }
}

/* ----------------------------------------------------------------------- */
/* Event wiring (delegation)                                                */
/* ----------------------------------------------------------------------- */
function wire(root) {
  // Bind the delegated click handler exactly once — #app persists across
  // renders, so re-adding it each time would stack duplicate listeners.
  if (!root._clickBound) {
    root._clickBound = true;
    bindClicks(root);
  }
  wireScreen(root);
}

function bindClicks(root) {
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act],[data-tab],[data-seg] button');
    if (!t) return;

    // segmented controls
    const seg = t.closest('[data-seg]');
    if (seg && t.dataset.v) {
      const which = seg.dataset.seg;
      if (which === 'calc') state.calc.tab = t.dataset.v;
      if (which === 'period') state.period = t.dataset.v;
      render();
      return;
    }

    // any element carrying data-tab jumps to that tab (tab bar, shortcuts,
    // settings row) unless it also carries a data-act handled in the switch
    // below that needs the sub-screen behaviour (none currently do).
    if (t.dataset.tab) { go(t.dataset.tab); return; }

    const act = t.dataset.act;
    switch (act) {
      case 'back': back(); break;
      // auth
      case 'toRegister': state.stack = [{ screen: 'register', params: {} }]; render(); break;
      case 'toLogin': state.stack = [{ screen: 'login', params: {} }]; render(); break;
      case 'guest': doGuest(); break;
      case 'download': downloadSheet(); break;
      case 'doRegister': doRegister(); break;
      case 'doLogin': doLogin(); break;
      case 'showTerms': push('terms', { tab: t.dataset.tabTerms || 'terms' }); break;
      case 'togglePwd': {
        const id = t.dataset.target;
        const inp = id ? document.getElementById(id) : null;
        if (!inp) break;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        t.textContent = show ? 'Hide' : 'Show';
        break;
      }
      case 'logout': doLogout(); break;
      // setup wizard
      case 'suSells': captureSetup(); state.setupDraft.sellsProducts = t.dataset.v === 'yes'; render(); break;
      case 'suGoal': { captureSetup(); const g = new Set(state.setupDraft.goals || []); g.has(t.dataset.v) ? g.delete(t.dataset.v) : g.add(t.dataset.v); state.setupDraft.goals = [...g]; render(); break; }
      case 'finishSetup': finishSetup(); break;
      // inventory
      case 'addItem': addItemSheet(); break;
      case 'predictItem': predictItem(t.dataset.id); break;
      case 'itemMenu': itemMenu(t.dataset.id); break;

      case 'goto': push(t.dataset.s); break;
      case 'gotoTab': go(t.dataset.tab); break;
      case 'openAlert': if (t.dataset.s === 'agent') { state.authed && (state.stack = []); go('agent'); } else if (t.dataset.s) go(t.dataset.s); break;
      case 'editIdea': editIdea(t.dataset.id); break;
      case 'newIdea': newIdea(); break;
      case 'aivibe': aivibe(); break;

      case 'switchWorkspace': openSheet(`<h3>Switch workspace</h3><div class="list" style="margin-top:12px">
        <button class="row" data-pick="Illuminary Peak"><span>Illuminary Peak</span><span class="tagchip green">Current</span></button>
        <button class="row" data-pick="Atlas Coffee Co."><span>Atlas Coffee Co.</span><span class="val">›</span></button>
        <button class="row" data-pick="New workspace…"><span style="color:var(--teal);font-weight:600">+ New workspace</span></button>
      </div>`); break;

      case 'applyPlan': toast('Forecast applied to your plan ✓'); break;
      case 'askAI': state.aiPrefill = t.dataset.q || ''; go('ai'); break;
      case 'saveStatsInputs': {
        state.statsDraft.revenue = ((document.getElementById('statsRevenue') || {}).value || '').trim();
        state.statsDraft.products = ((document.getElementById('statsProducts') || {}).value || '').trim();
        state.statsDraft.avgPrice = ((document.getElementById('statsAvgPrice') || {}).value || '').trim();
        if (!hasStatInputs()) { toast('Enter revenue, products, and avg price'); break; }
        saveStatsDraft();
        render();
        toast('Stats computed');
        break;
      }
      case 'editStatsInputs': {
        openSheet(`<h3>Edit statistics inputs</h3>
          <div class="field" style="margin-top:12px"><label>Revenue (MTD)</label><input id="statsRevenueEdit" inputmode="decimal" value="${esc(state.statsDraft.revenue || '')}" /></div>
          <div class="field"><label>Products sold (MTD)</label><input id="statsProductsEdit" inputmode="decimal" value="${esc(state.statsDraft.products || '')}" /></div>
          <div class="field"><label>Average price</label><input id="statsAvgPriceEdit" inputmode="decimal" value="${esc(state.statsDraft.avgPrice || '')}" /></div>
          <button class="btn" data-act="saveStatsInputsEdit">Save</button>`);
        break;
      }
      case 'saveStatsInputsEdit': {
        state.statsDraft.revenue = ((document.getElementById('statsRevenueEdit') || {}).value || '').trim();
        state.statsDraft.products = ((document.getElementById('statsProductsEdit') || {}).value || '').trim();
        state.statsDraft.avgPrice = ((document.getElementById('statsAvgPriceEdit') || {}).value || '').trim();
        if (!hasStatInputs()) { toast('Enter revenue, products, and avg price'); break; }
        saveStatsDraft();
        closeSheet();
        render();
        toast('Stats updated');
        break;
      }

      // calculator
      case 'calcReset': state.calc = { tab: state.calc.tab, unitCost: 42, freight: 5.72, overhead: 5.1, targetMargin: 55, markup: 55 }; render(); toast('Reset to SKU defaults'); break;
      case 'calcAI': { const c = state.calc; runWorkspace(`Our Trailhead Jacket has a landed cost of ${money(c.unitCost + c.freight + c.overhead)} and we currently target a ${c.markup}% markup. Recommend an optimal retail price and margin, considering competitor positioning.`, 'Price optimization'); break; }
      case 'reorder': toast('Reorder PO drafted — review in Agent'); break;

      // AI workspace
      case 'toggleEngine': toggleEngine(t.dataset.id); break;
      case 'cloudUnavail': toast(`${t.dataset.l} — Not available yet`); break;
      case 'toggleBlend': state.models.blend = !state.models.blend; state.settings.blend = state.models.blend; render(); break;
      case 'aiHistory': aiHistorySheet(); break;
      case 'runAI': { const p = ($('#aiPrompt') && $('#aiPrompt').value.trim()) || ''; if (!p) { toast('Type a prompt first'); break; } state.aiPrefill = ''; runWorkspace(p, titleFor(p)); break; }
      case 'runTask': runWorkspace(t.dataset.q, titleFor(t.dataset.q)); break;

      // AI output
      case 'refineAI': if (state.lastAIOutput) runWorkspace('Refine and tighten this document, keeping the same structure:\n\n' + state.lastAIOutput.content, state.lastAIOutput.title); break;
      case 'copyOutput': navigator.clipboard && navigator.clipboard.writeText(state.lastAIOutput ? state.lastAIOutput.content : '').then(() => toast('Copied to clipboard')); break;
      case 'exportOutput': case 'exportRevenue': toast('Exported'); break;
      case 'outputMenu': openSheet(`<h3>${esc(state.lastAIOutput ? state.lastAIOutput.title : 'Document')}</h3><div class="list" style="margin-top:12px"><button class="row" data-close><span>Duplicate</span></button><button class="row" data-close><span>Share link</span></button><button class="row" data-close><span style="color:var(--red)">Delete</span></button></div>`); break;

      // agent / messaging
      case 'openChat': openChat(t.dataset.id); break;
      case 'newChat': newChatSheet(); break;
      case 'agentDraft': agentDraft(); break;
      case 'agentSend': agentSend(); break;
      case 'approveSend': approveSend(); break;
      case 'editDraft': editDraft(); break;
      case 'agentSettings': agentSettingsSheet(); break;

      // plans
      case 'upgrade': case 'choosePlan': doUpgrade(t.dataset.p); break;

      // settings
      case 'toggleSettingBlend': state.settings.blend = !state.settings.blend; state.models.blend = state.settings.blend; render(); break;
      case 'toggleNotifications': state.settings.notifications = !state.settings.notifications; render(); toast(`Notifications ${state.settings.notifications ? 'on' : 'off'}`); break;
      case 'saveProfile': back(); toast('Profile saved ✓'); break;
      case 'changePwd': toast('Password reset link sent'); break;
      case 'twoFactor': toast('Two-factor setup coming soon'); break;
      case 'pickAppearance': themePicker(); break;
      case 'signout': doLogout(); break;
      // privacy & security / billing
      case 'changePwd2': changePasswordSheet(); break;
      case 'activeSessions': toast('1 active session · this device'); break;
      case 'exportData': exportData(); break;
      case 'myQR': qrSheet(); break;
      case 'copyTag': navigator.clipboard && navigator.clipboard.writeText(t.dataset.tag || '').then(() => toast('Code copied')); break;
      case 'paymentMethod': paymentSheet(); break;
      case 'deleteAccount': deleteAccountConfirm(); break;
      case 'editBusiness': editBusinessSheet(); break;
      case 'pickCurrency': currencySheet(); break;
      case 'noop': break;

      // admin / developer console
      case 'openAdmin': openAdmin(); break;
      case 'adminLogin': adminLogin(); break;
      case 'adminLogout': adminLogout(); break;
      case 'adminRefresh': adminRefresh(); break;
      case 'admSimulate': adminSetConfig({ simulateOnly: !((state.admin.summary || {}).config || {}).simulateOnly }); break;
      case 'admBlend': adminSetConfig({ defaultBlend: !((state.admin.summary || {}).config || {}).defaultBlend }); break;
      case 'admCloud': { const cur = (((state.admin.summary || {}).config || {}).cloudAvailable || {})[t.dataset.id]; adminSetConfig({ cloudAvailable: { [t.dataset.id]: !cur } }); break; }
      case 'admRunTest': adminRunTest(); break;
      case 'admJump': adminJump(t.dataset.s); break;
      case 'admResetConfig': adminFetch('reset', 'POST').then(() => { adminRefresh(); loadModels(); toast('Server config reset'); }); break;
      case 'admResetApp': adminResetApp(); break;
    }
  });

  // sheet picks
  const sheet = document.getElementById('sheet');
  sheet.onclick = (e) => {
    const toggle = e.target.closest('[data-act="togglePwd"]');
    if (toggle) {
      const inp = document.getElementById(toggle.dataset.target || '');
      if (inp) {
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        toggle.textContent = show ? 'Hide' : 'Show';
      }
      return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const w = pick.dataset.pick;
      if (w && !/new workspace/i.test(w)) { state.workspace = w; render(); toast('Switched to ' + w); }
      else toast('New workspace coming soon');
      closeSheet();
      return;
    }
    if (e.target.closest('[data-close]')) closeSheet();
  };
}

// Per-render bindings for elements that are recreated on each screen.
function wireScreen(root) {
  // calculator live inputs
  root.querySelectorAll('.calc-input').forEach((inp) => {
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value.replace(/[^0-9.]/g, ''));
      if (!isNaN(v)) { state.calc[inp.dataset.k] = v; updateCalc(); }
    });
    inp.addEventListener('focus', () => inp.select());
  });

  // profile live inputs (update in place, keep focus)
  root.querySelectorAll('.profile-input').forEach((inp) => {
    inp.addEventListener('input', () => {
      state.profile[inp.dataset.k] = inp.value;
      if (inp.dataset.k === 'name') {
        const init = initials(inp.value);
        const av = $('#pfAvatar'); if (av) av.textContent = init;
        const nm = $('#pfName'); if (nm) nm.textContent = inp.value;
      }
    });
  });

  // agent enter-to-send
  const ai = $('#agentInput');
  if (ai) ai.addEventListener('keydown', (e) => { if (e.key === 'Enter') agentSend(); });
  const ap = $('#aiPrompt');
  if (ap) ap.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { const p = ap.value.trim(); if (p) runWorkspace(p, titleFor(p)); } });
}

// Recompute only the calculator numbers without a full re-render (keeps focus)
function updateCalc() {
  const c = state.calc;
  const landed = c.unitCost + c.freight + c.overhead;
  const price = landed / (1 - c.markup / 100);
  const margin = ((price - landed) / price) * 100;
  const root = app();
  const priceEl = root.querySelector('.card.dark .big-num');
  if (priceEl) priceEl.textContent = money(price);
  const marginEl = root.querySelectorAll('.card.dark .big-num')[1];
  if (marginEl) marginEl.textContent = margin.toFixed(1) + '%';
  const meter = root.querySelector('.card.dark .meter > i');
  if (meter) meter.style.width = Math.min(100, margin).toFixed(0) + '%';
  const landedLine = root.querySelector('.card.dark .row-between span');
  if (landedLine) landedLine.innerHTML = `Landed cost ${money(landed)} · Target margin`;
}

function titleFor(q) {
  const s = q.toLowerCase();
  if (s.includes('board')) return 'Q3 Board Update';
  if (s.includes('plan')) return 'Business Plan';
  if (s.includes('forecast') || s.includes('scenario')) return 'Revenue Forecast';
  if (s.includes('email') || s.includes('outreach') || s.includes('re-engage')) return 'Outreach Draft';
  if (s.includes('procedure') || s.includes('sop') || s.includes('contract') || s.includes('document')) return 'Document Draft';
  if (s.includes('price') || s.includes('margin')) return 'Price Optimization';
  return 'AI Output';
}

function toggleEngine(id) {
  const a = state.models.active;
  if (a.has(id)) { if (a.size > 1) a.delete(id); else toast('Keep at least one model active'); }
  else a.add(id);
  render();
}

function enterApp() {
  state.authed = true;
  state.stack = [];
  state.tab = 'stats';
  render();
}

/* ---- Idea hub actions ---- */
async function loadIdeas() { const { status, data } = await api('/ideas'); if (status === 200) state.session.ideas = data.ideas; }
async function loadHistory() { const { status, data } = await api('/ai/history'); if (status === 200) state.session.history = data.history; }

function newIdea() {
  openSheet(`<h3>New idea</h3>
    <div class="field" style="margin-top:12px"><label>Title</label><input id="ideaTitle" placeholder="e.g. Wholesale marketplace"/></div>
    <div class="field"><label>Notes</label><textarea id="ideaNotes" rows="3" placeholder="What's the idea?"></textarea></div>
    <button class="btn" id="ideaSave">Add idea</button>`);
  setTimeout(() => { const b = document.getElementById('ideaSave'); if (b) b.onclick = async () => {
    const title = ((document.getElementById('ideaTitle') || {}).value || '').trim();
    const notes = ((document.getElementById('ideaNotes') || {}).value || '').trim();
    if (!title) { toast('Give it a title'); return; }
    const { status, data } = await api('/ideas', { method: 'POST', body: { title, notes } });
    if (status === 201) { state.session.ideas.unshift(data.idea); closeSheet(); render(); toast('Idea added'); } else toast(data.error || 'Could not add');
  }; }, 30);
}

function editIdea(id) {
  const it = (state.session.ideas || []).find((x) => x.id === id); if (!it) return;
  const statuses = ['Backlog', 'Building', 'Launched'];
  openSheet(`<h3>Edit idea</h3>
    <div class="field" style="margin-top:12px"><label>Title</label><input id="edTitle" value="${esc(it.title)}"/></div>
    <div class="field"><label>Notes</label><textarea id="edNotes" rows="4">${esc(it.notes || '')}</textarea></div>
    <div class="field"><label>Status</label><div class="flex gap-8" id="edStatus">${statuses.map((s) => `<button class="pill ${s === it.status ? 'solid' : ''}" data-st="${s}">${s}</button>`).join('')}</div></div>
    <button class="btn mb-10" data-a-save>Save changes</button>
    <button class="btn outline mb-10" data-a-ai>${I.spark('#0E7C66', 12, true)} AI next steps</button>
    <button class="btn outline" data-a-del style="color:var(--red)">Delete idea</button>`);
  let status = it.status;
  setTimeout(() => {
    const sh = document.getElementById('sheet');
    sh.querySelectorAll('#edStatus [data-st]').forEach((b) => b.onclick = () => { status = b.dataset.st; sh.querySelectorAll('#edStatus [data-st]').forEach((x) => x.className = 'pill' + (x.dataset.st === status ? ' solid' : '')); });
    sh.querySelector('[data-a-save]').onclick = async () => {
      const title = (document.getElementById('edTitle') || {}).value.trim(), notes = (document.getElementById('edNotes') || {}).value.trim();
      const { status: st, data } = await api('/ideas/' + id, { method: 'PATCH', body: { title, notes, status } });
      if (st === 200) { const i = state.session.ideas.findIndex((x) => x.id === id); state.session.ideas[i] = data.idea; closeSheet(); render(); toast('Saved'); } else toast(data.error || 'Could not save');
    };
    sh.querySelector('[data-a-ai]').onclick = () => { closeSheet(); runWorkspace(`Give me 3 concrete next steps to move the "${it.title}" idea forward. Context: ${it.notes || it.title}`, it.title); };
    sh.querySelector('[data-a-del]').onclick = async () => { closeSheet(); await api('/ideas/' + id, { method: 'DELETE' }); state.session.ideas = state.session.ideas.filter((x) => x.id !== id); render(); toast('Deleted'); };
  }, 30);
}

function aiHistorySheet() {
  const h = state.session.history || [];
  openSheet(`<h3>AI history</h3><div class="sub" style="margin-bottom:12px">Your recent AI Workspace queries${h.length ? '' : ' will appear here'}</div>
    ${h.length ? `<div class="list">${h.map((e) => `<button class="row" data-hist="${e.id}"><div style="text-align:left"><div style="font-size:13.5px;font-weight:500">${esc(e.title)}</div><div style="font-size:11px;color:var(--muted-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${esc(e.prompt || e.content)}</div></div><span class="val">›</span></button>`).join('')}</div>
    <button class="btn outline" data-a-clear style="margin-top:12px;color:var(--red)">Clear history</button>`
    : '<div class="card" style="text-align:center;padding:22px;color:var(--muted-2);font-size:13px">No history yet — run a task to save it.</div>'}`);
  setTimeout(() => {
    const sh = document.getElementById('sheet');
    sh.querySelectorAll('[data-hist]').forEach((b) => b.onclick = () => { const e = h.find((x) => x.id === b.dataset.hist); if (e) { state.lastAIOutput = { title: e.title, content: e.content, model: e.model, simulated: e.simulated, engines: [e.model] }; closeSheet(); push('aiOutput', {}); } });
    const c = sh.querySelector('[data-a-clear]'); if (c) c.onclick = async () => { await api('/ai/history', { method: 'DELETE' }); state.session.history = []; closeSheet(); render(); toast('History cleared'); };
  }, 30);
}

// AIVibe: reformulate a rough idea into a sharp, usable AI prompt.
async function aivibe() {
  const inp = $('#aivibeInput'); const raw = inp ? inp.value.trim() : '';
  if (!raw) { toast('Describe your idea first'); return; }
  toast('AIVibe is refining…');
  try {
    const d = await callAI(`Rewrite this rough business idea into a clear, specific, well-structured AI prompt I can reuse. Keep it under 80 words. Idea: "${raw}"`, 'You are AIVibe, a prompt engineer for business owners. Output ONLY the refined prompt, no preamble.');
    openSheet(`<h3>${I.spark('#0E7C66', 15, true)} AIVibe prompt</h3>
      <div style="font-size:11px;color:var(--muted-2);margin:4px 0 10px">From: "${esc(raw)}"</div>
      <div style="background:var(--chip);border-radius:10px;padding:12px;font-size:13px;line-height:1.55;white-space:pre-wrap">${esc(d.content.trim())}</div>
      <button class="btn" data-a-run style="margin-top:12px">Run this prompt in AI Workspace →</button>
      <button class="btn outline" data-a-save-idea style="margin-top:8px">Save as idea</button>`);
    setTimeout(() => {
      const sh = document.getElementById('sheet');
      sh.querySelector('[data-a-run]').onclick = () => { closeSheet(); state.aiPrefill = d.content.trim(); go('ai'); };
      sh.querySelector('[data-a-save-idea]').onclick = async () => { const { status, data } = await api('/ideas', { method: 'POST', body: { title: raw.slice(0, 60), notes: d.content.trim() } }); if (status === 201) { state.session.ideas.unshift(data.idea); closeSheet(); go('hub'); toast('Saved as idea'); } };
    }, 30);
  } catch { toast('AIVibe failed — try again'); }
}

/* ---- Messaging / Agent (real cross-user chat) ---- */
function scrollChat() { const s = document.getElementById('chatScroll'); if (s) s.scrollTop = s.scrollHeight; }

async function loadConversations() {
  const { status, data } = await api('/conversations');
  if (status === 200) { state.session.conversations = data.conversations; state.session.unreadTotal = data.unreadTotal; }
}

async function openChat(convId) {
  const conv = (state.session.conversations || []).find((c) => c.id === convId);
  state.chat = { convId, other: conv ? conv.other : { name: 'Chat', tag: '' }, messages: [], draft: null, drafting: false };
  push('chat');
  const { status, data } = await api('/conversations/' + convId + '/messages');
  if (status === 200) { state.chat.messages = data.messages; state.chat.other = data.other; }
  loadConversations();
  render(); scrollChat();
}

async function refreshChat() {
  if (!state.chat.convId) return;
  const { status, data } = await api('/conversations/' + state.chat.convId + '/messages');
  if (status === 200 && data.messages.length !== state.chat.messages.length) {
    state.chat.messages = data.messages; state.chat.other = data.other;
    if (currentScreen() === 'chat') { render(); scrollChat(); }
  }
}

async function agentSend() {
  const inp = $('#agentInput'); const txt = inp && inp.value.trim();
  if (!txt || !state.chat.convId) return;
  state.chat.draft = null;
  const { status, data } = await api('/conversations/' + state.chat.convId + '/messages', { method: 'POST', body: { text: txt } });
  if (status === 201) { state.chat.messages.push(data.message); render(); scrollChat(); loadConversations(); }
  else toast((data && data.error) || 'Could not send');
}

async function agentDraft() {
  if (!state.chat.convId || state.chat.drafting) return;
  if (state.chat.draft) { toast('You already have a draft — Edit or Approve it'); return; }
  const me = state.session.user && state.session.user.id;
  const lastTheirs = [...state.chat.messages].reverse().find((m) => m.from !== me);
  state.chat.drafting = true;
  const scroll = document.getElementById('chatScroll');
  if (scroll) { const el = document.createElement('div'); el.className = 'bubble ai'; el.innerHTML = `<div class="ai-tag">${I.spark('#7FE3C8', 13, true)}AgentTech drafting</div><div class="typing" style="color:#7FE3C8"><i></i><i></i><i></i></div>`; scroll.appendChild(el); scrollChat(); }
  const prompt = `You are messaging on behalf of the business "${bizName()}" to ${state.chat.other.name}. Their last message: "${lastTheirs ? lastTheirs.text : '(none yet — write a friendly opener)'}". Draft a short, warm, professional reply suited to their message. Under 55 words. No preamble.`;
  try {
    const d = await callAI(prompt, 'You are AgentTech, an AI messaging assistant that drafts replies to clients and partners for a business owner. Be concise, friendly and specific.');
    const text = d.content.trim();
    if (state.session.agentAutoReply) {
      const r = await api('/conversations/' + state.chat.convId + '/messages', { method: 'POST', body: { text } });
      state.chat.drafting = false;
      if (r.status === 201) { state.chat.messages.push(r.data.message); toast('AgentTech auto-replied ✓'); loadConversations(); }
      render(); scrollChat(); return;
    }
    state.chat.draft = text;
  } catch (e) { toast('Could not draft reply'); }
  finally { state.chat.drafting = false; render(); scrollChat(); }
}

async function approveSend() {
  if (!state.chat.draft || !state.chat.convId) return;
  const text = state.chat.draft; state.chat.draft = null;
  const { status, data } = await api('/conversations/' + state.chat.convId + '/messages', { method: 'POST', body: { text } });
  if (status === 201) { state.chat.messages.push(data.message); render(); scrollChat(); toast('Sent ✓'); loadConversations(); }
}

function editDraft() {
  const d = state.chat.draft; if (!d) return;
  state.chat.draft = null; render();
  const inp = $('#agentInput'); if (inp) { inp.value = d; inp.focus(); }
}

function agentSettingsSheet() {
  const auto = state.session.agentAutoReply;
  openSheet(`<h3>AgentTech settings</h3>
    <div class="list" style="margin-top:12px">
      <div class="row" style="cursor:default"><div><div style="font-size:13.5px">Auto-reply</div><div style="font-size:11.5px;color:var(--muted-2)">AI answers new messages automatically</div></div><button class="toggle ${auto ? 'on' : ''}" data-a-auto></button></div>
      <div class="row" style="cursor:default"><div><div style="font-size:13.5px">Approval mode</div><div style="font-size:11.5px;color:var(--muted-2)">You review each AI draft before it sends</div></div><span class="tagchip ${auto ? 'grey' : 'green'}">${auto ? 'off' : 'on'}</span></div>
    </div>
    <div style="font-size:11px;color:var(--muted-3);margin-top:12px;line-height:1.5">Approval mode: AI drafts a reply and waits for Approve/Edit. Auto-reply: AgentTech responds in real time.</div>
    <button class="btn" data-close style="margin-top:14px">Done</button>`);
  setTimeout(() => { const b = document.querySelector('#sheet [data-a-auto]'); if (b) b.onclick = () => { state.session.agentAutoReply = !state.session.agentAutoReply; render(); agentSettingsSheet(); toast('Auto-reply ' + (state.session.agentAutoReply ? 'on' : 'off')); }; }, 30);
}

// New message → add a contact by scanning/uploading their StatVibe QR or code.
function newChatSheet() {
  const canScan = 'BarcodeDetector' in window;
  openSheet(`<h3>New message</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Add someone by their StatVibe QR or code. They can message you the same way — from your QR.</div>
    <div class="stack gap-10">
      ${canScan ? `<button class="btn" data-a-scan>${I.spark('#fff', 13, true)} Scan QR with camera</button>` : ''}
      <label class="btn outline" style="cursor:pointer;margin:0">Upload a QR image<input id="qrFile" type="file" accept="image/*" style="display:none" /></label>
    </div>
    <div class="flex items-center gap-12" style="margin:16px 0"><div style="flex:1;height:1px;background:var(--line-2)"></div><span style="font-size:11px;color:var(--muted-3)">or enter code</span><div style="flex:1;height:1px;background:var(--line-2)"></div></div>
    <div class="field" style="margin-bottom:10px"><input id="tagInput" placeholder="SV-XXXXXX" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:1px" /></div>
    <button class="btn" data-a-tag>Start chat</button>
    <div style="text-align:center;margin-top:12px"><b data-act="myQR" style="font-size:12.5px;color:var(--teal);cursor:pointer">Show my QR so others can reach me →</b></div>`);
  setTimeout(() => {
    const sh = document.getElementById('sheet');
    const tagBtn = sh.querySelector('[data-a-tag]'); if (tagBtn) tagBtn.onclick = () => { const v = (document.getElementById('tagInput') || {}).value; if (v && v.trim()) startConversationByTag(v.trim()); else toast('Enter a StatVibe code'); };
    const scanBtn = sh.querySelector('[data-a-scan]'); if (scanBtn) scanBtn.onclick = () => scanQRCamera();
    const file = sh.querySelector('#qrFile'); if (file) file.onchange = (e) => decodeQRImage(e.target.files[0]);
  }, 30);
}

async function startConversationByTag(tag) {
  const { status, data } = await api('/conversations', { method: 'POST', body: { tag } });
  if (status === 200) { closeSheet(); await loadConversations(); openChat(data.conversation.id); }
  else toast((data && data.error) || 'Could not start chat');
}

// Decode a QR from an uploaded image using the built-in BarcodeDetector.
async function decodeQRImage(file) {
  if (!file) return;
  if (!('BarcodeDetector' in window)) { toast('Scanning not supported here — enter the code'); return; }
  try {
    const bmp = await createImageBitmap(file);
    const codes = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bmp);
    if (codes.length) startConversationByTag(codes[0].rawValue);
    else toast('No QR found in that image');
  } catch (e) { toast('Could not read that image'); }
}

// Live camera QR scan (BarcodeDetector). Opens a small scanner overlay.
async function scanQRCamera() {
  if (!('BarcodeDetector' in window)) { toast('Camera scanning not supported here'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
  catch { toast('Camera permission denied'); return; }
  openSheet(`<h3>Scan a StatVibe QR</h3><video id="qrVid" autoplay playsinline muted style="width:100%;border-radius:14px;background:#000;margin-top:10px"></video><button class="btn outline" data-close style="margin-top:12px">Cancel</button>`);
  const det = new window.BarcodeDetector({ formats: ['qr_code'] });
  setTimeout(async () => {
    const vid = document.getElementById('qrVid'); if (!vid) { stream.getTracks().forEach((t) => t.stop()); return; }
    vid.srcObject = stream;
    const tick = async () => {
      if (!document.getElementById('qrVid')) { stream.getTracks().forEach((t) => t.stop()); return; }
      try { const codes = await det.detect(vid); if (codes.length) { stream.getTracks().forEach((t) => t.stop()); startConversationByTag(codes[0].rawValue); return; } } catch { /* keep scanning */ }
      setTimeout(tick, 400);
    };
    tick();
  }, 60);
}

/* ---- Admin / Developer ---- */
async function adminFetch(sub, method = 'GET', body) {
  const r = await fetch('/api/admin/' + sub, {
    method,
    headers: { 'x-admin-token': state.admin.token || '', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch { /* ignore */ }
  return { status: r.status, data };
}

async function adminLogin() {
  const inp = $('#admToken');
  const token = inp ? inp.value.trim() : '';
  if (!token) { toast('Enter the admin token'); return; }
  state.admin.token = token; state.admin.busy = true; render();
  const { status, data } = await adminFetch('summary');
  state.admin.busy = false;
  if (status === 200) {
    state.admin.authed = true; state.admin.summary = data;
    try { sessionStorage.setItem('sv_admin_token', token); } catch { /* ignore */ }
    render(); toast('Admin console unlocked');
  } else {
    state.admin.token = null; render(); toast(data.error || 'Invalid admin token');
  }
}

function adminLogout() {
  state.admin.authed = false; state.admin.summary = null; state.admin.token = null; state.admin.testOut = null;
  try { sessionStorage.removeItem('sv_admin_token'); } catch { /* ignore */ }
  render();
}

async function adminRefresh() {
  const { status, data } = await adminFetch('summary');
  if (status === 200) { state.admin.summary = data; render(); } else { adminLogout(); toast('Session expired'); }
}

async function adminSetConfig(patch) {
  const { status, data } = await adminFetch('config', 'POST', patch);
  if (status === 200) {
    state.admin.summary = { ...(state.admin.summary || {}), config: data.config };
    await loadModels();           // reflect engine/cloud changes app-wide
    await adminRefresh();
    toast('Config updated');
  } else { toast(data.error || 'Update failed'); }
}

async function adminRunTest() {
  const model = $('#admModel') ? $('#admModel').value : undefined;
  const prompt = $('#admPrompt') ? $('#admPrompt').value.trim() : '';
  if (!prompt) { toast('Enter a test prompt'); return; }
  state.admin.testOut = { model: model || 'auto', content: 'Running…', simulated: false };
  render();
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }) });
    const d = await r.json();
    state.admin.testOut = { model: d.model, content: d.content + (d.note ? '\n\n(' + d.note + ')' : ''), simulated: d.simulated };
  } catch (e) { state.admin.testOut = { model: 'error', content: e.message, simulated: true }; }
  render();
}

function adminJump(screen) {
  const tabs = ['stats', 'calc', 'hub', 'ai', 'agent'];
  state.authed = true;
  if (screen === 'welcome') { state.authed = false; state.stack = []; render(); return; }
  if (screen === 'signin') { state.authed = false; state.stack = [{ screen: 'signin', params: {} }]; render(); return; }
  if (tabs.includes(screen)) { go(screen); return; }
  state.stack = [{ screen, params: {} }]; render();
}

function adminResetApp() {
  try { sessionStorage.clear(); } catch { /* ignore */ }
  location.hash = '';
  location.reload();
}

async function openAdmin() {
  push('admin');
  let tok = null;
  try { tok = sessionStorage.getItem('sv_admin_token'); } catch { /* ignore */ }
  if (tok && !state.admin.authed) {
    state.admin.token = tok;
    const { status, data } = await adminFetch('summary');
    if (status === 200) { state.admin.authed = true; state.admin.summary = data; render(); }
    else { state.admin.token = null; }
  }
}

/* ---- Download / install (PWA) ---- */
function downloadSheet() {
  const canInstall = !!installPrompt;
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  openSheet(`<h3>Get the StatVibe app</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Install StatVibe on your phone or computer — it runs full-screen, gets its own icon, and works offline.</div>
    ${standalone ? '<div class="card" style="text-align:center;padding:20px;font-size:13px">✅ You\'re already using the installed app.</div>'
      : `${canInstall ? '<button class="btn" data-a-install style="margin-bottom:12px">Install now</button>' : ''}
      <div class="list">
        <div class="row" style="cursor:default;display:block;padding:12px 15px"><div style="font-size:13px;font-weight:600;margin-bottom:2px">📱 iPhone / iPad</div><div style="font-size:12px;color:var(--muted);line-height:1.5">Open in <b>Safari</b> → tap the Share button → <b>Add to Home Screen</b>.</div></div>
        <div class="row" style="cursor:default;display:block;padding:12px 15px"><div style="font-size:13px;font-weight:600;margin-bottom:2px">🤖 Android</div><div style="font-size:12px;color:var(--muted);line-height:1.5">Open in <b>Chrome</b> → menu ⋮ → <b>Install app</b> (or Add to Home screen).</div></div>
        <div class="row" style="cursor:default;display:block;padding:12px 15px"><div style="font-size:13px;font-weight:600;margin-bottom:2px">💻 Desktop</div><div style="font-size:12px;color:var(--muted);line-height:1.5">Click the <b>install</b> icon in the browser's address bar.</div></div>
      </div>
      <div style="font-size:11px;color:var(--muted-3);margin-top:12px;line-height:1.5">A native Android APK / iOS build is on the way — for now the installable app above gives you the same full-screen experience on both platforms.</div>`}
    <button class="btn outline" data-close style="margin-top:12px">Close</button>`);
  setTimeout(() => {
    const b = document.querySelector('#sheet [data-a-install]');
    if (b) b.onclick = async () => { if (!installPrompt) return; installPrompt.prompt(); const r = await installPrompt.userChoice.catch(() => ({})); installPrompt = null; closeSheet(); toast(r.outcome === 'accepted' ? 'Installing StatVibe…' : 'Install dismissed'); };
  }, 30);
}

/* ---- Auth / session actions ---- */
async function doGuest() {
  const { status, data } = await api('/auth/guest', { method: 'POST', auth: false });
  if (status === 201 || status === 200) { applySession(data, { remember: false }); state.stack = []; render(); toast('Exploring as guest'); }
  else toast(data.error || 'Could not start guest session');
}
async function doRegister() {
  const name = ($('#regName') || {}).value, email = ($('#regEmail') || {}).value, password = ($('#regPwd') || {}).value;
  const terms = ($('#regTerms') || {}).checked;
  if (!terms) { toast('Please accept the Terms & Privacy Policy'); return; }
  const { status, data } = await api('/auth/register', { method: 'POST', auth: false, body: { name: (name || '').trim(), email: (email || '').trim(), password, acceptedTerms: !!terms } });
  if (status === 201) { applySession(data, { remember: true }); state.auth.remember = true; state.stack = []; render(); toast('Account created — set up your business'); }
  else toast(data.error || 'Registration failed');
}
async function doLogin() {
  const email = (($('#loginEmail') || {}).value || '').trim(), password = ($('#loginPwd') || {}).value;
  state.auth.remember = true;
  const { status, data } = await api('/auth/login', { method: 'POST', auth: false, body: { email, password } });
  if (status === 200) { applySession(data, { remember: true }); state.stack = []; state.tab = 'stats'; render(); toast('Welcome back'); }
  else toast(data.error || 'Sign in failed');
}
async function doLogout() {
  await api('/auth/logout', { method: 'POST' });
  clearTokenStorage();
  const curr = state.session.currencies;
  state.session = { token: null, user: null, account: null, inventory: [], currencies: curr, cloudinary: state.session.cloudinary, loaded: true };
  state.authed = false; state.stack = []; state.tab = 'stats'; render(); toast('Signed out');
}
function captureSetup() {
  const d = state.setupDraft;
  if ($('#suName')) d.businessName = $('#suName').value;
  if ($('#suIndustry')) d.industry = $('#suIndustry').value;
  if ($('#suCurrency')) d.currency = $('#suCurrency').value;
  if ($('#suTeam')) d.teamSize = $('#suTeam').value;
}
async function finishSetup() {
  captureSetup();
  const d = state.setupDraft;
  if (!d.businessName || !d.businessName.trim()) { toast('Enter your business name'); return; }
  const { status, data } = await api('/account/setup', { method: 'POST', body: {
    businessName: d.businessName.trim(), industry: d.industry, currency: d.currency, teamSize: d.teamSize,
    sellsProducts: d.sellsProducts !== false, goals: d.goals || [],
  } });
  if (status === 200) { state.session.account = data.account; state.stack = []; state.tab = d.sellsProducts !== false ? 'calc' : 'stats'; render(); toast("You're all set 🎉"); }
  else toast(data.error || 'Setup failed');
}

/* ---- Inventory actions ---- */
function addItemSheet() {
  const sym = currency().symbol;
  openSheet(`<h3>Add product</h3>
    <div class="field" style="margin-top:12px"><label>Product name</label><input id="itName" placeholder="e.g. Rice 5kg"/></div>
    <div class="grid-2"><div class="field"><label>Stock on hand</label><input id="itStock" inputmode="decimal" placeholder="0"/></div><div class="field"><label>Unit</label><input id="itUnit" placeholder="pcs / sacks"/></div></div>
    <div class="grid-2"><div class="field"><label>Price (${esc(sym)})</label><input id="itPrice" inputmode="decimal" placeholder="0"/></div><div class="field"><label>Cost (${esc(sym)})</label><input id="itCost" inputmode="decimal" placeholder="0"/></div></div>
    <div class="grid-2"><div class="field"><label>Size</label><input id="itSize" placeholder="e.g. 5kg / L"/></div><div class="field"><label>Weight</label><input id="itWeight" placeholder="e.g. 5kg"/></div></div>
    <div class="grid-2"><div class="field"><label>Qty / pack</label><input id="itQty" inputmode="decimal" placeholder="1"/></div><div class="field"><label>SKU</label><input id="itSku" placeholder="optional"/></div></div>
    <div class="field"><label>Daily rate — units used or sold per day</label><input id="itRate" inputmode="decimal" placeholder="e.g. 8"/></div>
    <div class="field"><label>Rate basis</label><div class="flex gap-8"><button class="pill solid" data-rate="sales">Sales</button><button class="pill" data-rate="consumption">Consumption</button></div></div>
    <button class="btn" id="itSave">Add to inventory</button>`);
  setTimeout(() => {
    const sd = document.getElementById('sheet'); let basis = 'sales';
    sd.querySelectorAll('[data-rate]').forEach((b) => b.onclick = () => { basis = b.dataset.rate; sd.querySelectorAll('[data-rate]').forEach((x) => x.className = 'pill' + (x.dataset.rate === basis ? ' solid' : '')); });
    const btn = document.getElementById('itSave');
    if (btn) btn.onclick = async () => {
      const g = (id) => (document.getElementById(id) || {}).value;
      const name = (g('itName') || '').trim(); if (!name) { toast('Enter a product name'); return; }
      const { status, data } = await api('/inventory', { method: 'POST', body: { name, stock: g('itStock'), unit: g('itUnit'), price: g('itPrice'), cost: g('itCost'), size: g('itSize'), weight: g('itWeight'), quantity: g('itQty'), sku: g('itSku'), ratePerDay: g('itRate'), rateBasis: basis } });
      if (status === 201) { state.session.inventory.push(data.item); closeSheet(); render(); toast('Added ' + data.item.name); predictItem(data.item.id); }
      else toast(data.error || 'Could not add item');
    };
  }, 30);
}
async function predictItem(id) {
  state.predictions[id] = { days: null, note: 'Predicting…', status: 'healthy' }; render();
  const { status, data } = await api('/predict', { method: 'POST', body: { itemId: id } });
  if (status === 200) { state.predictions[id] = data; render(); if (data.days == null) toast(data.note); }
  else { delete state.predictions[id]; render(); toast(data.error || 'Prediction failed'); }
}
function itemMenu(id) {
  const it = (state.session.inventory || []).find((x) => x.id === id); if (!it) return;
  openSheet(`<h3>${esc(it.name)}</h3><div class="sub" style="margin-bottom:14px">${Number(it.stock).toLocaleString()} ${esc(it.unit || 'units')} · ${money(it.price)}</div>
    <button class="btn mb-10" id="imPredict">${I.spark('#fff', 13, true)} Predict days left</button>
    <button class="btn outline mb-10" id="imRestock">Update stock / rate</button>
    <button class="btn outline" id="imDelete" style="color:var(--red)">Delete item</button>`);
  setTimeout(() => {
    const p = document.getElementById('imPredict'); if (p) p.onclick = () => { closeSheet(); predictItem(id); };
    const r = document.getElementById('imRestock'); if (r) r.onclick = () => { closeSheet(); restockSheet(id); };
    const d = document.getElementById('imDelete'); if (d) d.onclick = async () => { closeSheet(); const { status } = await api('/inventory/' + id, { method: 'DELETE' }); if (status === 200) { state.session.inventory = state.session.inventory.filter((x) => x.id !== id); delete state.predictions[id]; render(); toast('Deleted'); } };
  }, 30);
}
function restockSheet(id) {
  const it = (state.session.inventory || []).find((x) => x.id === id); if (!it) return;
  openSheet(`<h3>Update ${esc(it.name)}</h3>
    <div class="field" style="margin-top:12px"><label>Stock on hand</label><input id="rsStock" inputmode="decimal" value="${it.stock}"/></div>
    <div class="field"><label>Daily rate (${esc(it.rateBasis || 'sales')})</label><input id="rsRate" inputmode="decimal" value="${it.ratePerDay || ''}"/></div>
    <button class="btn" id="rsSave">Save</button>`);
  setTimeout(() => { const b = document.getElementById('rsSave'); if (b) b.onclick = async () => {
    const stock = (document.getElementById('rsStock') || {}).value, rate = (document.getElementById('rsRate') || {}).value;
    const { status, data } = await api('/inventory/' + id, { method: 'PATCH', body: { stock, ratePerDay: rate } });
    if (status === 200) { const i = state.session.inventory.findIndex((x) => x.id === id); state.session.inventory[i] = data.item; delete state.predictions[id]; closeSheet(); render(); toast('Updated'); predictItem(id); }
    else toast(data.error || 'Update failed');
  }; }, 30);
}

/* ---- Privacy & Security / billing ---- */
function changePasswordSheet() {
  openSheet(`<h3>Change password</h3>
    <div class="field" style="margin-top:12px"><label>Current password</label><div style="display:flex;gap:8px;align-items:center"><input id="cpCur" type="password" autocomplete="current-password" style="flex:1"/><button class="pill" type="button" data-act="togglePwd" data-target="cpCur">Show</button></div></div>
    <div class="field"><label>New password · min 8 characters</label><div style="display:flex;gap:8px;align-items:center"><input id="cpNew" type="password" autocomplete="new-password" style="flex:1"/><button class="pill" type="button" data-act="togglePwd" data-target="cpNew">Show</button></div></div>
    <button class="btn" id="cpSave">Update password</button>`);
  setTimeout(() => { const b = document.getElementById('cpSave'); if (b) b.onclick = async () => {
    const currentPassword = (document.getElementById('cpCur') || {}).value, newPassword = (document.getElementById('cpNew') || {}).value;
    const { status, data } = await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    if (status === 200) { if (data.token) { state.session.token = data.token; persistToken(data.token, true); } closeSheet(); toast('Password updated'); }
    else toast(data.error || 'Could not update password');
  }; }, 30);
}
function deleteAccountConfirm() {
  openSheet(`<h3 style="color:var(--red)">Delete account?</h3>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin:8px 0 16px">This permanently deletes your account, business setup, inventory and notes. This cannot be undone.</div>
    <button class="btn" id="daYes" style="background:var(--red)">Yes, delete everything</button>
    <button class="btn ghost" id="daNo" style="margin-top:6px">Cancel</button>`);
  setTimeout(() => {
    const n = document.getElementById('daNo'); if (n) n.onclick = closeSheet;
    const y = document.getElementById('daYes'); if (y) y.onclick = async () => {
      const { status } = await api('/account', { method: 'DELETE' }); closeSheet();
      if (status === 200) { clearTokenStorage(); const cur = state.session.currencies; state.session = { token: null, user: null, account: null, inventory: [], currencies: cur, cloudinary: state.session.cloudinary, loaded: true }; state.authed = false; state.stack = []; render(); toast('Account deleted'); }
      else toast('Could not delete account');
    };
  }, 30);
}
function exportData() {
  try {
    const blob = new Blob([JSON.stringify({ user: state.session.user, account: state.session.account, inventory: state.session.inventory }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'statvibe-data.json'; a.click(); URL.revokeObjectURL(url); toast('Exported your data');
  } catch { toast('Export not supported here'); }
}
// Deterministic decorative QR-style grid (not a scannable code — placeholder for beta).
function qrPlaceholder(text, size = 150) {
  let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  const n = 21, cell = size / n; let rects = '';
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const finder = (x, y) => { for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) { const edge = dx === 0 || dy === 0 || dx === 6 || dy === 6; const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4; if (edge || core) rects += `<rect x="${(x + dx) * cell}" y="${(y + dy) * cell}" width="${cell}" height="${cell}"/>`; } };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if ((x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)) continue; if (rnd() > 0.55) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`; }
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="#14171C"><rect width="${size}" height="${size}" fill="#fff"/>${rects}</svg>`;
}
/* ---- Real QR encoder (byte mode, ECC-L, versions 1–4, single block) ---- */
const QR = (() => {
  const EXP = new Array(512), LOG = new Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  const DATA_CAP = { 1: 19, 2: 34, 3: 55, 4: 80 };   // byte-mode data codewords, ECC level L
  const EC_CW = { 1: 7, 2: 10, 3: 15, 4: 20 };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26] };

  function rsEncode(data, ec) {
    let gen = [1];
    for (let i = 0; i < ec; i++) { const g2 = new Array(gen.length + 1).fill(0); for (let j = 0; j < gen.length; j++) { g2[j] ^= gen[j]; g2[j + 1] ^= gmul(gen[j], EXP[i]); } gen = g2; }
    const res = new Array(data.length + ec).fill(0);
    for (let i = 0; i < data.length; i++) res[i] = data[i];
    for (let i = 0; i < data.length; i++) { const c = res[i]; if (c) for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], c); }
    return res.slice(data.length);
  }
  function encode(text, version) {
    const bytes = Array.from(new TextEncoder().encode(text));
    const bits = []; const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
    push(0b0100, 4); push(bytes.length, 8); bytes.forEach((b) => push(b, 8));
    const cap = DATA_CAP[version] * 8;
    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const pads = [0xEC, 0x11]; let p = 0; while (bits.length < cap) { push(pads[p++ % 2], 8); }
    const cw = []; for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; cw.push(v); }
    return cw.concat(rsEncode(cw, EC_CW[version]));
  }
  function modules(text) {
    let version = 1; while (version < 4 && new TextEncoder().encode(text).length + 2 > DATA_CAP[version]) version++;
    const size = 17 + 4 * version;
    const m = Array.from({ length: size }, () => new Array(size).fill(null));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false)); // function-module mask
    const set = (r, c, v) => { m[r][c] = v; fn[r][c] = true; };
    const finder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue; const on = i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)); set(rr, cc, on); } };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); } // timing
    const ac = ALIGN[version];
    for (const r of ac) for (const c of ac) { if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1); }
    set(size - 8, 8, true); // dark module
    for (let i = 0; i < 9; i++) { if (!fn[8][i]) { m[8][i] = null; fn[8][i] = true; } if (!fn[i][8]) { m[i][8] = null; fn[i][8] = true; } } // reserve format
    for (let i = 0; i < 8; i++) { fn[8][size - 1 - i] = true; fn[size - 1 - i][8] = true; }

    const cw = encode(text, version); const bitsArr = []; cw.forEach((b) => { for (let i = 7; i >= 0; i--) bitsArr.push((b >> i) & 1); });
    let bi = 0, up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let k = 0; k < size; k++) { const row = up ? size - 1 - k : k; for (let c = 0; c < 2; c++) { const cc = col - c; if (fn[row][cc]) continue; m[row][cc] = bi < bitsArr.length ? bitsArr[bi++] === 1 : false; } }
      up = !up;
    }
    const maskFn = [(r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2 + (r * c) % 3) === 0, (r, c) => (((r * c) % 2 + (r * c) % 3) % 2) === 0, (r, c) => (((r + c) % 2 + (r * c) % 3) % 2) === 0];
    const fmtBits = (mask) => {
      const data5 = (0b01 << 3) | mask;      // ECC level L = 01, then 3 mask bits
      let d = data5 << 10;
      for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= (0x537 << (i - 10)); // BCH(15,5)
      return ((data5 << 10) | (d & 0x3FF)) ^ 0x5412;                            // + mask pattern
    };
    const applyFormat = (grid, mask) => {
      const v = fmtBits(mask); const bit = (i) => (v >> i) & 1;
      // Copy 1 — around the top-left finder (skips timing modules).
      for (let i = 0; i <= 5; i++) grid[8][i] = bit(i);
      grid[8][7] = bit(6); grid[8][8] = bit(7); grid[7][8] = bit(8);
      for (let i = 9; i <= 14; i++) grid[14 - i][8] = bit(i);
      // Copy 2 — split along the top-right row and bottom-left column.
      for (let i = 0; i <= 7; i++) grid[size - 1 - i][8] = bit(i);
      for (let i = 8; i <= 14; i++) grid[8][size - 15 + i] = bit(i);
      grid[size - 8][8] = 1; // dark module
    };
    const penalty = (grid) => { let p = 0; for (let r = 0; r < size; r++) { let run = 1; for (let c = 1; c < size; c++) { if (grid[r][c] === grid[r][c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } } for (let c = 0; c < size; c++) { let run = 1; for (let r = 1; r < size; r++) { if (grid[r][c] === grid[r - 1][c]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } } for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) if (grid[r][c] === grid[r][c + 1] && grid[r][c] === grid[r + 1][c] && grid[r][c] === grid[r + 1][c + 1]) p += 3; let dark = 0; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (grid[r][c]) dark++; p += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10; return p; };

    let best = null, bestP = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const g = m.map((row) => row.slice());
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fn[r][c] && maskFn[mask](r, c)) g[r][c] = g[r][c] ? 0 : 1;
      applyFormat(g, mask);
      const gb = g.map((row) => row.map((x) => x === 1 || x === true));
      const pen = penalty(gb);
      if (pen < bestP) { bestP = pen; best = gb; }
    }
    return best;
  }
  function svg(text, size = 200, quiet = 4) {
    const m = modules(text); const n = m.length; const total = n + quiet * 2; const cell = +(size / total).toFixed(3);
    let rects = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) rects += `<rect x="${((c + quiet) * cell).toFixed(2)}" y="${((r + quiet) * cell).toFixed(2)}" width="${cell}" height="${cell}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
  }
  return { svg };
})();
window.QR = QR; // exposed for QR round-trip testing

function qrSheet() {
  const u = state.session.user || {};
  const tag = u.tag || '';
  openSheet(`<h3>My StatVibe code</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Share this code (or QR) so a partner or client can reach you in Agent → New message. Nobody can find you unless you share it.</div>
    <div style="text-align:center;background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px">
      ${qrPlaceholder('statvibe:' + (tag || 'guest'), 168)}
      <div style="font-family:var(--mono);font-size:22px;font-weight:600;margin-top:14px;letter-spacing:2px;color:#14171C">${esc(tag || '—')}</div>
      <div style="font-size:11px;color:#8A9099;margin-top:3px">Your StatVibe code${u.email ? ' · ' + esc(u.email) : ''}</div>
    </div>
    <button class="btn" data-act="copyTag" data-tag="${esc(tag)}" style="margin-top:12px">Copy my code</button>
    <button class="btn outline" data-close style="margin-top:8px">Done</button>`);
}
async function paymentSheet() {
  const u = state.session.user || {};
  const priceMap = { Free: 0, Pro: 29, Business: 79 };
  const amount = priceMap[state.plan] || 79;
  openSheet(`<h3>Payment method</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Pay via GCash, Maya or bank through <b>PayMongo</b> (QRPh). Scan the QR to pay for your subscription.</div>
    <div id="payBox" style="text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px">
      <div class="typing" style="color:var(--muted)"><i></i><i></i><i></i></div>
      <div style="font-size:12px;color:var(--muted-2);margin-top:10px">Requesting PayMongo QR…</div>
    </div>
    <button class="btn" data-close style="margin-top:14px">Done</button>`);
  const { status, data } = await api('/pay/qr', { method: 'POST', body: { amount } });
  const box = document.getElementById('payBox'); if (!box) return;
  if (status === 200 && data.configured && data.source) {
    box.innerHTML = `${qrPlaceholder('paymongo:' + (data.source.data && data.source.data.id || u.tag), 168)}<div style="font-size:12px;color:var(--muted);margin-top:12px">PayMongo QRPh · ₱${amount}</div><div style="font-size:11px;color:var(--teal);font-weight:600;margin-top:4px">Live payment source created</div>`;
  } else {
    box.innerHTML = `${qrPlaceholder('paymongo:demo:' + (u.tag || 'guest') + ':' + state.plan, 168)}<div style="font-size:12px;color:var(--muted);margin-top:12px">PayMongo QRPh · ₱${amount}</div><div style="font-size:11px;color:var(--amber);font-weight:600;margin-top:4px">${esc((data && data.message) || 'Test mode — add PayMongo keys on the server to accept live payments')}</div>`;
  }
}
function editBusinessSheet() {
  const acct = state.session.account || {};
  openSheet(`<h3>Business name</h3><div class="field" style="margin-top:12px"><input id="bnName" value="${esc(acct.businessName || '')}"/></div><button class="btn" id="bnSave">Save</button>`);
  setTimeout(() => { const b = document.getElementById('bnSave'); if (b) b.onclick = async () => {
    const name = (document.getElementById('bnName') || {}).value;
    const { status, data } = await api('/account', { method: 'PATCH', body: { businessName: name } });
    if (status === 200) { state.session.account = data.account; closeSheet(); render(); toast('Saved'); } else toast(data.error || 'Could not save');
  }; }, 30);
}
function currencySheet() {
  const cur = (state.session.account && state.session.account.currency) || 'USD';
  openSheet(`<h3>Currency</h3><div class="list" style="margin-top:12px;max-height:60vh;overflow:auto">
    ${(state.session.currencies || []).map((c) => `<button class="row" data-cur="${c.code}"><span>${esc(c.symbol)} · ${esc(c.name)}</span><span class="val">${c.code}${c.code === cur ? ' ✓' : ''}</span></button>`).join('')}
  </div>`);
  setTimeout(() => { document.getElementById('sheet').querySelectorAll('[data-cur]').forEach((b) => b.onclick = async () => {
    const { status, data } = await api('/account', { method: 'PATCH', body: { currency: b.dataset.cur } });
    if (status === 200) { state.session.account = data.account; closeSheet(); render(); toast('Currency set to ' + b.dataset.cur); }
  }); }, 30);
}

/* ---- Plans ---- */
async function doUpgrade(name) {
  if (name === 'Enterprise') { toast('Enterprise — our team will reach out'); return; }
  const { status, data } = await api('/account/upgrade', { method: 'POST', body: { plan: name } });
  if (status === 200) {
    state.session.account = data.account;
    state.plan = name;
    if (data.usageLimit) state.usage.limit = data.usageLimit;
    render(); toast(`Upgraded to ${name} ✓`);
  } else toast(data.error || 'Upgrade failed');
}

/* ----------------------------------------------------------------------- */
/* Boot                                                                     */
/* ----------------------------------------------------------------------- */
function applyMobileEnv() {
  const root = document.documentElement;
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) root.classList.add('ios');
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (standalone) root.classList.add('standalone');
  // Do NOT bind height to visualViewport — that shrinks when the iOS keyboard
  // opens and leaves the white gap under the tab bar. Shell stays full-screen;
  // only the scroll regions move.
}
// Optional deep link: #stats|calc|hub|ai|agent|plans|settings|alerts|revenue
function applyHash() {
  const h = (location.hash || '').replace('#', '');
  if (h === 'admin') { location.href = '/admin'; return; } // developer console is a separate app
  // Other deep links require a real, set-up session.
  if (!state.authed || !(state.session.account && state.session.account.setupComplete)) return;
  const tabs = ['stats', 'calc', 'hub', 'ai', 'agent'];
  const subs = ['plans', 'settings', 'profile', 'security', 'alerts', 'revenue', 'aiOutput'];
  if (tabs.includes(h)) go(h);
  else if (subs.includes(h)) { state.stack = [{ screen: h, params: {} }]; render(); }
}

async function boot() {
  try { const th = localStorage.getItem(STORAGE.THEME); if (th) state.settings.appearance = th; } catch { /* ignore */ }
  applyTheme();
  loadStatsDraft();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.settings.appearance === 'System') applyTheme(); });
  try {
    const m = await (await fetch('/api/meta')).json();
    state.session.currencies = m.currencies || [];
    state.session.cloudinary = m.cloudinary || null;
  } catch { /* offline */ }
  await loadModels();
  state.auth.remember = true;
  let tok = null;
  try { tok = localStorage.getItem(STORAGE.LOCAL_TOKEN) || sessionStorage.getItem(STORAGE.SESSION_TOKEN); } catch { /* ignore */ }
  if (tok) {
    state.session.token = tok;
    const { status, data } = await api('/auth/me');
    if (status === 200) {
      // Re-persist real accounts so they survive across visits.
      applySession(data, { remember: !(data.user && data.user.isGuest) });
      if (state.session.account && state.session.account.setupComplete) { await Promise.all([loadIdeas(), loadHistory(), loadConversations()]); }
    } else { clearTokenStorage(); state.session.token = null; }
  }
  state.session.loaded = true;
  render();
  if (location.hash) applyHash();
}

applyMobileEnv();
boot();
window.addEventListener('hashchange', applyHash);

// Light polling so new messages/conversations appear without a refresh.
setInterval(() => {
  if (!state.authed || !(state.session.account && state.session.account.setupComplete)) return;
  const scr = currentScreen();
  if (scr === 'chat') refreshChat();
  else if (scr === 'agent') loadConversations().then(() => { if (currentScreen() === 'agent') render(); });
}, 5000);

// Register the service worker so StatVibe is installable on iOS/Android.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ }); });
}

// Capture the install prompt (Android/desktop) for the Download sheet.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
