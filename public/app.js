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
  session: { token: null, user: null, account: null, inventory: [], ideas: [], history: [], agentAutoReply: false, currencies: [], loaded: false },
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
  aiPrefill: '',
  lastAIOutput: null,
  alerts: null,          // set on first render
  settings: { blend: true, appearance: 'System', notifications: true },
  profile: { name: 'Jordan Doyle', email: 'jordan@illuminarypeak.co', role: 'Owner', phone: '+1 (555) 018-2245', tz: 'Pacific Time · PT' },
  workspace: 'Illuminary Peak',
  admin: { authed: false, token: null, summary: null, busy: false, testOut: null, user: 'GenAdmin' },
  agent: {
    thread: [
      { who: 'them', text: 'Hi — can you confirm the wholesale price on the Trailhead Jacket for a 500-unit order? Need it for a PO today.', time: '9:14 AM' },
    ],
    draft: null,
    unread: 1,
  },
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
const bizName = () => (state.session.account && state.session.account.businessName) || 'My Business';
const userName = () => (state.session.user && state.session.user.name) || 'Guest';
const initials = (name) => (name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '·';

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

function applySession(data) {
  if (data.token) { state.session.token = data.token; try { localStorage.setItem('sv_token', data.token); } catch { /* ignore */ } }
  if (data.user) {
    state.session.user = data.user;
    state.profile.name = data.user.name || state.profile.name;
    state.profile.email = data.user.email || 'Guest session';
    state.profile.role = data.user.isGuest ? 'Guest' : 'Owner';
  }
  if (data.account) state.session.account = data.account;
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
  try { localStorage.setItem('sv_theme', a); } catch { /* ignore */ }
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
  b.classList.add('show');
  requestAnimationFrame(() => s.classList.add('show'));
}
function closeSheet() {
  document.getElementById('sheet').classList.remove('show');
  document.getElementById('sheetBackdrop').classList.remove('show');
}
document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);

/* ----------------------------------------------------------------------- */
/* Router                                                                   */
/* ----------------------------------------------------------------------- */
function go(tab) { if (tab === 'agent' && state.agent) state.agent.unread = 0; state.tab = tab; state.stack = []; render(); }
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
  const unread = (state.agent && state.agent.unread) || 0;
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
      <img src="./logo.svg" alt="StatVibe" style="width:34px;height:34px;border-radius:9px" />
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
      <button class="btn" data-act="toRegister">Create free account</button>
      <button class="btn outline" data-act="guest">Try as guest — no sign up</button>
      <button class="btn ghost" data-act="toLogin" style="padding:6px">I already have an account</button>
    </div>
    <div style="text-align:center;margin-top:14px"><span data-act="download" style="font-size:12.5px;color:var(--teal);font-weight:600;cursor:pointer">📲 Download / install the app</span></div>
    <div style="text-align:center;font-size:10.5px;color:var(--muted-3);line-height:1.6;margin-top:20px">A new, upcoming project of<br><b style="color:var(--muted);font-weight:600">Illuminary Peak Company</b> · 2026</div>
  </div>`;

screens.register = () => `
  ${appbar('Create account')}
  <div class="scroll" style="padding:14px 22px 24px">
    <div style="font-size:24px;font-weight:700;letter-spacing:-.4px;margin-bottom:6px">Start your workspace</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:22px">Free during beta. Your account starts blank — you'll set up your business next.</div>
    <div class="field"><label>Full name</label><input id="regName" type="text" placeholder="Sam Rivera" autocomplete="name" /></div>
    <div class="field"><label>Work email</label><input id="regEmail" type="email" placeholder="you@business.com" autocomplete="email" /></div>
    <div class="field"><label>Password <span style="color:var(--muted-3);font-weight:400">· min 8 characters</span></label><input id="regPwd" type="password" placeholder="••••••••" autocomplete="new-password" /></div>
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
    <div class="field"><label>Password</label><input id="loginPwd" type="password" placeholder="••••••••" autocomplete="current-password" /></div>
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
      <img src="./logo.svg" alt="StatVibe" style="width:30px;height:30px;border-radius:8px" />
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

    <div class="card mb-12" style="padding:16px 16px 6px;cursor:pointer" data-act="goto" data-s="revenue">
      <div class="row-between mb-8">
        <div class="eyebrow">Revenue · MTD</div>
        <div style="font-size:11px;color:var(--muted-2)" class="flex gap-10"><span style="color:var(--teal);font-weight:600">● Actual</span><span>◌ Forecast</span></div>
      </div>
      <div class="flex items-center" style="gap:10px;align-items:baseline;margin-bottom:2px">
        <div class="big-num" style="font-size:34px">$1.84M</div>
        <div class="delta up"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 16l6-6 4 4 6-8" stroke="#0E7C66" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>12.4%</div>
      </div>
      <div style="font-size:11.5px;color:var(--muted-2);margin-bottom:6px">vs $1.64M last month · Plan $1.79M</div>
      <svg viewBox="0 0 322 100" width="100%" height="98" preserveAspectRatio="none">
        <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E7C66" stop-opacity=".18"/><stop offset="1" stop-color="#0E7C66" stop-opacity="0"/></linearGradient></defs>
        <path d="M0,72 L26,68 L52,74 L78,56 L104,60 L130,46 L156,52 L182,36 L208,42 L234,30 L250,26 L250,100 L0,100 Z" fill="url(#ga)"/>
        <path d="M0,72 L26,68 L52,74 L78,56 L104,60 L130,46 L156,52 L182,36 L208,42 L234,30 L250,26" fill="none" stroke="#0E7C66" stroke-width="2"/>
        <path d="M250,26 L286,17 L322,9" fill="none" stroke="#0E7C66" stroke-width="2" stroke-dasharray="2 4" stroke-opacity=".55"/>
        <circle cx="250" cy="26" r="3" fill="#0E7C66"/>
      </svg>
    </div>

    <div class="grid-3 mb-12">
      ${[['Gross margin', '61.2%', '+2.1 pt', 'up'], ['Customers', '4,207', '+318', 'up'], ['Runway', '14.2<span style="font-size:11px;color:var(--muted-2)">mo</span>', '−0.4', 'down']]
        .map(([k, v, d, dir]) => `<div class="card" style="padding:11px"><div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:6px">${k}</div><div class="big-num" style="font-size:18px">${v}</div><div style="font-size:10.5px;font-weight:600;margin-top:2px;color:var(--${dir === 'up' ? 'teal' : 'red'})">${d}</div></div>`).join('')}
    </div>

    <div class="card dark mb-12" style="padding:14px 15px">
      <div class="flex items-center" style="gap:7px;margin-bottom:8px">
        ${I.spark('#7FE3C8', 15, true)}
        <span style="font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mint)">Predictive insight</span>
        <span class="mono" style="margin-left:auto;font-size:10.5px;color:var(--mint)">92% conf.</span>
      </div>
      <div style="font-size:13.5px;line-height:1.5;color:#D8E4E0">On track to close the month at <b style="color:#fff">$2.41M</b> (+6.8% over plan). Trim Channel B ad spend ~9% to hold gross margin above 60%.</div>
      <div class="insight-actions">
        <button class="btn sm mint" data-act="applyPlan">Apply to plan</button>
        <button class="btn sm" data-act="askAI" data-q="Explain the Channel B ad-spend recommendation and quantify the margin impact." style="flex:1;background:rgba(255,255,255,.08);color:#EAF0EE">Ask AI</button>
      </div>
    </div>

    <div class="card">
      <div class="row-between mb-12"><div style="font-size:13px;font-weight:600">Revenue by channel</div><div style="font-size:11px;color:var(--muted-2)">30 days</div></div>
      <div class="stack gap-11">
        ${[['Direct', 42, '#0E7C66'], ['Marketplace', 28, '#3AA88C'], ['Wholesale', 19, '#8FCBBB'], ['Referral', 11, '#C3E0D6']]
          .map(([n, p, c]) => `<div><div class="row-between" style="font-size:12px;margin-bottom:4px"><span>${n}</span><span class="mono" style="color:var(--muted)">${p}%</span></div><div class="meter"><i style="width:${p}%;background:${c}"></i></div></div>`).join('')}
      </div>
    </div>
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
        .map(([lab, key]) => `<div class="row-between" style="padding:9px 0;border-bottom:1px solid var(--hairline)"><span style="font-size:13px">${lab}</span><span class="flex items-center" style="gap:2px"><span class="mono" style="font-size:14px">$</span><input class="mono calc-input" data-k="${key}" value="${c[key].toFixed(2)}" inputmode="decimal" style="width:64px;border:none;background:none;text-align:right;font-size:14px;font-weight:500;outline:none;color:var(--ink);border-bottom:1px dashed var(--line-2)"/></span></div>`).join('')}
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
/* Tab screen: AgentTech Assistant                                          */
/* ----------------------------------------------------------------------- */
tabScreens.agent = () => {
  const bubbles = state.agent.thread.map((msg) => {
    if (msg.who === 'them') return `<div class="bubble them">${esc(msg.text)}</div>`;
    if (msg.who === 'me') return `<div class="bubble me">${esc(msg.text)}</div>`;
    if (msg.who === 'ai') return `<div class="bubble ai"><div class="ai-tag">${I.spark('#7FE3C8', 13, true)}AgentTech drafted</div><div style="font-size:13px;line-height:1.5;color:#F2ECE2">${esc(msg.text)}</div></div>`;
    return '';
  }).join('');
  const draftControls = state.agent.draft
    ? `<div class="approve-row"><button class="pill" data-act="approveSend" style="color:var(--teal);background:var(--teal-tint);border-color:#CDE6DD">Approve &amp; send</button><button class="pill" data-act="editDraft">Edit</button></div>`
    : '';
  const auto = state.session.agentAutoReply;
  const empty = state.agent.thread.length === 0;
  return `
  <div class="flex items-center" style="gap:11px;padding:54px 16px 12px;background:var(--surface);border-bottom:1px solid var(--line)">
    <div style="width:38px;height:38px;border-radius:11px;background:var(--slate-blue-tint);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--slate-blue)">MR</div>
    <div style="flex:1"><div style="font-size:14.5px;font-weight:600">Meridian Retail</div><div class="flex items-center" style="font-size:11px;color:var(--teal);gap:5px"><span style="width:6px;height:6px;border-radius:50%;background:${auto ? '#0E7C66' : '#B26B00'};display:inline-block"></span>AgentTech · ${auto ? 'auto-reply on' : 'approval mode'}</div></div>
    <button class="iconbtn plain" data-act="agentSettings" title="AgentTech settings"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#5C6169" stroke-width="1.7"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z" stroke="#5C6169" stroke-width="1.4"/></svg></button>
  </div>
  <div class="chat-scroll" id="chatScroll">
    ${empty ? `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px;color:var(--muted-2)"><div style="font-size:34px;margin-bottom:10px">💬</div><div style="font-size:15px;font-weight:600;color:var(--ink)">No messages yet</div><div style="font-size:12.5px;line-height:1.5;margin-top:4px">When a client or partner messages you, it'll appear here. Share your StatVibe QR (Settings → Privacy) so people can reach you.</div></div>`
      : `<div class="chat-time">Today · 9:14 AM</div>${bubbles}${draftControls}`}
  </div>
  <div class="composer">
    <div class="inputwrap">
      <input id="agentInput" placeholder="Message or let AI reply…" />
      <button class="pill" data-act="agentDraft" style="padding:6px 11px;background:var(--surface)">${I.spark('#0E7C66', 12, true)} AI</button>
      <button class="send" data-act="agentSend">${I.send}</button>
    </div>
  </div>
  ${tabbar('agent')}`;
};

/* ----------------------------------------------------------------------- */
/* Sub-screens                                                              */
/* ----------------------------------------------------------------------- */
screens.revenue = () => `
  ${appbar('Revenue', { right: `<button class="iconbtn" data-act="exportRevenue">${I.download}</button>` })}
  <div class="scroll" style="padding:8px 18px 20px">
    <div class="flex items-center" style="gap:10px;align-items:baseline;margin-bottom:4px"><div class="big-num" style="font-size:32px">$1.84M</div><div class="delta up">+12.4%</div></div>
    <div style="font-size:11.5px;color:var(--muted-2);margin-bottom:14px">Month to date · vs $1.64M prior</div>
    <div class="segmented mb-16" data-seg="period">
      ${['Week', 'Month', 'Quarter', 'Year'].map((p) => `<button class="${state.period === p ? 'active' : ''}" data-v="${p}">${p}</button>`).join('')}
    </div>
    <div class="card mb-14" style="padding:16px 15px 12px">
      <div class="bars">
        ${[['Apr', 52], ['May', 64], ['Jun', 58], ['Jul', 80], ['Aug', 96, 'on'], ['Sep*', 112, 'forecast']]
          .map(([m, h, cls]) => `<div class="b ${cls || ''}"><i style="height:${h}px"></i><span>${m}</span></div>`).join('')}
      </div>
      <div style="font-size:10.5px;color:var(--muted-2);margin-top:8px;text-align:right">* AI forecast</div>
    </div>
    <div class="eyebrow mb-10">Top products</div>
    <div class="list">
      ${[['Trailhead Jacket', '1,412 units', '$384K', '+18%', 'up'], ['Summit Pack 40L', '906 units', '$271K', '+9%', 'up'], ['Trail Runner GTX', '1,088 units', '$228K', '−3%', 'down']]
        .map(([n, u, r, d, dir]) => `<div class="row" style="cursor:default"><div><div style="font-size:13px;font-weight:500">${n}</div><div style="font-size:11px;color:var(--muted-2)">${u}</div></div><div style="text-align:right"><div class="mono" style="font-size:13px;font-weight:500">${r}</div><div style="font-size:11px;font-weight:600;color:var(--${dir === 'up' ? 'teal' : 'red'})">${d}</div></div></div>`).join('')}
    </div>
  </div>`;

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

      // agent
      case 'agentDraft': agentDraft(); break;
      case 'agentSend': agentSend(); break;
      case 'approveSend': approveSend(); break;
      case 'editDraft': { const draft = state.agent.draft; if (draft) { state.agent.thread = state.agent.thread.filter((m) => m.who !== 'ai'); state.agent.draft = null; render(); const inp = $('#agentInput'); if (inp) { inp.value = draft; inp.focus(); } } break; }
      case 'call': toast('Calling Meridian Retail…'); break;
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

/* ---- Agent actions ---- */
function scrollChat() { const s = document.getElementById('chatScroll'); if (s) s.scrollTop = s.scrollHeight; }

async function agentDraft() {
  // Draft only once: if a suggestion already exists (or one is generating),
  // it's up to the user to Edit/rephrase or Approve it — don't stack drafts.
  if (state.agent.drafting) return;
  if (state.agent.draft) { toast('You already have a draft — Edit or Approve it'); return; }

  state.agent.drafting = true;
  const scroll = document.getElementById('chatScroll');
  if (scroll) {
    const el = document.createElement('div');
    el.className = 'bubble ai';
    el.innerHTML = `<div class="ai-tag">${I.spark('#7FE3C8', 13, true)}AgentTech drafting</div><div class="typing" style="color:#7FE3C8"><i></i><i></i><i></i></div>`;
    scroll.appendChild(el); scrollChat();
  }
  const lastThem = [...state.agent.thread].reverse().find((m) => m.who === 'them');
  const prompt = `A wholesale client (Meridian Retail) wrote: "${lastThem ? lastThem.text : 'Can you confirm the wholesale price?'}". Draft a short, friendly, professional reply confirming pricing. Our wholesale price for the Trailhead Jacket is $58.80/unit for 500 units (40% off retail), which holds a 32% margin for the client. Offer to generate the quote and PO. Keep it under 60 words.`;
  try {
    const d = await callAI(prompt, 'You are AgentTech, a professional AI messaging assistant that drafts client replies for a business. Be warm, concise and specific.');
    const text = d.content.trim();
    if (state.session.agentAutoReply) {
      // Auto-reply mode: send immediately without approval.
      state.agent.thread.push({ who: 'me', text });
      state.agent.drafting = false; render(); scrollChat(); toast('AgentTech auto-replied ✓');
      setTimeout(() => { state.agent.thread.push({ who: 'them', text: 'Perfect, thank you! 🙌' }); render(); scrollChat(); }, 1500);
      return;
    }
    state.agent.draft = text;
    state.agent.thread.push({ who: 'ai', text });
  } catch (e) {
    toast('Could not draft reply');
  } finally {
    state.agent.drafting = false;
    render(); scrollChat();
  }
}

function agentSettingsSheet() {
  const auto = state.session.agentAutoReply;
  openSheet(`<h3>AgentTech settings</h3>
    <div class="list" style="margin-top:12px">
      <div class="row" style="cursor:default"><div><div style="font-size:13.5px">Auto-reply</div><div style="font-size:11.5px;color:var(--muted-2)">AI sends replies automatically</div></div><button class="toggle ${auto ? 'on' : ''}" data-a-auto></button></div>
      <div class="row" style="cursor:default"><div><div style="font-size:13.5px">Approval mode</div><div style="font-size:11.5px;color:var(--muted-2)">You review each AI draft before it sends</div></div><span class="tagchip ${auto ? 'grey' : 'green'}">${auto ? 'off' : 'on'}</span></div>
    </div>
    <div style="font-size:11px;color:var(--muted-3);margin-top:12px;line-height:1.5">In approval mode, the AI drafts a reply and waits for you to Approve or Edit. Turn on auto-reply to let AgentTech respond in real time.</div>
    <button class="btn" data-close style="margin-top:14px">Done</button>`);
  setTimeout(() => { const b = document.querySelector('#sheet [data-a-auto]'); if (b) b.onclick = () => { state.session.agentAutoReply = !state.session.agentAutoReply; render(); agentSettingsSheet(); toast('Auto-reply ' + (state.session.agentAutoReply ? 'on' : 'off')); }; }, 30);
}

function agentSend() {
  const inp = $('#agentInput');
  const txt = inp && inp.value.trim();
  if (!txt) return;                         // send is for typed messages only — no auto-suggest
  // The user chose to write their own reply, so drop any pending AI draft.
  state.agent.thread = state.agent.thread.filter((m) => m.who !== 'ai');
  state.agent.draft = null;
  state.agent.thread.push({ who: 'me', text: txt });
  render(); scrollChat();
  // simulate a client reply
  setTimeout(() => { state.agent.thread.push({ who: 'them', text: 'Great, thanks! 🙌' }); render(); scrollChat(); }, 1400);
}

function approveSend() {
  if (!state.agent.draft) return;
  const draft = state.agent.draft;
  // convert the last AI bubble into a sent message
  state.agent.thread = state.agent.thread.filter((m) => m.who !== 'ai');
  state.agent.thread.push({ who: 'me', text: draft });
  state.agent.draft = null;
  render(); scrollChat(); toast('Sent to Meridian Retail ✓');
  setTimeout(() => { state.agent.thread.push({ who: 'them', text: 'Perfect, send the PO 🙌' }); render(); scrollChat(); }, 1600);
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
  if (status === 201 || status === 200) { applySession(data); state.stack = []; render(); toast('Exploring as guest'); }
  else toast(data.error || 'Could not start guest session');
}
async function doRegister() {
  const name = ($('#regName') || {}).value, email = ($('#regEmail') || {}).value, password = ($('#regPwd') || {}).value;
  const terms = ($('#regTerms') || {}).checked;
  if (!terms) { toast('Please accept the Terms & Privacy Policy'); return; }
  const { status, data } = await api('/auth/register', { method: 'POST', auth: false, body: { name: (name || '').trim(), email: (email || '').trim(), password, acceptedTerms: !!terms } });
  if (status === 201) { applySession(data); state.stack = []; render(); toast('Account created — set up your business'); }
  else toast(data.error || 'Registration failed');
}
async function doLogin() {
  const email = (($('#loginEmail') || {}).value || '').trim(), password = ($('#loginPwd') || {}).value;
  const { status, data } = await api('/auth/login', { method: 'POST', auth: false, body: { email, password } });
  if (status === 200) { applySession(data); state.stack = []; state.tab = 'stats'; render(); toast('Welcome back'); }
  else toast(data.error || 'Sign in failed');
}
async function doLogout() {
  await api('/auth/logout', { method: 'POST' });
  try { localStorage.removeItem('sv_token'); } catch { /* ignore */ }
  const curr = state.session.currencies;
  state.session = { token: null, user: null, account: null, inventory: [], currencies: curr, loaded: true };
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
    <div class="field" style="margin-top:12px"><label>Current password</label><input id="cpCur" type="password" autocomplete="current-password"/></div>
    <div class="field"><label>New password · min 8 characters</label><input id="cpNew" type="password" autocomplete="new-password"/></div>
    <button class="btn" id="cpSave">Update password</button>`);
  setTimeout(() => { const b = document.getElementById('cpSave'); if (b) b.onclick = async () => {
    const currentPassword = (document.getElementById('cpCur') || {}).value, newPassword = (document.getElementById('cpNew') || {}).value;
    const { status, data } = await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    if (status === 200) { if (data.token) { state.session.token = data.token; try { localStorage.setItem('sv_token', data.token); } catch { /* ignore */ } } closeSheet(); toast('Password updated'); }
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
      if (status === 200) { try { localStorage.removeItem('sv_token'); } catch { /* ignore */ } const cur = state.session.currencies; state.session = { token: null, user: null, account: null, inventory: [], currencies: cur, loaded: true }; state.authed = false; state.stack = []; render(); toast('Account deleted'); }
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
function qrSheet() {
  const u = state.session.user || {};
  openSheet(`<h3>My StatVibe QR</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Share this so a partner or client can add you in Agent. Others can't find you unless you share it.</div>
    <div style="text-align:center;background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px">
      ${qrPlaceholder('statvibe:user:' + (u.tag || 'guest'), 168)}
      <div style="font-family:var(--mono);font-size:16px;font-weight:600;margin-top:12px;letter-spacing:1px">${esc(u.tag || '—')}</div>
      <div style="font-size:11px;color:var(--muted-2);margin-top:2px">Your StatVibe tag${u.email ? ' · ' + esc(u.email) : ''}</div>
    </div>
    <button class="btn" data-close style="margin-top:14px">Done</button>`);
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
function doUpgrade(name) {
  if (name === 'Enterprise') { toast('Enterprise — our team will reach out'); return; }
  state.plan = name;
  const map = { Free: 1000, Pro: 10000, Business: 50000 };
  state.usage.limit = map[name] || state.usage.limit;
  render(); toast(`Upgraded to ${name} ✓`);
}

/* ----------------------------------------------------------------------- */
/* Boot                                                                     */
/* ----------------------------------------------------------------------- */
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
  try { const th = localStorage.getItem('sv_theme'); if (th) state.settings.appearance = th; } catch { /* ignore */ }
  applyTheme();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.settings.appearance === 'System') applyTheme(); });
  try { const m = await (await fetch('/api/meta')).json(); state.session.currencies = m.currencies || []; } catch { /* offline */ }
  await loadModels();
  let tok = null; try { tok = localStorage.getItem('sv_token'); } catch { /* ignore */ }
  if (tok) {
    state.session.token = tok;
    const { status, data } = await api('/auth/me');
    if (status === 200) { applySession(data); if (state.session.account && state.session.account.setupComplete) { await Promise.all([loadIdeas(), loadHistory()]); } }
    else { try { localStorage.removeItem('sv_token'); } catch { /* ignore */ } state.session.token = null; }
  }
  state.session.loaded = true;
  render();
  if (location.hash) applyHash();
}

boot();
window.addEventListener('hashchange', applyHash);

// Register the service worker so StatVibe is installable on iOS/Android.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ }); });
}

// Capture the install prompt (Android/desktop) for the Download sheet.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
