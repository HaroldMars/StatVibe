import { state } from '../state.js';
import { I } from '../icons.js';
import { api } from '../api.js';
import { $, esc, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { push, go, render } from '../router.js';
import { callAI, runWorkspace } from './ai.js';

export async function loadIdeas() { const { status, data } = await api('/ideas'); if (status === 200) state.session.ideas = data.ideas; }
export async function loadHistory() { const { status, data } = await api('/ai/history'); if (status === 200) state.session.history = data.history; }

export function newIdea() {
  openSheet(`<h3>New idea</h3>
    <div class="field" style="margin-top:12px"><label>Title</label><input id="ideaTitle" placeholder="e.g. Wholesale marketplace"/></div>
    <div class="field"><label>Notes</label><textarea id="ideaNotes" rows="3" placeholder="What's the idea?"></textarea></div>
    <button class="btn" id="ideaSave">Add idea</button>`);
  setTimeout(() => { const b = document.getElementById('ideaSave'); if (b) b.onclick = async () => {
    const title = ((document.getElementById('ideaTitle') || {}).value || '').trim();
    const notes = ((document.getElementById('ideaNotes') || {}).value || '').trim();
    if (!title) { toast('Give it a title'); return; }
    const { status, data } = await api('/ideas', { method: 'POST', body: { title, notes } });
    if (status === 201) { state.session.ideas.unshift(data.idea); closeSheet(); render(); toast('Idea added'); } else toast(data.error || 'Could not add');
  }; }, 30);
}

export function editIdea(id) {
  const it = (state.session.ideas || []).find((x) => x.id === id); if (!it) return;
  const statuses = ['Backlog', 'Building', 'Launched'];
  openSheet(`<h3>Edit idea</h3>
    <div class="field" style="margin-top:12px"><label>Title</label><input id="edTitle" value="${esc(it.title)}"/></div>
    <div class="field"><label>Notes</label><textarea id="edNotes" rows="4">${esc(it.notes || '')}</textarea></div>
    <div class="field"><label>Status</label><div class="flex gap-8" id="edStatus">${statuses.map((s) => `<button class="pill ${s === it.status ? 'solid' : ''}" data-st="${s}">${s}</button>`).join('')}</div></div>
    <button class="btn mb-10" data-a-save>Save changes</button>
    <button class="btn outline mb-10" data-a-ai>${I.spark('#0E7C66', 12, true)} AI next steps</button>
    <button class="btn outline" data-a-del style="color:var(--red)">Delete idea</button>`);
  let status = it.status;
  setTimeout(() => {
    const sh = document.getElementById('sheet');
    sh.querySelectorAll('#edStatus [data-st]').forEach((b) => b.onclick = () => { status = b.dataset.st; sh.querySelectorAll('#edStatus [data-st]').forEach((x) => x.className = 'pill' + (x.dataset.st === status ? ' solid' : '')); });
    sh.querySelector('[data-a-save]').onclick = async () => {
      const title = (document.getElementById('edTitle') || {}).value.trim(), notes = (document.getElementById('edNotes') || {}).value.trim();
      const { status: st, data } = await api('/ideas/' + id, { method: 'PATCH', body: { title, notes, status } });
      if (st === 200) { const i = state.session.ideas.findIndex((x) => x.id === id); state.session.ideas[i] = data.idea; closeSheet(); render(); toast('Saved'); } else toast(data.error || 'Could not save');
    };
    sh.querySelector('[data-a-ai]').onclick = () => { closeSheet(); runWorkspace(`Give me 3 concrete next steps to move the "${it.title}" idea forward. Context: ${it.notes || it.title}`, it.title); };
    sh.querySelector('[data-a-del]').onclick = async () => { closeSheet(); await api('/ideas/' + id, { method: 'DELETE' }); state.session.ideas = state.session.ideas.filter((x) => x.id !== id); render(); toast('Deleted'); };
  }, 30);
}

export function aiHistorySheet() {
  const h = state.session.history || [];
  openSheet(`<h3>AI history</h3><div class="sub" style="margin-bottom:12px">Your recent AI Workspace queries${h.length ? '' : ' will appear here'}</div>
    ${h.length ? `<div class="list">${h.map((e) => `<button class="row" data-hist="${e.id}"><div style="text-align:left"><div style="font-size:13.5px;font-weight:500">${esc(e.title)}</div><div style="font-size:11px;color:var(--muted-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${esc(e.prompt || e.content)}</div></div><span class="val">›</span></button>`).join('')}</div>
    <button class="btn outline" data-a-clear style="margin-top:12px;color:var(--red)">Clear history</button>`
    : '<div class="card" style="text-align:center;padding:22px;color:var(--muted-2);font-size:13px">No history yet — run a task to save it.</div>'}`);
  setTimeout(() => {
    const sh = document.getElementById('sheet');
    sh.querySelectorAll('[data-hist]').forEach((b) => b.onclick = () => { const e = h.find((x) => x.id === b.dataset.hist); if (e) { state.lastAIOutput = { title: e.title, content: e.content, model: e.model, simulated: e.simulated, engines: [e.model] }; closeSheet(); push('aiOutput', {}); } });
    const c = sh.querySelector('[data-a-clear]'); if (c) c.onclick = async () => { await api('/ai/history', { method: 'DELETE' }); state.session.history = []; closeSheet(); render(); toast('History cleared'); };
  }, 30);
}

// AIVibe: reformulate a rough idea into a sharp, usable AI prompt.
export async function aivibe() {
  const inp = $('#aivibeInput'); const raw = inp ? inp.value.trim() : '';
  if (!raw) { toast('Describe your idea first'); return; }
  toast('AIVibe is refining…');
  try {
    const d = await callAI(`Rewrite this rough business idea into a clear, specific, well-structured AI prompt I can reuse. Keep it under 80 words. Idea: "${raw}"`, 'You are AIVibe, a prompt engineer for business owners. Output ONLY the refined prompt, no preamble.');
    openSheet(`<h3>${I.spark('#0E7C66', 15, true)} AIVibe prompt</h3>
      <div style="font-size:11px;color:var(--muted-2);margin:4px 0 10px">From: "${esc(raw)}"</div>
      <div style="background:var(--chip);border-radius:10px;padding:12px;font-size:13px;line-height:1.55;white-space:pre-wrap">${esc(d.content.trim())}</div>
      <button class="btn" data-a-run style="margin-top:12px">Run this prompt in AI Workspace →</button>
      <button class="btn outline" data-a-save-idea style="margin-top:8px">Save as idea</button>`);
    setTimeout(() => {
      const sh = document.getElementById('sheet');
      sh.querySelector('[data-a-run]').onclick = () => { closeSheet(); state.aiPrefill = d.content.trim(); go('ai'); };
      sh.querySelector('[data-a-save-idea]').onclick = async () => { const { status, data } = await api('/ideas', { method: 'POST', body: { title: raw.slice(0, 60), notes: d.content.trim() } }); if (status === 201) { state.session.ideas.unshift(data.idea); closeSheet(); go('hub'); toast('Saved as idea'); } };
    }, 30);
  } catch { toast('AIVibe failed — try again'); }
}
