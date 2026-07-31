import { state } from '../state.js';
import { api } from '../api.js';
import { app, esc, toast } from '../utils.js';
import { push, render } from '../router.js';

export async function loadModels() {
  try {
    const r = await fetch('/api/models');
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

export async function callAI(prompt, system) {
  const active = [...state.models.active];
  const model = active[0] || (state.models.engines[0] && state.models.engines[0].id);
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages }),
  });
  return r.json();
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
    const engines = state.models.blend && state.models.active.size > 1
      ? [...state.models.active].map((id) => (state.models.engines.find((e) => e.id === id) || {}).label || id)
      : [d.model];
    state.lastAIOutput = { title: title || 'AI Output', content: d.content, model: d.model, simulated: d.simulated, engines };
    render();
    // Save to AI workspace history (best-effort).
    try {
      const { status, data } = await api('/ai/history', { method: 'POST', body: { title: title || 'AI Output', prompt, content: d.content, model: d.model, simulated: d.simulated } });
      if (status === 201) state.session.history.unshift(data.entry);
    } catch { /* ignore */ }
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
