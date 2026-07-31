import { state } from '../state.js';
import { api, applySession, clearTokenStorage, persistToken } from '../api.js';
import { $, clientEmailOk, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';
import { loadIdeas, loadHistory } from './ideas.js';
import { loadConversations } from './messaging.js';

export async function doGuest() {
  const { status, data } = await api('/auth/guest', { method: 'POST', auth: false });
  if (status === 201 || status === 200) {
    // Guests never persist across app reopens — sessionStorage only.
    if (applySession(data, { remember: false })) {
      state.stack = [];
      render();
      toast('Exploring as guest — create an account to save your work');
    }
  } else toast(data.error || 'Could not start guest session');
}
export async function doRegister() {
  const name = ($('#regName') || {}).value;
  const email = (($('#regEmail') || {}).value || '').trim();
  const password = ($('#regPwd') || {}).value;
  const terms = ($('#regTerms') || {}).checked;
  if (!terms) { toast('Please accept the Terms & Privacy Policy'); return; }
  if (!clientEmailOk(email)) { toast('Enter a valid email address'); return; }
  if (!password || password.length < 8) { toast('Password must be at least 8 characters'); return; }
  const { status, data } = await api('/auth/register', {
    method: 'POST', auth: false,
    body: { name: (name || '').trim(), email, password, acceptedTerms: true },
  });
  if (status === 201 && data.user && !data.user.isGuest) {
    applySession(data, { remember: true });
    state.stack = [];
    render();
    toast('Account created — set up your business');
  } else toast(data.error || 'Registration failed');
}
export async function doLogin() {
  const email = (($('#loginEmail') || {}).value || '').trim();
  const password = ($('#loginPwd') || {}).value || '';
  if (!clientEmailOk(email)) { toast('Enter the email for your registered StatVibe account'); return; }
  if (!password) { toast('Enter your password'); return; }

  const btn = document.querySelector('[data-act="doLogin"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  try {
    const { status, data } = await api('/auth/login', {
      method: 'POST', auth: false, body: { email, password },
    });
    const okUser = data && data.user && !data.user.isGuest && data.token;
    const emailMatches = okUser && String(data.user.email || '').toLowerCase() === email.toLowerCase();
    if (status === 200 && okUser && emailMatches) {
      applySession(data, { remember: true });
      state.stack = [];
      state.tab = 'stats';
      if (state.session.account && state.session.account.setupComplete) {
        await Promise.all([loadIdeas(), loadHistory(), loadConversations()]);
      }
      render();
      toast('Welcome back');
    } else {
      // Never enter the app on a failed / incomplete login.
      toast(data.error || 'Sign in failed — only registered accounts can log in');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
  }
}
export async function doLogout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  clearTokenStorage();
  const curr = state.session.currencies;
  state.session = {
    token: null, user: null, account: null, inventory: [], ideas: [], history: [],
    conversations: [], unreadTotal: 0, currencies: curr, cloudinary: state.session.cloudinary, loaded: true,
  };
  state.authed = false;
  state.auth.remember = true;
  state.stack = [];
  state.tab = 'stats';
  render();
  toast('Signed out');
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
  if (status === 200) { state.session.account = data.account; state.stack = []; state.tab = d.sellsProducts !== false ? 'calc' : 'stats'; render(); toast("You're all set 🎉"); }
  else toast(data.error || 'Setup failed');
}


export function changePasswordSheet() {
  openSheet(`<h3>Change password</h3>
    <div class="field" style="margin-top:12px"><label>Current password</label><div style="display:flex;gap:8px;align-items:center"><input id="cpCur" type="password" autocomplete="current-password" style="flex:1"/><button class="pill" type="button" data-act="togglePwd" data-target="cpCur">Show</button></div></div>
    <div class="field"><label>New password · min 8 characters</label><div style="display:flex;gap:8px;align-items:center"><input id="cpNew" type="password" autocomplete="new-password" style="flex:1"/><button class="pill" type="button" data-act="togglePwd" data-target="cpNew">Show</button></div></div>
    <button class="btn" id="cpSave">Update password</button>`);
  setTimeout(() => { const b = document.getElementById('cpSave'); if (b) b.onclick = async () => {
    const currentPassword = (document.getElementById('cpCur') || {}).value, newPassword = (document.getElementById('cpNew') || {}).value;
    const { status, data } = await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    if (status === 200) { if (data.token) { state.session.token = data.token; persistToken(data.token, true); } closeSheet(); toast('Password updated'); }
    else toast(data.error || 'Could not update password');
  }; }, 30);
}
