import { state } from '../state.js';
import { api, apiUrl, applyUsage } from '../api.js';
import { app, esc, toast } from '../utils.js';
import { push, render } from '../router.js';
import { openSheet, closeSheet } from '../sheet.js';

export async function loadModels() {
  try {
    const r = await fetch(apiUrl('/models'));
    const d = await r.json();
    state.models.engines = d.engines || [];
    state.models.cloud = d.cloud || [];
    state.models.ollamaOnline = !!d.ollama_online;
    state.models.hosted = !!d.hosted;
    if (d.admin_user) state.admin.user = d.admin_user;
    if (!state.models.loaded && typeof d.default_blend === 'boolean') state.models.blend = d.default_blend;
    // Drop any active model that no longer exists (e.g. a cloud model disabled by admin).
    const valid = new Set([...state.models.engines, ...state.models.cloud.filter((c) => c.available)].map((e) => e.id));
    state.models.active.forEach((id) => { if (!valid.has(id)) state.models.active.delete(id); });
    if (state.models.active.size === 0 && state.models.engines[0]) {
      state.models.active.add(state.models.engines[0].id);
    }
    state.models.loaded = true;
    const s = document.getElementById('aiStatus');
    if (s) {
      s.classList.toggle('online', state.models.ollamaOnline);
      s.classList.toggle('online', state.models.ollamaOnline || state.models.hosted);
      s.querySelector('span').textContent = state.models.ollamaOnline
        ? `Local AI online · ${state.models.engines.map((e) => e.label).join(', ')}`
        : state.models.hosted
          ? `Hosted AI online · ${state.models.engines.map((e) => e.label).join(', ')}`
          : 'AI offline · using simulated engine';
    }
  } catch (e) {
    state.models.engines = [{ id: 'simulated', label: 'Simulated', vendor: 'demo', available: true }];
    state.models.active.add('simulated');
  }
}

export function showQuotaSheet(data = {}) {
  const u = data.usage || state.usage;
  const days = u.resetDays == null ? 7 : u.resetDays;
  const period = u.period === 'week' ? 'week' : 'month';
  openSheet(`<div class="tutorial-sheet">
    <h3>AI limit reached</h3>
    <p class="tutorial-copy">${esc(data.error || `You've used all ${Number(u.limit || 0).toLocaleString()} Free AI tokens this ${period}.`)}</p>
    <p class="tutorial-copy" style="margin-top:4px">Upgrade for more capacity, or wait <b>${days} day${days === 1 ? '' : 's'}</b> for your Free weekly reset.</p>
    <button type="button" class="btn" data-act="goto" data-s="plans">View subscriptions</button>
    <button type="button" class="btn ghost" data-close style="margin-top:8px">Not now</button>
  </div>`);
  // Wire plans jump from sheet (outside #app click switch uses runSheetAct for some acts).
  setTimeout(() => {
    const sheet = document.getElementById('sheet');
    if (!sheet) return;
    const btn = sheet.querySelector('[data-act="goto"][data-s="plans"]');
    if (btn) btn.onclick = () => { closeSheet(); state.stack = [{ screen: 'plans', params: {} }]; render(); };
    const close = sheet.querySelector('[data-close]');
    if (close) close.onclick = () => closeSheet();
  }, 30);
}

export async function callAI(prompt, system) {
  if (!state.authed || !(state.session.user) || state.session.user.isGuest) {
    return { error: 'Sign in with a free account to use AI.', code: 'not_signed_in', upgradeRequired: true };
  }
  const active = [...state.models.active];
  const model = active[0] || (state.models.engines[0] && state.models.engines[0].id);
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const { status, data } = await api('/chat', { method: 'POST', body: { model, messages } });
  if (data && data.usage) applyUsage(data.usage);
  if (status === 402 || (data && data.code === 'quota_exceeded')) {
    showQuotaSheet(data);
    return data;
  }
  if (status === 401) {
    toast(data.error || 'Sign in to use AI');
    return data;
  }
  if (status !== 200) {
    return data && data.error ? data : { error: 'AI request failed', content: '' };
  }
  return data;
}

const SYS = 'You are StatVibe, an AI business assistant for a retail company (Illuminary Peak). Be concise, practical and specific. Use plain business language. Format with short paragraphs and bullet points where helpful.';

export async function runWorkspace(prompt, title) {
  push('aiOutput', {});
  const el = app();
  // show a loading state in the card
  const card = el.querySelector('.card [style*="line-height:1.6"]') || el.querySelector('.card');
  if (card) card.innerHTML = `<div class="typing" style="color:var(--muted)"><i></i><i></i><i></i></div><div style="font-size:12px;color:var(--muted-2);margin-top:8px">Generating with ${esc((state.models.active.size && [...state.models.active][0]) || 'AI')}…</div>`;
  try {
    const d = await callAI(prompt, SYS);
    if (d && (d.code === 'quota_exceeded' || d.upgradeRequired && !d.content)) {
      state.lastAIOutput = {
        title: title || 'AI Output',
        content: d.error || 'AI limit reached. Upgrade your plan or wait for the Free weekly reset.',
        model: 'quota',
        simulated: true,
        engines: [],
      };
      render();
      return;
    }
    const engines = state.models.blend && state.models.active.size > 1
      ? [...state.models.active].map((id) => (state.models.engines.find((e) => e.id === id) || {}).label || id)
      : [d.model];
    state.lastAIOutput = { title: title || 'AI Output', content: d.content || d.error || 'No response', model: d.model, simulated: d.simulated, engines };
    render();
    // Save to AI workspace history (best-effort).
    if (d.content && !d.code) {
      try {
        const { status, data } = await api('/ai/history', { method: 'POST', body: { title: title || 'AI Output', prompt, content: d.content, model: d.model, simulated: d.simulated } });
        if (status === 201) state.session.history.unshift(data.entry);
      } catch { /* ignore */ }
    }
  } catch (e) {
    state.lastAIOutput = { title: title || 'AI Output', content: 'Could not reach the AI service. ' + e.message, model: 'error', simulated: true, engines: [] };
    render();
  }
}

export function titleFor(q) {
  const s = q.toLowerCase();
  if (s.includes('board')) return 'Q3 Board Update';
  if (s.includes('plan')) return 'Business Plan';
  if (s.includes('forecast') || s.includes('scenario')) return 'Revenue Forecast';
  if (s.includes('email') || s.includes('outreach') || s.includes('re-engage')) return 'Outreach Draft';
  if (s.includes('procedure') || s.includes('sop') || s.includes('contract') || s.includes('document')) return 'Document Draft';
  if (s.includes('price') || s.includes('margin')) return 'Price Optimization';
  return 'AI Output';
}

export function toggleEngine(id) {
  const a = state.models.active;
  if (a.has(id)) { if (a.size > 1) a.delete(id); else toast('Keep at least one model active'); }
  else a.add(id);
  render();
}
