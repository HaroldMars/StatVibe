import { state } from '../state.js';
import { I } from '../icons.js';
import { api } from '../api.js';
import { $, bizName, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { push, render, currentScreen } from '../router.js';
import { callAI } from './ai.js';

export function scrollChat() { const s = document.getElementById('chatScroll'); if (s) s.scrollTop = s.scrollHeight; }

export async function loadConversations() {
  const { status, data } = await api('/conversations');
  if (status === 200) { state.session.conversations = data.conversations; state.session.unreadTotal = data.unreadTotal; }
}

export async function openChat(convId) {
  const conv = (state.session.conversations || []).find((c) => c.id === convId);
  state.chat = { convId, other: conv ? conv.other : { name: 'Chat', tag: '' }, messages: [], draft: null, drafting: false };
  push('chat');
  const { status, data } = await api('/conversations/' + convId + '/messages');
  if (status === 200) { state.chat.messages = data.messages; state.chat.other = data.other; }
  loadConversations();
  render(); scrollChat();
}

export async function refreshChat() {
  if (!state.chat.convId) return;
  const { status, data } = await api('/conversations/' + state.chat.convId + '/messages');
  if (status === 200 && data.messages.length !== state.chat.messages.length) {
    state.chat.messages = data.messages; state.chat.other = data.other;
    if (currentScreen() === 'chat') { render(); scrollChat(); }
  }
}

export async function agentSend() {
  const inp = $('#agentInput'); const txt = inp && inp.value.trim();
  if (!txt || !state.chat.convId) return;
  state.chat.draft = null;
  const { status, data } = await api('/conversations/' + state.chat.convId + '/messages', { method: 'POST', body: { text: txt } });
  if (status === 201) { state.chat.messages.push(data.message); render(); scrollChat(); loadConversations(); }
  else toast((data && data.error) || 'Could not send');
}

export async function agentDraft() {
  if (!state.chat.convId || state.chat.drafting) return;
  if (state.chat.draft) { toast('You already have a draft — Edit or Approve it'); return; }
  const me = state.session.user && state.session.user.id;
  const lastTheirs = [...state.chat.messages].reverse().find((m) => m.from !== me);
  state.chat.drafting = true;
  const scroll = document.getElementById('chatScroll');
  if (scroll) { const el = document.createElement('div'); el.className = 'bubble ai'; el.innerHTML = `<div class="ai-tag">${I.spark('#7FE3C8', 13, true)}AgentTech drafting</div><div class="typing" style="color:#7FE3C8"><i></i><i></i><i></i></div>`; scroll.appendChild(el); scrollChat(); }
  const prompt = `You are messaging on behalf of the business "${bizName()}" to ${state.chat.other.name}. Their last message: "${lastTheirs ? lastTheirs.text : '(none yet — write a friendly opener)'}". Draft a short, warm, professional reply suited to their message. Under 55 words. No preamble.`;
  try {
    const d = await callAI(prompt, 'You are AgentTech, an AI messaging assistant that drafts replies to clients and partners for a business owner. Be concise, friendly and specific.');
    const text = d.content.trim();
    if (state.session.agentAutoReply) {
      const r = await api('/conversations/' + state.chat.convId + '/messages', { method: 'POST', body: { text } });
      state.chat.drafting = false;
      if (r.status === 201) { state.chat.messages.push(r.data.message); toast('AgentTech auto-replied ✓'); loadConversations(); }
      render(); scrollChat(); return;
    }
    state.chat.draft = text;
  } catch (e) { toast('Could not draft reply'); }
  finally { state.chat.drafting = false; render(); scrollChat(); }
}

export async function approveSend() {
  if (!state.chat.draft || !state.chat.convId) return;
  const text = state.chat.draft; state.chat.draft = null;
  const { status, data } = await api('/conversations/' + state.chat.convId + '/messages', { method: 'POST', body: { text } });
  if (status === 201) { state.chat.messages.push(data.message); render(); scrollChat(); toast('Sent ✓'); loadConversations(); }
}

export function editDraft() {
  const d = state.chat.draft; if (!d) return;
  state.chat.draft = null; render();
  const inp = $('#agentInput'); if (inp) { inp.value = d; inp.focus(); }
}

export function agentSettingsSheet() {
  const auto = state.session.agentAutoReply;
  openSheet(`<h3>AgentTech settings</h3>
    <div class="list" style="margin-top:12px">
      <div class="row" style="cursor:default"><div><div style="font-size:13.5px">Auto-reply</div><div style="font-size:11.5px;color:var(--muted-2)">AI answers new messages automatically</div></div><button class="toggle ${auto ? 'on' : ''}" data-a-auto></button></div>
      <div class="row" style="cursor:default"><div><div style="font-size:13.5px">Approval mode</div><div style="font-size:11.5px;color:var(--muted-2)">You review each AI draft before it sends</div></div><span class="tagchip ${auto ? 'grey' : 'green'}">${auto ? 'off' : 'on'}</span></div>
    </div>
    <div style="font-size:11px;color:var(--muted-3);margin-top:12px;line-height:1.5">Approval mode: AI drafts a reply and waits for Approve/Edit. Auto-reply: AgentTech responds in real time.</div>
    <button class="btn" data-close style="margin-top:14px">Done</button>`);
  setTimeout(() => { const b = document.querySelector('#sheet [data-a-auto]'); if (b) b.onclick = () => { state.session.agentAutoReply = !state.session.agentAutoReply; render(); agentSettingsSheet(); toast('Auto-reply ' + (state.session.agentAutoReply ? 'on' : 'off')); }; }, 30);
}

// New message → add a contact by scanning/uploading their StatVibe QR or code.
export function newChatSheet() {
  const canScan = 'BarcodeDetector' in window;
  openSheet(`<h3>New message</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Add someone by their StatVibe QR or code. They can message you the same way — from your QR.</div>
    <div class="stack gap-10">
      ${canScan ? `<button class="btn" data-a-scan>${I.spark('#fff', 13, true)} Scan QR with camera</button>` : ''}
      <label class="btn outline" style="cursor:pointer;margin:0">Upload a QR image<input id="qrFile" type="file" accept="image/*" style="display:none" /></label>
    </div>
    <div class="flex items-center gap-12" style="margin:16px 0"><div style="flex:1;height:1px;background:var(--line-2)"></div><span style="font-size:11px;color:var(--muted-3)">or enter code</span><div style="flex:1;height:1px;background:var(--line-2)"></div></div>
    <div class="field" style="margin-bottom:10px"><input id="tagInput" placeholder="SV-XXXXXX" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:1px" /></div>
    <button class="btn" data-a-tag>Start chat</button>
    <div style="text-align:center;margin-top:12px"><b data-act="myQR" style="font-size:12.5px;color:var(--teal);cursor:pointer">Show my QR so others can reach me →</b></div>`);
  setTimeout(() => {
    const sh = document.getElementById('sheet');
    const tagBtn = sh.querySelector('[data-a-tag]'); if (tagBtn) tagBtn.onclick = () => { const v = (document.getElementById('tagInput') || {}).value; if (v && v.trim()) startConversationByTag(v.trim()); else toast('Enter a StatVibe code'); };
    const scanBtn = sh.querySelector('[data-a-scan]'); if (scanBtn) scanBtn.onclick = () => scanQRCamera();
    const file = sh.querySelector('#qrFile'); if (file) file.onchange = (e) => decodeQRImage(e.target.files[0]);
  }, 30);
}

export async function startConversationByTag(tag) {
  const { status, data } = await api('/conversations', { method: 'POST', body: { tag } });
  if (status === 200) { closeSheet(); await loadConversations(); openChat(data.conversation.id); }
  else toast((data && data.error) || 'Could not start chat');
}

// Decode a QR from an uploaded image using the built-in BarcodeDetector.
export async function decodeQRImage(file) {
  if (!file) return;
  if (!('BarcodeDetector' in window)) { toast('Scanning not supported here — enter the code'); return; }
  try {
    const bmp = await createImageBitmap(file);
    const codes = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bmp);
    if (codes.length) startConversationByTag(codes[0].rawValue);
    else toast('No QR found in that image');
  } catch (e) { toast('Could not read that image'); }
}

// Live camera QR scan (BarcodeDetector). Opens a small scanner overlay.
export async function scanQRCamera() {
  if (!('BarcodeDetector' in window)) { toast('Camera scanning not supported here'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
  catch { toast('Camera permission denied'); return; }
  openSheet(`<h3>Scan a StatVibe QR</h3><video id="qrVid" autoplay playsinline muted style="width:100%;border-radius:14px;background:#000;margin-top:10px"></video><button class="btn outline" data-close style="margin-top:12px">Cancel</button>`);
  const det = new window.BarcodeDetector({ formats: ['qr_code'] });
  setTimeout(async () => {
    const vid = document.getElementById('qrVid'); if (!vid) { stream.getTracks().forEach((t) => t.stop()); return; }
    vid.srcObject = stream;
    const tick = async () => {
      if (!document.getElementById('qrVid')) { stream.getTracks().forEach((t) => t.stop()); return; }
      try { const codes = await det.detect(vid); if (codes.length) { stream.getTracks().forEach((t) => t.stop()); startConversationByTag(codes[0].rawValue); return; } } catch { /* keep scanning */ }
      setTimeout(tick, 400);
    };
    tick();
  }, 60);
}
