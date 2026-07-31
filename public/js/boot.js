import { state } from './state.js';
import { STORAGE, api, applySession, clearTokenStorage } from './api.js';
import { loadStatsDraft } from './utils.js';
import { applyTheme } from './theme.js';
import { go, render, currentScreen } from './router.js';
import { loadModels } from './features/ai.js';
import { loadIdeas, loadHistory } from './features/ideas.js';
import { loadConversations, refreshChat } from './features/messaging.js';
import { setInstallPrompt } from './features/account.js';
import { maybeShowTutorial } from './features/tutorial.js';

export function applyMobileEnv() {
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
export function applyHash() {
  const h = (location.hash || '').replace('#', '');
  if (h === 'admin') { location.href = '/admin'; return; } // developer console is a separate app
  // Other deep links require a real, set-up session.
  if (!state.authed || !(state.session.account && state.session.account.setupComplete)) return;
  const tabs = ['stats', 'calc', 'hub', 'ai', 'agent'];
  const subs = ['plans', 'settings', 'profile', 'security', 'alerts', 'revenue', 'aiOutput'];
  if (tabs.includes(h)) go(h);
  else if (subs.includes(h)) { state.stack = [{ screen: h, params: {} }]; render(); }
}

export async function boot() {
  try { const th = localStorage.getItem(STORAGE.THEME); if (th) state.settings.appearance = th; } catch { /* ignore */ }
  applyTheme();
  loadStatsDraft();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.settings.appearance === 'System') applyTheme(); });
  state.authed = false;
  state.auth.remember = true;

  // Prefer durable localStorage token (registered accounts). Guests use sessionStorage only.
  let tok = null;
  let fromLocal = false;
  try {
    tok = localStorage.getItem(STORAGE.LOCAL_TOKEN);
    if (tok) fromLocal = true;
    else tok = sessionStorage.getItem(STORAGE.SESSION_TOKEN);
  } catch { /* ignore */ }

  // Do NOT clear localStorage based on client clock alone — that caused surprise logouts.
  // Always ask the server; only clear when /auth/me rejects the token.

  // Logo splash only when a previous session exists; otherwise skip straight to welcome.
  state.session.restoring = !!tok;
  state.session.loaded = !tok;
  render();

  try {
    const m = await (await fetch('/api/meta')).json();
    state.session.currencies = m.currencies || [];
    state.session.cloudinary = m.cloudinary || null;
  } catch { /* offline */ }
  await loadModels();

  if (tok) {
    state.session.token = tok;
    let status, data;
    ({ status, data } = await api('/auth/me'));
    // One retry — serverless/Cloudinary can briefly miss a just-written session.
    if (!(status === 200 && data && data.user && data.token)) {
      await new Promise((r) => setTimeout(r, 350));
      ({ status, data } = await api('/auth/me'));
    }
    const valid = status === 200 && data && data.user && data.token;
    // Persisted localStorage sessions must be real registered accounts — never restore a guest from localStorage.
    if (valid && fromLocal && data.user.isGuest) {
      clearTokenStorage();
      state.session.token = null;
      state.session.user = null;
      state.authed = false;
    } else if (valid) {
      applySession(data, { remember: !data.user.isGuest });
      state.stack = [];
      if (state.session.account && state.session.account.setupComplete) {
        state.tab = 'stats';
        await Promise.all([loadIdeas(), loadHistory(), loadConversations()]);
      }
    } else if (status === 0) {
      // Offline with a stored token — keep the token; show app shell when possible after reconnect.
      state.session.token = tok;
      state.authed = false;
    } else {
      // Server explicitly rejected the session (logout elsewhere, deleted account, etc.).
      clearTokenStorage();
      state.session.token = null;
      state.session.user = null;
      state.authed = false;
    }
  }
  state.session.restoring = false;
  state.session.loaded = true;
  render();
  if (location.hash) applyHash();
  // Auto-login into a set-up account may still need the first-run tutorial.
  maybeShowTutorial();
}

export function startApp() {
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
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); setInstallPrompt(e); });
}
