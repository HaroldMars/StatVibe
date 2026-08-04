import { state } from '../state.js';
import { I } from '../icons.js';
import { api } from '../api.js';
import { $, bizName, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { push, render, currentScreen } from '../router.js';
import { callAI } from './ai.js';

let sendInFlight = false;
let jsQRReady = null;
let activeScanStream = null;
let scanFacing = 'environment';

export function scrollChat() {
  const s = document.getElementById('chatScroll');
  if (s) s.scrollTop = s.scrollHeight;
}

function msgId(m) {
  return m && (m.id || m.clientId || `${m.from || ''}:${m.at || ''}:${String(m.text || '').slice(0, 24)}`);
}

/** Dedupe by id / clientId — prevents double bubbles on optimistic + server merge. */
export function mergeMessages(prev, next) {
  const map = new Map();
  for (const m of [...(prev || []), ...(next || [])]) {
    if (!m) continue;
    const id = msgId(m);
    if (!id) continue;
    if (!map.has(id)) map.set(id, m);
    else {
      const cur = map.get(id);
      // Prefer server ids over temp optimistic ones
      if (String(cur.id || '').startsWith('tmp_') && m.id && !String(m.id).startsWith('tmp_')) {
        map.set(id, m);
      } else if (m.id && !cur.id) map.set(id, m);
      else map.set(id, { ...cur, ...m });
    }
  }
  // Also collapse identical text+from+near-time without shared id
  const list = [...map.values()].sort((a, b) => (a.at || 0) - (b.at || 0));
  const out = [];
  for (const m of list) {
    const prevM = out[out.length - 1];
    if (
      prevM
      && prevM.from === m.from
      && String(prevM.text || '').trim() === String(m.text || '').trim()
      && Math.abs((prevM.at || 0) - (m.at || 0)) < 4000
    ) {
      // Keep the one with a real server id
      if (String(prevM.id || '').startsWith('tmp_') && m.id && !String(m.id).startsWith('tmp_')) {
        out[out.length - 1] = m;
      }
      continue;
    }
    out.push(m);
  }
  return out;
}

function setMessages(list) {
  state.chat.messages = mergeMessages([], list);
}

export async function loadConversations() {
  const { status, data } = await api('/conversations');
  if (status === 200) {
    state.session.conversations = data.conversations;
    state.session.unreadTotal = data.unreadTotal;
  }
  return data;
}

export async function openChat(convId) {
  const conv = (state.session.conversations || []).find((c) => c.id === convId);
  state.chat = {
    convId,
    other: conv ? conv.other : { name: 'Chat', tag: '' },
    messages: [],
    draft: null,
    drafting: false,
  };
  push('chat');
  const { status, data } = await api('/conversations/' + convId + '/messages');
  if (status === 200) {
    setMessages(data.messages || []);
    state.chat.other = data.other;
  }
  loadConversations();
  render();
  scrollChat();
}

export async function refreshChat() {
  if (!state.chat.convId || sendInFlight) return;
  const { status, data } = await api('/conversations/' + state.chat.convId + '/messages');
  if (status !== 200) return;
  const merged = mergeMessages(state.chat.messages, data.messages || []);
  const same =
    merged.length === (state.chat.messages || []).length
    && merged.every((m, i) => msgId(m) === msgId(state.chat.messages[i]));
  if (same) {
    if (data.other) state.chat.other = data.other;
    return;
  }
  state.chat.messages = merged;
  state.chat.other = data.other;
  if (currentScreen() === 'chat') {
    render();
    scrollChat();
  }
}

function newTempId() {
  return 'tmp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function agentSend() {
  const inp = $('#agentInput');
  const txt = inp && inp.value.trim();
  if (!txt || !state.chat.convId) return;
  if (sendInFlight) return;
  sendInFlight = true;
  state.chat.draft = null;
  if (inp) inp.value = '';

  const optimistic = {
    id: newTempId(),
    from: state.session.user && state.session.user.id,
    text: txt,
    at: Date.now(),
    pending: true,
  };
  state.chat.messages = mergeMessages(state.chat.messages, [optimistic]);
  render();
  scrollChat();

  try {
    const { status, data } = await api('/conversations/' + state.chat.convId + '/messages', {
      method: 'POST',
      body: { text: txt },
    });
    if (status === 201 && data.message) {
      // Drop temp, keep server message
      state.chat.messages = mergeMessages(
        (state.chat.messages || []).filter((m) => m.id !== optimistic.id),
        [data.message],
      );
      render();
      scrollChat();
      loadConversations();
    } else {
      state.chat.messages = (state.chat.messages || []).filter((m) => m.id !== optimistic.id);
      if (inp) inp.value = txt;
      render();
      toast((data && data.error) || 'Could not send');
    }
  } catch {
    state.chat.messages = (state.chat.messages || []).filter((m) => m.id !== optimistic.id);
    if (inp) inp.value = txt;
    render();
    toast('Network error — message not sent');
  } finally {
    sendInFlight = false;
  }
}

export async function agentDraft() {
  if (!state.chat.convId || state.chat.drafting) return;
  if (state.chat.draft) { toast('You already have a draft — Edit or Approve it'); return; }
  const me = state.session.user && state.session.user.id;
  const lastTheirs = [...state.chat.messages].reverse().find((m) => m.from !== me);
  state.chat.drafting = true;
  render();
  scrollChat();
  const prompt = `You are messaging on behalf of the business "${bizName()}" to ${state.chat.other.name}. Their last message: "${lastTheirs ? lastTheirs.text : '(none yet — write a friendly opener)'}". Draft a short, warm, professional reply suited to their message. Under 55 words. No preamble.`;
  try {
    const d = await callAI(prompt, 'You are AgentTech, an AI messaging assistant that drafts replies to clients and partners for a business owner. Be concise, friendly and specific.');
    const text = (d && d.content ? d.content : '').trim();
    if (!text) { toast('Empty draft — try again'); return; }
    if (state.session.agentAutoReply) {
      const r = await api('/conversations/' + state.chat.convId + '/messages', { method: 'POST', body: { text } });
      if (r.status === 201) {
        state.chat.messages = mergeMessages(state.chat.messages, [r.data.message]);
        toast('AgentTech auto-replied');
        loadConversations();
      }
      return;
    }
    state.chat.draft = text;
  } catch (e) {
    toast('Could not draft reply');
  } finally {
    state.chat.drafting = false;
    render();
    scrollChat();
  }
}

export async function approveSend() {
  if (!state.chat.draft || !state.chat.convId || sendInFlight) return;
  const text = state.chat.draft;
  state.chat.draft = null;
  sendInFlight = true;
  render();
  try {
    const { status, data } = await api('/conversations/' + state.chat.convId + '/messages', {
      method: 'POST',
      body: { text },
    });
    if (status === 201) {
      state.chat.messages = mergeMessages(state.chat.messages, [data.message]);
      render();
      scrollChat();
      toast('Sent');
      loadConversations();
    } else {
      state.chat.draft = text;
      render();
      toast((data && data.error) || 'Could not send');
    }
  } finally {
    sendInFlight = false;
  }
}

export function editDraft() {
  const d = state.chat.draft;
  if (!d) return;
  state.chat.draft = null;
  render();
  const inp = $('#agentInput');
  if (inp) { inp.value = d; inp.focus(); }
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
  setTimeout(() => {
    const b = document.querySelector('#sheet [data-a-auto]');
    if (b) b.onclick = () => {
      state.session.agentAutoReply = !state.session.agentAutoReply;
      render();
      agentSettingsSheet();
      toast('Auto-reply ' + (state.session.agentAutoReply ? 'on' : 'off'));
    };
  }, 30);
}

function ensureJsQR() {
  if (jsQRReady) return jsQRReady;
  jsQRReady = new Promise((resolve, reject) => {
    if (window.jsQR) return resolve(window.jsQR);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    s.async = true;
    s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR missing')));
    s.onerror = () => reject(new Error('jsQR failed to load'));
    document.head.appendChild(s);
  });
  return jsQRReady;
}

export function parseStatVibeCode(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const tagged = s.match(/(?:statvibe:|user:)\s*([A-Z0-9-]{4,})/i);
  if (tagged) return tagged[1].toUpperCase();
  const sv = s.match(/\b(SV-[A-Z0-9]{4,})\b/i);
  if (sv) return sv[1].toUpperCase();
  return s.toUpperCase().replace(/^STATVIBE:/i, '').replace(/^USER:/i, '').trim();
}

function stopScanStream() {
  if (activeScanStream) {
    activeScanStream.getTracks().forEach((t) => t.stop());
    activeScanStream = null;
  }
}

export function stopQRScanner() {
  stopScanStream();
}

// New message → add a contact by scanning/uploading their StatVibe QR or code.
export function newChatSheet() {
  stopScanStream();
  openSheet(`<h3>New message</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Add someone by their StatVibe QR or code. They can message you the same way — from your QR.</div>
    <div class="stack gap-10">
      <button type="button" class="btn" data-a-scan>${I.spark('#fff', 13, true)} Scan QR with camera</button>
      <label class="btn outline" style="cursor:pointer;margin:0">Upload a QR image<input id="qrFile" type="file" accept="image/*" capture="environment" style="display:none" /></label>
    </div>
    <div class="flex items-center gap-12" style="margin:16px 0"><div style="flex:1;height:1px;background:var(--line-2)"></div><span style="font-size:11px;color:var(--muted-3)">or enter code</span><div style="flex:1;height:1px;background:var(--line-2)"></div></div>
    <div class="field" style="margin-bottom:10px"><input id="tagInput" placeholder="SV-XXXXXX" style="text-transform:uppercase;font-family:var(--mono);letter-spacing:1px" /></div>
    <button type="button" class="btn" data-a-tag>Start chat</button>
    <div style="text-align:center;margin-top:12px"><button type="button" class="btn ghost" data-act="myQR" style="width:auto;padding:8px 12px;font-size:12.5px;color:var(--teal)">Show my QR so others can reach me →</button></div>`);
  setTimeout(() => {
    const sh = document.getElementById('sheet');
    if (!sh) return;
    const tagBtn = sh.querySelector('[data-a-tag]');
    if (tagBtn) tagBtn.onclick = () => {
      const v = (document.getElementById('tagInput') || {}).value;
      const code = parseStatVibeCode(v);
      if (code) startConversationByTag(code);
      else toast('Enter a StatVibe code');
    };
    const scanBtn = sh.querySelector('[data-a-scan]');
    if (scanBtn) scanBtn.onclick = () => scanQRCamera();
    const file = sh.querySelector('#qrFile');
    if (file) file.onchange = (e) => decodeQRImage(e.target.files[0]);
  }, 30);
}

export async function startConversationByTag(tag) {
  const code = parseStatVibeCode(tag);
  if (!code) { toast('Invalid StatVibe code'); return; }
  stopScanStream();
  const { status, data } = await api('/conversations', { method: 'POST', body: { tag: code } });
  if (status === 200) {
    closeSheet();
    await loadConversations();
    openChat(data.conversation.id);
  } else toast((data && data.error) || 'Could not start chat');
}

/** Decode QR from an uploaded image via jsQR (Canvas). */
export async function decodeQRImage(file) {
  if (!file) return;
  try {
    const jsQR = await ensureJsQR();
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) {
      const tag = parseStatVibeCode(code.data);
      if (tag) startConversationByTag(tag);
      else toast('QR found but no StatVibe code');
    } else toast('No QR found in that image');
  } catch (e) {
    toast('Could not read that image');
  }
}

/** Live camera QR scan with viewfinder overlay (jsQR + getUserMedia). */
export async function scanQRCamera() {
  try {
    await ensureJsQR();
  } catch {
    toast('Scanner library failed to load — upload a QR image instead');
    return;
  }

  scanFacing = 'environment';
  openSheet(`<div class="sheet-back-row">
      <button type="button" class="sheet-back-btn" id="qrScanBack">← Back</button>
      <h3 style="margin:0;flex:1;text-align:center;padding-right:56px">Scan QR</h3>
    </div>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.45;margin:0 0 12px">Point at a StatVibe code (<b>SV-XXXXXX</b>). Camera stays on-device — nothing is uploaded.</div>
    <div class="qr-scanner">
      <video id="qrVid" autoplay playsinline muted></video>
      <div class="qr-scanner-frame" aria-hidden="true"></div>
      <div class="qr-scanner-hint">Align QR inside the frame</div>
    </div>
    <div class="flex gap-8" style="margin-top:12px">
      <button type="button" class="btn outline" id="qrFlipCam" style="flex:1">Flip camera</button>
      <button type="button" class="btn outline" id="qrScanCancel" style="flex:1">Cancel</button>
    </div>`);

  const cleanup = () => {
    stopScanStream();
    const vid = document.getElementById('qrVid');
    if (vid) vid.srcObject = null;
  };

  setTimeout(async () => {
    const back = document.getElementById('qrScanBack');
    const cancel = document.getElementById('qrScanCancel');
    const flip = document.getElementById('qrFlipCam');
    if (back) back.onclick = () => { cleanup(); newChatSheet(); };
    if (cancel) cancel.onclick = () => { cleanup(); closeSheet(); };
    if (flip) flip.onclick = async () => {
      scanFacing = scanFacing === 'environment' ? 'user' : 'environment';
      await startVideo();
    };

    async function startVideo() {
      stopScanStream();
      const vid = document.getElementById('qrVid');
      if (!vid) return;
      try {
        activeScanStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: scanFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        vid.srcObject = activeScanStream;
        await vid.play().catch(() => {});
      } catch (err) {
        // Fallback without facingMode constraint
        try {
          activeScanStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          vid.srcObject = activeScanStream;
          await vid.play().catch(() => {});
        } catch {
          toast('Camera permission denied — upload a QR image instead');
          newChatSheet();
        }
      }
    }

    await startVideo();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let scanning = true;

    const tick = async () => {
      if (!scanning) return;
      const vid = document.getElementById('qrVid');
      if (!vid || !document.getElementById('sheet')?.classList.contains('show')) {
        cleanup();
        return;
      }
      if (vid.readyState >= 2 && vid.videoWidth) {
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
          if (result && result.data) {
            scanning = false;
            const tag = parseStatVibeCode(result.data);
            cleanup();
            if (tag) {
              toast('QR detected · ' + tag);
              startConversationByTag(tag);
            } else {
              toast('QR found but no StatVibe code');
              newChatSheet();
            }
            return;
          }
        } catch { /* keep scanning */ }
      }
      setTimeout(tick, 280);
    };
    tick();
  }, 40);
}
