import { state } from './state.js';
import { app, imgSrc } from './utils.js';
import { screens, tabScreens } from './screens/index.js';
import { wire } from './wire.js';
import { loadConversations } from './features/messaging.js';

export function currentScreen() { return state.stack.length ? state.stack[state.stack.length - 1].screen : state.tab; }
export function go(tab) { state.tab = tab; state.stack = []; render(); if (tab === 'agent') loadConversations().then(() => { if (state.tab === 'agent' && !state.stack.length) render(); }); }
export function push(screen, params = {}) { state.stack.push({ screen, params }); render(); }
export function back() { state.stack.pop(); render(); }

function splashScreen() {
  return `<div class="splash" role="status" aria-label="Restoring your StatVibe session">
    <img class="splash-logo" src="${imgSrc('/logo-main.png', { w: 192, h: 192 })}" alt="StatVibe" width="88" height="88" />
    <div class="splash-name">StatVibe</div>
    <div class="splash-sub">Restoring your session…</div>
  </div>`;
}

export function render() {
  const el = app();
  const top = state.stack.length ? state.stack[state.stack.length - 1] : null;
  const topName = top ? top.screen : null;
  let html;
  // Logo splash only while restoring an existing signed-in session.
  if (!state.session.loaded && state.session.restoring) {
    html = splashScreen();
  } else if (!state.session.loaded) {
    // First visit / not signed in — show welcome immediately (no restore copy).
    html = screens.welcome();
  } else if (topName === 'admin') {
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
