import { state } from './state.js';
import { app } from './utils.js';
import { screens, tabScreens } from './screens/index.js';
import { wire } from './wire.js';
import { loadConversations } from './features/messaging.js';

export function currentScreen() { return state.stack.length ? state.stack[state.stack.length - 1].screen : state.tab; }
export function go(tab) { state.tab = tab; state.stack = []; render(); if (tab === 'agent') loadConversations().then(() => { if (state.tab === 'agent' && !state.stack.length) render(); }); }
export function push(screen, params = {}) { state.stack.push({ screen, params }); render(); }
export function back() { state.stack.pop(); render(); }

export function render() {
  const el = app();
  const top = state.stack.length ? state.stack[state.stack.length - 1] : null;
  const topName = top ? top.screen : null;
  let html;
  if (!state.session.loaded) {
    html = `<div class="scroll pad" style="display:flex;align-items:center;justify-content:center;min-height:70vh">
      <div style="text-align:center">
        <div class="typing" style="justify-content:center;margin-bottom:14px"><i></i><i></i><i></i></div>
        <div style="font-size:15px;font-weight:600;margin-bottom:4px">Restoring your account</div>
        <div style="font-size:12.5px;color:var(--muted)">Signing you back into Stats &amp; Calc…</div>
      </div>
    </div>`;
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
