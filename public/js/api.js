import { state } from './state.js';
import { applyWorkspaceFromAccount } from './utils.js';

export const STORAGE = { LOCAL_TOKEN: 'sv_token', SESSION_TOKEN: 'sv_session_token', THEME: 'sv_theme' };
/** Persist a real-account token for up to 30 days (server also enforces expiry). Guests stay tab-only. */
export function persistToken(token, remember) {
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
export function clearTokenStorage() {
  try {
    localStorage.removeItem(STORAGE.LOCAL_TOKEN);
    sessionStorage.removeItem(STORAGE.SESSION_TOKEN);
    localStorage.removeItem('sv_remember');
  } catch { /* ignore */ }
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth && state.session.token) headers['Authorization'] = 'Bearer ' + state.session.token;
  let r;
  try { r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { return { status: 0, data: { error: 'Network error' } }; }
  let data = {}; try { data = await r.json(); } catch { /* no body */ }
  return { status: r.status, data };
}

export function applySession(data, opts = {}) {
  if (!data || !data.user) return false;
  const isGuest = !!data.user.isGuest;
  // Real accounts always persist to localStorage; guests are tab-only and never "remembered".
  const remember = opts.remember != null ? !!opts.remember && !isGuest : !isGuest;
  if (data.token) {
    state.session.token = data.token;
    if (opts.persist !== false) persistToken(data.token, remember);
  }
  state.session.user = data.user;
  state.profile.name = data.user.name || state.profile.name;
  state.profile.email = data.user.email || 'Guest session';
  state.profile.role = isGuest ? 'Guest' : 'Owner';
  if (data.account) {
    state.session.account = data.account;
    applyWorkspaceFromAccount(data.account);
    if (data.account.plan) {
      state.plan = data.account.plan;
      const limits = { Free: 1000, Pro: 10000, Business: 50000, Enterprise: 999999 };
      if (limits[data.account.plan]) state.usage.limit = limits[data.account.plan];
    }
  }
  if (data.inventory) state.session.inventory = data.inventory;
  state.authed = true;
  state.auth.remember = remember;
  return true;
}

export async function refreshInventory() {
  const { status, data } = await api('/inventory');
  if (status === 200) state.session.inventory = data.inventory;
}
