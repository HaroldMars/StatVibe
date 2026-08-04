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
    state.models.workspace = d.workspace || [];
    state.models.ollamaOnline = !!d.ollama_online;
    state.models.hosted = !!d.hosted;
    if (d.admin_user) state.admin.user = d.admin_user;
    if (!state.models.loaded && typeof d.default_blend === 'boolean') state.models.blend = d.default_blend;
    // Drop any active model that no longer exists (e.g. a cloud model disabled by admin).
    // Workspace Gemini options stay selectable even when they remap to hosted AI_MODEL.
    const valid = new Set([
      'auto',
      ...(state.models.workspace || []),
      ...state.models.engines,
      ...state.models.cloud.filter((c) => c.available),
      { id: 'google/gemini-2.5-flash-lite' },
      { id: 'google/gemini-3.5-flash-lite' },
      { id: 'google/gemini-3.6-flash' },
    ].map((e) => (typeof e === 'string' ? e : e.id)));
    // Don't wipe selection just because workspace catalog id isn't in engines —
    // hosted chat remaps unknown ids server-side.
    const engineIds = new Set(state.models.engines.map((e) => e.id));
    if (state.models.active.size === 0) {
      const first = (state.models.workspace && state.models.workspace[0]) || state.models.engines[0];
      if (first) state.models.active.add(first.id);
    } else if ([...state.models.active].every((id) => !valid.has(id) && !engineIds.has(id))) {
      // Only clear truly unknown ids
      state.models.active.clear();
      const first = (state.models.workspace && state.models.workspace[0]) || state.models.engines[0];
      if (first) state.models.active.add(first.id);
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
  if (card) {
    const activeId = (state.models.active.size && [...state.models.active][0]) || 'AI';
    const label = (
      (state.models.workspace || []).find((e) => e.id === activeId)
      || state.models.engines.find((e) => e.id === activeId)
      || (state.models.cloud || []).find((e) => e.id === activeId)
      || {}
    ).label || activeId;
    card.innerHTML = `<div class="typing" style="color:var(--muted)"><i></i><i></i><i></i></div><div style="font-size:12px;color:var(--muted-2);margin-top:8px">Generating with ${esc(label)}…</div>`;
  }
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

const MODEL_CATALOG = [
  { id: 'auto', label: 'Auto (Recommended)', desc: 'Smart routing picks the best available model', badge: 'Recommended', group: 'top' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', desc: 'Fast & efficient for everyday tasks', badge: 'Fast', group: 'gemini' },
  { id: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', desc: 'Balanced speed and quality', badge: 'Balanced', group: 'gemini' },
  { id: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash', desc: 'High performance for complex analysis', badge: 'Pro', group: 'gemini' },
];

export function workspaceModelOptions() {
  const seen = new Set();
  const out = [];
  for (const m of MODEL_CATALOG) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  for (const e of [...(state.models.workspace || []), ...state.models.engines]) {
    if (!e || !e.id || seen.has(e.id)) continue;
    // Skip raw API slugs like openrouter/auto — covered by Auto
    if (String(e.id).toLowerCase() === 'openrouter/auto') continue;
    seen.add(e.id);
    out.push({
      id: e.id,
      label: e.label || e.id,
      desc: e.vendor || 'Available model',
      badge: e.kind === 'hosted' ? 'Hosted' : (e.kind === 'local' ? 'Local' : ''),
      group: 'other',
    });
  }
  return out;
}

export function activeModelMeta() {
  const options = workspaceModelOptions();
  if (state.models.blend) {
    return options.find((o) => o.id === 'auto') || options[0];
  }
  const id = (state.models.active.size && [...state.models.active][0]) || 'auto';
  return options.find((o) => o.id === id) || options[0] || { id: 'auto', label: 'Auto (Recommended)' };
}

/** Apply model without full-page re-render (fixes select refresh loop). */
export function setActiveModel(id, { toastLabel } = {}) {
  if (!id) return;
  if (id === 'auto') {
    state.models.blend = true;
    state.settings.blend = true;
    const gem = (state.models.workspace || [])[0] || state.models.engines[0];
    if (gem) state.models.active = new Set([gem.id]);
  } else {
    state.models.blend = false;
    state.settings.blend = false;
    state.models.active = new Set([id]);
  }
  const meta = activeModelMeta();
  const label = toastLabel || meta.label || id;
  const trigger = document.getElementById('aiModelTrigger');
  if (trigger) {
    const name = trigger.querySelector('.ai-model-name');
    const sub = trigger.querySelector('.ai-model-sub');
    if (name) name.textContent = meta.label || label;
    if (sub) sub.textContent = meta.desc || 'Active model';
  }
  document.querySelectorAll('.ai-model-option').forEach((row) => {
    const selected = id === 'auto' ? row.dataset.id === 'auto' : row.dataset.id === id;
    row.classList.toggle('is-selected', selected);
    const mark = row.querySelector('.ai-model-check');
    if (mark) mark.textContent = selected ? '✓' : '';
  });
  toast('Model → ' + label);
}

export function openModelPicker() {
  const activeId = (state.models.active.size && [...state.models.active][0]) || '';
  const blendOn = !!state.models.blend;
  const options = workspaceModelOptions();

  openSheet(`<div class="sheet-back-row">
      <button type="button" class="sheet-back-btn" id="sheetLogicalBack">← Back</button>
      <h3 style="margin:0;flex:1;text-align:center;padding-right:56px">Choose model</h3>
    </div>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.45;margin:4px 0 14px">Pick how StatVibe routes AI Workspace tasks. Selection updates instantly — no page refresh.</div>
    <div class="ai-model-list">
      ${options.map((o) => {
        const isSelected = o.id === 'auto' ? blendOn : (!blendOn && o.id === activeId);
        return `<button type="button" class="ai-model-option${isSelected ? ' is-selected' : ''}" data-id="${esc(o.id)}">
          <div class="ai-model-option-copy">
            <div class="ai-model-option-title">${esc(o.label)}${o.badge ? `<span class="ai-model-badge">${esc(o.badge)}</span>` : ''}</div>
            <div class="ai-model-option-desc">${esc(o.desc || '')}</div>
          </div>
          <span class="ai-model-check" aria-hidden="true">${isSelected ? '✓' : ''}</span>
        </button>`;
      }).join('')}
    </div>`);

  setTimeout(() => {
    const back = document.getElementById('sheetLogicalBack');
    if (back) back.onclick = () => closeSheet();
    document.querySelectorAll('.ai-model-option').forEach((row) => {
      row.onclick = () => {
        setActiveModel(row.dataset.id);
        closeSheet();
      };
    });
  }, 20);
}
