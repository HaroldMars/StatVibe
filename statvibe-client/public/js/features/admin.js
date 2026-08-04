import { state } from '../state.js';
import { apiUrl } from '../api.js';
import { $, toast } from '../utils.js';
import { push, go, render } from '../router.js';
import { loadModels } from './ai.js';

export async function adminFetch(sub, method = 'GET', body) {
  const r = await fetch(apiUrl('/admin/' + sub), {
    method,
    headers: { 'x-admin-token': state.admin.token || '', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch { /* ignore */ }
  return { status: r.status, data };
}

export async function adminLogin() {
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

export function adminLogout() {
  state.admin.authed = false; state.admin.summary = null; state.admin.token = null; state.admin.testOut = null;
  try { sessionStorage.removeItem('sv_admin_token'); } catch { /* ignore */ }
  render();
}

export async function adminRefresh() {
  const { status, data } = await adminFetch('summary');
  if (status === 200) { state.admin.summary = data; render(); } else { adminLogout(); toast('Session expired'); }
}

export async function adminSetConfig(patch) {
  const { status, data } = await adminFetch('config', 'POST', patch);
  if (status === 200) {
    state.admin.summary = { ...(state.admin.summary || {}), config: data.config };
    await loadModels();           // reflect engine/cloud changes app-wide
    await adminRefresh();
    toast('Config updated');
  } else { toast(data.error || 'Update failed'); }
}

export async function adminRunTest() {
  const model = $('#admModel') ? $('#admModel').value : undefined;
  const prompt = $('#admPrompt') ? $('#admPrompt').value.trim() : '';
  if (!prompt) { toast('Enter a test prompt'); return; }
  state.admin.testOut = { model: model || 'auto', content: 'Running…', simulated: false };
  render();
  try {
    const r = await fetch(apiUrl('/chat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }) });
    const d = await r.json();
    state.admin.testOut = { model: d.model, content: d.content + (d.note ? '\n\n(' + d.note + ')' : ''), simulated: d.simulated };
  } catch (e) { state.admin.testOut = { model: 'error', content: e.message, simulated: true }; }
  render();
}

export function adminJump(screen) {
  const tabs = ['stats', 'calc', 'hub', 'ai', 'agent'];
  // Never fake a consumer login — only jump if a real session already exists.
  if (!state.session.token || !state.session.user) {
    toast('Sign in required');
    return;
  }
  state.authed = true;
  if (screen === 'welcome') { state.authed = false; state.stack = []; render(); return; }
  if (screen === 'signin' || screen === 'login') { state.authed = false; state.stack = [{ screen: 'login', params: {} }]; render(); return; }
  if (tabs.includes(screen)) { go(screen); return; }
  state.stack = [{ screen, params: {} }]; render();
}

export function adminResetApp() {
  try { sessionStorage.clear(); } catch { /* ignore */ }
  location.hash = '';
  location.reload();
}

export async function openAdmin() {
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

export function enterApp() {
  // Intentionally removed: the app must only enter via a verified server session.
  toast('Please sign in with your StatVibe account');
}
