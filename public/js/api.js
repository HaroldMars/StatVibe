import { state } from './state.js';
import { applyWorkspaceFromAccount } from './utils.js';

export const STORAGE = {
  LOCAL_TOKEN: 'sv_token',
  SESSION_TOKEN: 'sv_session_token',
  TOKEN_EXPIRES: 'sv_token_expires',
  THEME: 'sv_theme',
};

/** Persist a real-account token for up to 30 days (server also enforces expiry). Guests stay tab-only. */
export function persistToken(token, remember, expiresAt) {
  try {
    if (remember) {
      localStorage.setItem(STORAGE.LOCAL_TOKEN, token);
      sessionStorage.removeItem(STORAGE.SESSION_TOKEN);
      if (expiresAt) localStorage.setItem(STORAGE.TOKEN_EXPIRES, String(expiresAt));
      else localStorage.removeItem(STORAGE.TOKEN_EXPIRES);
    } else {
      sessionStorage.setItem(STORAGE.SESSION_TOKEN, token);
      localStorage.removeItem(STORAGE.LOCAL_TOKEN);
      localStorage.removeItem(STORAGE.TOKEN_EXPIRES);
    }
  } catch { /* ignore */ }
}

export function clearTokenStorage() {
  try {
    localStorage.removeItem(STORAGE.LOCAL_TOKEN);
    sessionStorage.removeItem(STORAGE.SESSION_TOKEN);
    localStorage.removeItem(STORAGE.TOKEN_EXPIRES);
    localStorage.removeItem('sv_remember');
  } catch { /* ignore */ }
}

/** Returns false if a stored expiry timestamp is in the past. */
export function storedSessionStillValid() {
  try {
    const raw = localStorage.getItem(STORAGE.TOKEN_EXPIRES);
    if (!raw) return true; // unknown expiry — let the server decide
    const exp = Number(raw);
    if (!Number.isFinite(exp)) return true;
    return exp > Date.now();
  } catch { return true; }
}

export function readStoredToken() {
  try {
    return localStorage.getItem(STORAGE.LOCAL_TOKEN) || sessionStorage.getItem(STORAGE.SESSION_TOKEN) || null;
  } catch { return null; }
}

export function getAuthToken() {
  if (state.session.token) return state.session.token;
  const tok = readStoredToken();
  if (tok) state.session.token = tok;
  return tok;
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const tok = getAuthToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
  }
  let r;
  try { r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { return { status: 0, data: { error: 'No internet connection. Check your network and try again.', code: 'offline' } }; }
  let data = {}; try { data = await r.json(); } catch { /* no body */ }
  // Recover once if the client thought it was signed in but the token was missing from the request.
  if (auth && r.status === 401 && data && data.code === 'not_signed_in' && !headers.Authorization) {
    const tok = readStoredToken();
    if (tok) {
      state.session.token = tok;
      return api(path, { method, body, auth: true });
    }
  }
  return { status: r.status, data };
}

export function applySession(data, opts = {}) {
  if (!data || !data.user) return false;
  const isGuest = !!data.user.isGuest;
  // Real accounts always persist to localStorage; guests are tab-only and never "remembered".
  const remember = opts.remember != null ? !!opts.remember && !isGuest : !isGuest;
  const expiresAt = data.session && data.session.expiresAt;
  if (data.token) {
    state.session.token = data.token;
    state.session.expiresAt = expiresAt || null;
    if (opts.persist !== false) persistToken(data.token, remember, expiresAt);
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
