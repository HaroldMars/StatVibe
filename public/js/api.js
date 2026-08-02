import { state } from './state.js';
import { applyWorkspaceFromAccount } from './utils.js';

export const STORAGE = {
  LOCAL_TOKEN: 'sv_token',
  SESSION_TOKEN: 'sv_session_token',
  TOKEN_EXPIRES: 'sv_token_expires',
  USER_SNAPSHOT: 'sv_user',
  THEME: 'sv_theme',
};

const PLAN_LIMITS = { Free: 50000, Pro: 1000000, Business: 5000000, Enterprise: 999999999 };

/** Persist a registered-account token until logout. Guests stay tab-only. */
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
      localStorage.removeItem(STORAGE.USER_SNAPSHOT);
    }
  } catch { /* ignore */ }
}

/** Cache a privacy-safe user snapshot so boot can restore to Home faster. */
export function persistUserSnapshot(user) {
  try {
    if (!user || user.isGuest) {
      localStorage.removeItem(STORAGE.USER_SNAPSHOT);
      return;
    }
    localStorage.setItem(STORAGE.USER_SNAPSHOT, JSON.stringify({
      id: user.id,
      email: user.email || '',
      name: user.name || '',
      tag: user.tag || '',
    }));
  } catch { /* ignore */ }
}

export function readUserSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE.USER_SNAPSHOT);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && typeof u === 'object' ? u : null;
  } catch { return null; }
}

export function clearTokenStorage() {
  try {
    localStorage.removeItem(STORAGE.LOCAL_TOKEN);
    sessionStorage.removeItem(STORAGE.SESSION_TOKEN);
    localStorage.removeItem(STORAGE.TOKEN_EXPIRES);
    localStorage.removeItem(STORAGE.USER_SNAPSHOT);
    localStorage.removeItem('sv_remember');
  } catch { /* ignore */ }
}

/**
 * Soft client hint only — never the sole reason to sign the user out.
 * Server sliding TTL is authoritative; boot always verifies with /auth/me.
 */
export function storedSessionStillValid() {
  try {
    const raw = localStorage.getItem(STORAGE.TOKEN_EXPIRES);
    if (!raw) return true;
    const exp = Number(raw);
    if (!Number.isFinite(exp)) return true;
    // Grace window: allow restore even if client clock thinks expiry passed;
    // server will confirm or reject.
    return exp > Date.now() - 7 * 24 * 3600 * 1000;
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

export function applyUsage(usage) {
  if (!usage || typeof usage !== 'object') return;
  state.usage = {
    used: Number(usage.used) || 0,
    limit: Number(usage.limit) || state.usage.limit || 50000,
    resetDays: usage.resetDays == null ? state.usage.resetDays : usage.resetDays,
    resetAt: usage.resetAt || null,
    period: usage.period || state.usage.period || 'week',
    remaining: usage.remaining,
  };
  if (usage.plan) state.plan = usage.plan;
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
  // Keep sliding session expiry in sync whenever the server returns it.
  if (data && data.session && data.session.expiresAt && state.session.token) {
    state.session.expiresAt = data.session.expiresAt;
    const isGuest = !!(state.session.user && state.session.user.isGuest);
    if (!isGuest) persistToken(state.session.token, true, data.session.expiresAt);
  }
  if (data && data.usage) applyUsage(data.usage);
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
    if (opts.persist !== false) {
      persistToken(data.token, remember, expiresAt);
      if (remember) persistUserSnapshot(data.user);
    }
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
      if (PLAN_LIMITS[data.account.plan]) state.usage.limit = PLAN_LIMITS[data.account.plan];
    }
  }
  if (data.usage) applyUsage(data.usage);
  else if (data.account) {
    // Derive from account fields if older payloads omit usage.
    applyUsage({
      used: data.account.aiUsed || 0,
      limit: PLAN_LIMITS[data.account.plan] || 50000,
      resetDays: data.account.aiResetDays,
      plan: data.account.plan || 'Free',
      period: (data.account.plan || 'Free') === 'Free' ? 'week' : 'month',
    });
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
