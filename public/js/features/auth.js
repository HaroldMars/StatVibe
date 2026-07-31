import { state } from '../state.js';
import { api, applySession, clearTokenStorage, persistToken, rememberEmail, readRememberedEmail } from '../api.js';
import { $, clientEmailOk, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';
import { loadIdeas, loadHistory } from './ideas.js';
import { loadConversations } from './messaging.js';
import { maybeShowTutorial } from './tutorial.js';

const PASSWORD_HINT = 'Use at least 8 characters with a letter and a number';

function clientPasswordOk(p) {
  return typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

function clearAuthFormError() {
  state.auth.formError = '';
  state.auth.formCode = '';
}

function setAuthFormError(message, code = '') {
  state.auth.formError = message || 'Something went wrong';
  state.auth.formCode = code || '';
}

export function goAuthScreen(screen) {
  // Capture email so Create account ↔ Log in keeps the same address (Google/Meta style).
  const emailEl = $('#loginEmail') || $('#regEmail');
  if (emailEl && emailEl.value) state.auth.emailDraft = emailEl.value.trim();
  clearAuthFormError();
  state.auth.busy = false;
  state.stack = [{ screen, params: {} }];
  render();
}

async function enterAuthedApp({ toastMsg, preferStats = true } = {}) {
  state.stack = [];
  if (preferStats) state.tab = 'stats';
  if (state.session.account && state.session.account.setupComplete) {
    await Promise.all([loadIdeas(), loadHistory(), loadConversations()]);
  }
  render();
  if (toastMsg) toast(toastMsg);
  // First-time tutorial after setup is complete.
  maybeShowTutorial();
}

export async function doGuest() {
  const { status, data } = await api('/auth/guest', { method: 'POST', auth: false });
  if (status === 201 || status === 200) {
    if (applySession(data, { remember: false })) {
      clearAuthFormError();
      state.auth.preferLogin = false;
      state.auth.sessionExpired = false;
      state.stack = [];
      render();
      toast('Exploring without an account — create one to save your work');
    }
  } else toast(data.error || 'Could not start guest session');
}

export async function doRegister() {
  if (state.auth.busy) return;
  const name = (($('#regName') || {}).value || '').trim();
  const email = (($('#regEmail') || {}).value || '').trim();
  const password = ($('#regPwd') || {}).value || '';
  const password2 = ($('#regPwd2') || {}).value || '';
  const terms = ($('#regTerms') || {}).checked;

  state.auth.emailDraft = email;

  if (!name || name.length < 2) { setAuthFormError('Enter your full name', 'name_required'); render(); return; }
  if (!clientEmailOk(email)) { setAuthFormError('Enter a valid email address', 'invalid_email'); render(); return; }
  if (!clientPasswordOk(password)) { setAuthFormError(PASSWORD_HINT, 'weak_password'); render(); return; }
  if (password !== password2) { setAuthFormError('Passwords do not match', 'password_mismatch'); render(); return; }
  if (!terms) { setAuthFormError('Please accept the Terms & Privacy Policy', 'terms_required'); render(); return; }

  state.auth.busy = true;
  clearAuthFormError();
  render();

  try {
    const { status, data } = await api('/auth/register', {
      method: 'POST', auth: false,
      body: { name, email, password, acceptedTerms: true },
    });
    if (status === 201 && data.user && !data.user.isGuest && data.token) {
      // Instant session — user is signed in immediately and can use the app / log in again anytime.
      rememberEmail(email);
      applySession(data, { remember: true });
      clearAuthFormError();
      state.auth.emailDraft = email;
      state.auth.preferLogin = false;
      state.auth.sessionExpired = false;
      state.stack = [];
      render();
      toast('Account created — you are signed in');
      return;
    }
    if (status === 409 && data.code === 'email_taken') {
      // Existing account — send them to Log in with the same email prefilled.
      rememberEmail(email);
      state.auth.preferLogin = true;
      setAuthFormError(data.error || 'An account already exists with that email. Sign in instead.', 'email_taken');
      render();
      return;
    }
    setAuthFormError(data.error || 'Could not create account', data.code || '');
    render();
  } finally {
    state.auth.busy = false;
    render();
  }
}

export async function doLogin() {
  if (state.auth.busy) return;
  const email = (($('#loginEmail') || {}).value || '').trim();
  const password = ($('#loginPwd') || {}).value || '';
  state.auth.emailDraft = email;

  if (!clientEmailOk(email)) { setAuthFormError('Enter a valid email address', 'invalid_email'); render(); return; }
  if (!password) { setAuthFormError('Enter your password', 'password_required'); render(); return; }

  state.auth.busy = true;
  clearAuthFormError();
  render();

  try {
    const { status, data } = await api('/auth/login', {
      method: 'POST', auth: false, body: { email, password },
    });
    const okUser = data && data.user && !data.user.isGuest && data.token;
    const emailMatches = okUser && String(data.user.email || '').toLowerCase() === email.toLowerCase();
    if (status === 200 && okUser && emailMatches) {
      rememberEmail(email);
      applySession(data, { remember: true });
      clearAuthFormError();
      state.auth.emailDraft = email;
      state.auth.preferLogin = false;
      state.auth.sessionExpired = false;
      await enterAuthedApp({
        toastMsg: state.session.account && state.session.account.setupComplete ? 'Welcome back' : 'Signed in — finish setup',
        preferStats: true,
      });
      return;
    }
    if (status === 0) {
      setAuthFormError(data.error || 'No internet connection', 'offline');
    } else {
      setAuthFormError(
        data.error || 'Incorrect email or password',
        data.code || (status === 401 ? 'invalid_credentials' : ''),
      );
    }
    render();
  } finally {
    state.auth.busy = false;
    render();
  }
}

export async function doLogout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  clearTokenStorage();
  const curr = state.session.currencies;
  state.session = {
    token: null, user: null, account: null, inventory: [], ideas: [], history: [],
    conversations: [], unreadTotal: 0, currencies: curr, cloudinary: state.session.cloudinary,
    loaded: true, restoring: false, expiresAt: null,
  };
  state.authed = false;
  state.auth.remember = true;
  state.auth.busy = false;
  state.auth.preferLogin = true;
  state.auth.sessionExpired = false;
  clearAuthFormError();
  state.auth.emailDraft = readRememberedEmail();
  state.tutorial = { open: false, step: -1 };
  state.stack = [{ screen: 'login', params: {} }];
  state.tab = 'stats';
  render();
  toast('Logged out');
}

export function captureSetup() {
  const d = state.setupDraft;
  if ($('#suName')) d.businessName = $('#suName').value;
  if ($('#suIndustry')) d.industry = $('#suIndustry').value;
  if ($('#suCurrency')) d.currency = $('#suCurrency').value;
  if ($('#suTeam')) d.teamSize = $('#suTeam').value;
}

export async function finishSetup() {
  captureSetup();
  const d = state.setupDraft;
  if (!d.businessName || !d.businessName.trim()) { toast('Enter your business name'); return; }
  const { status, data } = await api('/account/setup', { method: 'POST', body: {
    businessName: d.businessName.trim(), industry: d.industry, currency: d.currency, teamSize: d.teamSize,
    sellsProducts: d.sellsProducts !== false, goals: d.goals || [],
  } });
  if (status === 200) {
    state.session.account = data.account;
    state.stack = [];
    state.tab = 'stats';
    render();
    toast("You're all set");
    maybeShowTutorial();
  } else toast(data.error || 'Setup failed');
}

export function changePasswordSheet() {
  openSheet(`<h3>Change password</h3>
    <div class="field" style="margin-top:12px"><label>Current password</label><div style="display:flex;gap:8px;align-items:center"><input id="cpCur" type="password" autocomplete="current-password" style="flex:1"/><button class="pill" type="button" data-act="togglePwd" data-target="cpCur">Show</button></div></div>
    <div class="field"><label>New password · letter + number, min 8</label><div style="display:flex;gap:8px;align-items:center"><input id="cpNew" type="password" autocomplete="new-password" style="flex:1"/><button class="pill" type="button" data-act="togglePwd" data-target="cpNew">Show</button></div></div>
    <button class="btn" id="cpSave">Update password</button>`);
  setTimeout(() => { const b = document.getElementById('cpSave'); if (b) b.onclick = async () => {
    const currentPassword = (document.getElementById('cpCur') || {}).value, newPassword = (document.getElementById('cpNew') || {}).value;
    if (!clientPasswordOk(newPassword)) { toast(PASSWORD_HINT); return; }
    const { status, data } = await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    if (status === 200) {
      if (data.token) {
        state.session.token = data.token;
        persistToken(data.token, true, data.session && data.session.expiresAt);
      }
      closeSheet();
      toast('Password updated');
    } else toast(data.error || 'Could not update password');
  }; }, 30);
}
