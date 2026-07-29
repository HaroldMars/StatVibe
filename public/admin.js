/* ==========================================================================
   StatVibe — Developer Console (separate app, served at /admin)
   Ops dashboard: user stats, plan upgrades/transactions, AI metrics.
   Privacy: no passwords, chat messages, AI prompts, or phone numbers.
   ========================================================================== */
'use strict';

const S = { token: null, admin: null, summary: null, admins: null, users: null, payments: null, testOut: null, busy: false };
const $ = (s, r = document) => r.querySelector(s);
const el = () => document.getElementById('adm');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); }
function applyTheme() { document.documentElement.setAttribute('data-theme', window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }

async function apiAdmin(sub, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (S.token) headers['x-admin-token'] = S.token;
  let r; try { r = await fetch('/api/admin/' + sub, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { return { status: 0, data: { error: 'Network error' } }; }
  let data = {}; try { data = await r.json(); } catch { /* ignore */ }
  return { status: r.status, data };
}

/* ---------------- Login ---------------- */
function loginView() {
  return `
  <div class="adm-login">
    <div class="adm-brand" style="justify-content:center;margin-bottom:20px">
      <div class="adm-logo">&gt;_</div>
      <div><h1>Developer Console</h1><div class="sub">StatVibe · restricted access</div></div>
    </div>
    <div class="adm-card">
      <div class="field"><label>Username</label><input id="admU" autocomplete="username" placeholder="founder username" /></div>
      <div class="field"><label>Password</label><input id="admP" type="password" autocomplete="current-password" placeholder="••••••••" /></div>
      <button class="btn" data-a="login" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Signing in…' : 'Sign in'}</button>
      <div style="font-size:11px;color:var(--muted-3);margin-top:14px;line-height:1.5">Developer accounts are managed on the server. The first account (founder) is seeded from <code>ADMIN_USER</code> / <code>ADMIN_PASSWORD</code>.</div>
    </div>
    <div style="text-align:center;font-size:11px;color:var(--muted-3);margin-top:18px"><a href="/" style="color:var(--muted-2)">← Back to StatVibe app</a></div>
  </div>`;
}

function barChart(items, { labelKey = 'label', valueKey = 'value', color = 'var(--teal)' } = {}) {
  const vals = items.map((i) => Number(i[valueKey]) || 0);
  const max = Math.max(1, ...vals);
  return `<div class="adm-bars">${items.map((i) => {
    const v = Number(i[valueKey]) || 0;
    const h = Math.max(4, Math.round((v / max) * 72));
    return `<div class="adm-bar"><i style="height:${h}px;background:${color}"></i><span>${esc(i[labelKey])}</span><b>${v}</b></div>`;
  }).join('')}</div>`;
}

function sparkline(signups) {
  const max = Math.max(1, ...signups.map((d) => d.count));
  return `<div class="adm-spark">${signups.map((d) => {
    const h = Math.max(2, Math.round((d.count / max) * 48));
    const day = new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<div class="adm-spark-col" title="${esc(day)}: ${d.count}"><i style="height:${h}px"></i></div>`;
  }).join('')}</div>
  <div class="adm-spark-labels"><span>${esc(new Date(signups[0].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</span><span>Last 14 days</span><span>${esc(new Date(signups[signups.length - 1].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</span></div>`;
}

/* ---------------- Console ---------------- */
function consoleView() {
  const s = S.summary || {}, cfg = s.config || { cloudAvailable: {} }, m = s.metrics || {};
  const cloud = [['claude', 'Claude'], ['gpt-4o', 'GPT-4o'], ['gemini', 'Gemini'], ['grok', 'Grok']];
  const kv = (k, v) => `<div class="adm-kv"><span>${k}</span><span class="v">${esc(v)}</span></div>`;
  const toggle = (on, a, extra = '') => `<button class="toggle ${on ? 'on' : ''}" data-a="${a}" ${extra}></button>`;
  const byModel = Object.entries(m.byModel || {}).map(([k, v]) => `${esc(k)}: ${v}`).join(' · ') || 'none yet';
  const tk = m.tokens || { total: 0, byModel: {} };
  const users = s.users || { total: 0, registered: 0, guests: 0, setupComplete: 0, active_24h: 0, active_7d: 0, byPlan: {}, signups: [] };
  const pay = s.payments || { total: 0, paid: 0, revenue: 0, byPlan: {} };
  const planBars = Object.entries(users.byPlan || {}).filter(([, n]) => n > 0).map(([label, value]) => ({ label, value }));
  const payBars = Object.entries(pay.byPlan || {}).map(([label, value]) => ({ label, value }));
  const signups = users.signups || [];

  return `
  <div class="adm-top">
    <div class="adm-brand">
      <div class="adm-logo">&gt;_</div>
      <div><h1>Developer Console</h1><div class="sub">Signed in as <b>${esc(S.admin.displayName || S.admin.username)}</b> · ${esc(S.admin.role)}</div></div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="pill" data-a="refresh">↻ Refresh</button>
      <button class="pill" data-a="logout" style="color:var(--red)">Sign out</button>
    </div>
  </div>

  <div class="adm-card" style="background:var(--teal-tint);border-color:var(--teal-tint-border)">
    <p class="adm-eyebrow" style="color:var(--teal-deep)">Privacy boundary</p>
    <div style="font-size:12.5px;color:var(--ink-2);line-height:1.5">${esc((s.privacy && s.privacy.note) || 'Admin sees directory + ops metrics only. Passwords, chats, AI prompts, and phone numbers stay private.')}</div>
  </div>

  <div class="adm-stat-grid">
    <div class="adm-stat"><div class="n">${users.total || 0}</div><div class="l">Total users</div></div>
    <div class="adm-stat"><div class="n">${users.registered || 0}</div><div class="l">Registered</div></div>
    <div class="adm-stat"><div class="n">${users.guests || 0}</div><div class="l">Guests</div></div>
    <div class="adm-stat"><div class="n">${users.setupComplete || 0}</div><div class="l">Setup done</div></div>
    <div class="adm-stat"><div class="n">${users.active_24h || 0}</div><div class="l">Active 24h</div></div>
    <div class="adm-stat"><div class="n">${users.active_7d || 0}</div><div class="l">Active 7d</div></div>
    <div class="adm-stat"><div class="n">${pay.paid || 0}</div><div class="l">Upgrades / txs</div></div>
    <div class="adm-stat"><div class="n">${money(pay.revenue)}</div><div class="l">Upgrade volume</div></div>
  </div>

  <div class="adm-grid">
    <div class="adm-card">
      <p class="adm-eyebrow">Users by plan</p>
      ${planBars.length ? barChart(planBars) : '<div style="font-size:12px;color:var(--muted-2)">No plan data yet.</div>'}
    </div>
    <div class="adm-card">
      <p class="adm-eyebrow">Signups · 14 days</p>
      ${signups.length ? sparkline(signups) : '<div style="font-size:12px;color:var(--muted-2)">No signup history yet.</div>'}
    </div>
  </div>

  <div class="adm-grid">
    <div class="adm-card">
      <p class="adm-eyebrow">System</p>
      ${kv('Status', (s.ollama && s.ollama.online) ? 'healthy' : 'degraded (no Ollama)')}
      ${kv('Version', 'v' + (s.version || '—'))}
      ${kv('Uptime', (s.uptime_s || 0) + 's')}
      ${kv('Node', s.node || '—')}
      ${kv('Memory', (s.memory_mb || 0) + ' MB')}
      ${kv('Ollama', (s.ollama && s.ollama.online) ? 'online' : 'offline')}
      ${kv('Local models', ((s.ollama && s.ollama.models) || []).length)}
    </div>
    <div class="adm-card">
      <p class="adm-eyebrow">Engine flags</p>
      <div class="adm-row"><span>Simulate only <span style="color:var(--muted-3);font-size:11px">force simulated AI</span></span>${toggle(cfg.simulateOnly, 'sim')}</div>
      <div class="adm-row"><span>Blend by default</span>${toggle(cfg.defaultBlend, 'blend')}</div>
      <p class="adm-eyebrow" style="margin-top:16px">Cloud models — flip "available"</p>
      ${cloud.map(([id, label]) => `<div class="adm-row"><span>${label}</span>${toggle(cfg.cloudAvailable && cfg.cloudAvailable[id], 'cloud', 'data-id="' + id + '"')}</div>`).join('')}
    </div>
  </div>

  <div class="adm-card">
    <p class="adm-eyebrow">Metrics</p>
    <div class="adm-grid" style="gap:0 24px">
      <div>${kv('Requests', m.requests || 0)}${kv('AI chats', m.chats || 0)}</div>
      <div>${kv('Simulated', m.simulated || 0)}${kv('AI errors', m.aiErrors || 0)}</div>
    </div>
    <div class="adm-kv"><span>By model (calls)</span><span class="v" style="font-size:11px">${esc(byModel)}</span></div>
  </div>

  <div class="adm-card">
    <p class="adm-eyebrow">AI token consumption</p>
    ${kv('Total tokens', (tk.total || 0).toLocaleString())}
    ${kv('Prompt / Completion', (tk.prompt || 0).toLocaleString() + ' / ' + (tk.completion || 0).toLocaleString())}
    ${Object.keys(tk.byModel || {}).length
      ? Object.entries(tk.byModel).map(([mdl, t]) => `<div class="adm-row"><span>${esc(mdl)}</span><span class="v" style="font-size:12px">${(t.total || 0).toLocaleString()} <span style="color:var(--muted-3)">(${(t.prompt || 0).toLocaleString()}p / ${(t.completion || 0).toLocaleString()}c)</span></span></div>`).join('')
      : '<div style="font-size:12px;color:var(--muted-2);padding:8px 0">No AI usage yet.</div>'}
  </div>

  <div class="adm-card">
    <p class="adm-eyebrow">Accounts directory · ${users.total || 0} total · privacy-safe fields only</p>
    ${(S.users || []).length
      ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="text-align:left;color:var(--muted-2)"><th style="padding:6px 8px 6px 0;font-weight:600">User</th><th style="padding:6px 8px;font-weight:600">Business</th><th style="padding:6px 8px;font-weight:600">Plan</th><th style="padding:6px 8px;font-weight:600">Cur</th><th style="padding:6px 8px;font-weight:600">Items</th><th style="padding:6px 0 6px 8px;font-weight:600">Joined</th></tr></thead>
          <tbody>${S.users.map((u) => `<tr style="border-top:1px solid var(--hairline)"><td style="padding:8px 8px 8px 0"><div style="font-weight:500">${esc(u.name || (u.isGuest ? 'Guest' : '—'))}</div><div style="color:var(--muted-3);font-size:11px">${esc(u.email || u.tag)}${u.isGuest ? ' · guest' : ''}${u.setup ? '' : ' · setup pending'}</div></td><td style="padding:8px">${esc(u.business || '—')}</td><td style="padding:8px"><span class="tagchip green">${esc(u.plan || 'Free')}</span></td><td style="padding:8px">${esc(u.currency || '—')}</td><td style="padding:8px">${u.items}</td><td style="padding:8px 0 8px 8px;color:var(--muted-2)">${new Date(u.createdAt).toLocaleDateString()}</td></tr>`).join('')}</tbody>
        </table></div>`
      : '<div style="font-size:12px;color:var(--muted-2)">No users yet.</div>'}
  </div>

  <div class="adm-card">
    <p class="adm-eyebrow">Transactions & upgrades · ${pay.total || 0} recorded · ${money(pay.revenue)} volume</p>
    ${payBars.length ? `<div style="margin-bottom:14px">${barChart(payBars, { color: 'linear-gradient(180deg, var(--teal), #7a85ff)' })}</div>` : ''}
    ${(S.payments || []).length
      ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="text-align:left;color:var(--muted-2)"><th style="padding:6px 8px 6px 0;font-weight:600">When</th><th style="padding:6px 8px;font-weight:600">User</th><th style="padding:6px 8px;font-weight:600">Plan</th><th style="padding:6px 8px;font-weight:600">Amount</th><th style="padding:6px 0 6px 8px;font-weight:600">Status</th></tr></thead>
          <tbody>${S.payments.map((p) => `<tr style="border-top:1px solid var(--hairline)"><td style="padding:8px 8px 8px 0;color:var(--muted-2)">${new Date(p.createdAt).toLocaleString()}</td><td style="padding:8px"><div style="font-weight:500">${esc(p.name || '—')}</div><div style="color:var(--muted-3);font-size:11px">${esc(p.email || 'guest / anonymized')}</div></td><td style="padding:8px">${esc(p.previousPlan ? p.previousPlan + ' → ' : '')}${esc(p.plan || '—')}</td><td style="padding:8px">${money(p.amount)} ${esc(p.currency || '')}</td><td style="padding:8px 0 8px 8px"><span class="tagchip ${p.status === 'paid' || p.status === 'demo' || p.status === 'free' ? 'green' : 'amber'}">${esc(p.status || '—')}</span></td></tr>`).join('')}</tbody>
        </table></div>`
      : '<div style="font-size:12px;color:var(--muted-2)">No upgrades or payments yet. Plan upgrades from the app appear here.</div>'}
  </div>

  <div class="adm-card">
    <p class="adm-eyebrow">Raw AI test console</p>
    <textarea id="admPrompt" rows="2" style="width:100%;border:1px solid var(--line-2);border-radius:9px;padding:10px;font-size:13px;background:var(--surface);color:var(--ink);resize:none;outline:none">What is our gross margin trend?</textarea>
    <button class="btn sm" data-a="test" style="margin-top:8px;width:auto;padding:9px 16px">Run test call</button>
    ${S.testOut ? `<div class="adm-out"><div style="font-size:10px;color:var(--muted-2);margin-bottom:5px">${S.testOut.simulated ? 'SIMULATED' : 'LIVE'} · ${esc(S.testOut.model)}</div>${esc(S.testOut.content)}</div>` : ''}
  </div>

  ${S.admin.role === 'founder' ? accountsCard() : ''}

  <div class="adm-card">
    <p class="adm-eyebrow">Recent server log</p>
    <div class="adm-log">${(m.recent || []).map((l) => esc(l)).join('\n') || 'No log entries.'}</div>
  </div>

  <div class="adm-grid">
    <button class="btn outline" data-a="resetCfg">Reset server config</button>
    <a class="btn outline" href="/" style="text-align:center;line-height:1.4">Open StatVibe app →</a>
  </div>`;
}

function accountsCard() {
  const list = S.admins || [];
  return `
  <div class="adm-card">
    <p class="adm-eyebrow">Developer accounts (founder only)</p>
    ${list.map((a) => `<div class="adm-row"><span>${esc(a.displayName || a.username)} <span style="color:var(--muted-3);font-size:11px">@${esc(a.username)} · ${esc(a.role)}</span></span>${a.username === S.admin.username ? '<span style="font-size:11px;color:var(--muted-2)">you</span>' : `<button class="pill" data-a="delAdmin" data-u="${esc(a.username)}" style="color:var(--red);padding:4px 10px">Remove</button>`}</div>`).join('') || '<div style="font-size:12px;color:var(--muted-2)">No accounts.</div>'}
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--hairline)">
      <p class="adm-eyebrow">Add developer</p>
      <div class="adm-grid" style="gap:8px">
        <input id="naName" placeholder="Display name" style="padding:11px;border:1px solid var(--line-2);border-radius:9px;background:var(--surface);color:var(--ink)" />
        <input id="naUser" placeholder="username" style="padding:11px;border:1px solid var(--line-2);border-radius:9px;background:var(--surface);color:var(--ink)" />
      </div>
      <input id="naPass" type="password" placeholder="password · min 8" style="width:100%;margin-top:8px;padding:11px;border:1px solid var(--line-2);border-radius:9px;background:var(--surface);color:var(--ink)" />
      <button class="btn sm" data-a="addAdmin" style="margin-top:8px;width:auto;padding:9px 16px">Create developer account</button>
    </div>
  </div>`;
}

function render() { el().innerHTML = S.admin ? consoleView() : loginView(); }

/* ---------------- Actions ---------------- */
async function login() {
  const username = ($('#admU') || {}).value, password = ($('#admP') || {}).value;
  if (!username || !password) { toast('Enter username and password'); return; }
  S.busy = true; render();
  const { status, data } = await apiAdmin('login', { method: 'POST', body: { username, password } });
  S.busy = false;
  if (status === 200) { S.token = data.token; S.admin = data.admin; try { sessionStorage.setItem('sv_admin_session', data.token); } catch { /* ignore */ } await refresh(); toast('Welcome, ' + (data.admin.displayName || data.admin.username)); }
  else { render(); toast(data.error || 'Sign in failed'); }
}
async function refresh() {
  const { status, data } = await apiAdmin('summary');
  if (status === 200) {
    S.summary = data;
    const u = await apiAdmin('users'); if (u.status === 200) S.users = u.data.users;
    const p = await apiAdmin('payments'); if (p.status === 200) S.payments = p.data.payments;
    if (S.admin && S.admin.role === 'founder') { const a = await apiAdmin('accounts'); if (a.status === 200) S.admins = a.data.admins; }
    render();
  } else { logout(); }
}
function logout() { apiAdmin('logout', { method: 'POST' }); try { sessionStorage.removeItem('sv_admin_session'); } catch { /* ignore */ } S.token = null; S.admin = null; S.summary = null; render(); }
async function setCfg(patch) { const { status, data } = await apiAdmin('config', { method: 'POST', body: patch }); if (status === 200) { S.summary = { ...(S.summary || {}), config: data.config }; render(); toast('Updated'); } else toast(data.error || 'Failed'); }
async function runTest() {
  const prompt = ($('#admPrompt') || {}).value.trim(); if (!prompt) { toast('Enter a prompt'); return; }
  S.testOut = { model: 'auto', content: 'Running…', simulated: false }; render();
  try { const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }) }); const d = await r.json(); S.testOut = { model: d.model, content: d.content + (d.note ? '\n\n(' + d.note + ')' : ''), simulated: d.simulated }; }
  catch (e) { S.testOut = { model: 'error', content: e.message, simulated: true }; }
  render();
}
async function addAdmin() {
  const displayName = ($('#naName') || {}).value, username = ($('#naUser') || {}).value, password = ($('#naPass') || {}).value;
  const { status, data } = await apiAdmin('accounts', { method: 'POST', body: { displayName, username, password } });
  if (status === 201) { S.admins = data.admins; render(); toast('Developer account created'); } else toast(data.error || 'Could not create');
}
async function delAdmin(username) {
  const { status, data } = await apiAdmin('accounts/delete', { method: 'POST', body: { username } });
  if (status === 200) { S.admins = data.admins; render(); toast('Removed ' + username); } else toast(data.error || 'Could not remove');
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'login') return login();
  if (a === 'logout') return logout();
  if (a === 'refresh') return refresh();
  if (a === 'sim') return setCfg({ simulateOnly: !((S.summary || {}).config || {}).simulateOnly });
  if (a === 'blend') return setCfg({ defaultBlend: !((S.summary || {}).config || {}).defaultBlend });
  if (a === 'cloud') return setCfg({ cloudAvailable: { [b.dataset.id]: !(((S.summary || {}).config || {}).cloudAvailable || {})[b.dataset.id] } });
  if (a === 'test') return runTest();
  if (a === 'resetCfg') return apiAdmin('reset', { method: 'POST' }).then(() => { refresh(); toast('Config reset'); });
  if (a === 'addAdmin') return addAdmin();
  if (a === 'delAdmin') return delAdmin(b.dataset.u);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && $('#admP')) login(); });

/* ---------------- Boot ---------------- */
(async function boot() {
  applyTheme();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  let tok = null; try { tok = sessionStorage.getItem('sv_admin_session'); } catch { /* ignore */ }
  if (tok) { S.token = tok; const me = await apiAdmin('me'); if (me.status === 200) { S.admin = me.data.admin; await refresh(); return; } S.token = null; }
  render();
})();
