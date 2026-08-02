import { state } from '../state.js';
import { api, clearTokenStorage } from '../api.js';
import { esc, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';

export let installPrompt = null;
export function setInstallPrompt(e) { installPrompt = e; }

export function downloadSheet() {
  const canInstall = !!installPrompt;
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  openSheet(`<h3>Get the StatVibe app</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Install StatVibe on your phone or computer — it runs full-screen, gets its own icon, and works offline.</div>
    ${standalone ? '<div class="card" style="text-align:center;padding:20px;font-size:13px">✅ You\'re already using the installed app.</div>'
      : `${canInstall ? '<button class="btn" data-a-install style="margin-bottom:12px">Install now</button>' : ''}
      <div class="list">
        <div class="row" style="cursor:default;display:block;padding:12px 15px"><div style="font-size:13px;font-weight:600;margin-bottom:2px">📱 iPhone / iPad</div><div style="font-size:12px;color:var(--muted);line-height:1.5">Open in <b>Safari</b> → tap the Share button → <b>Add to Home Screen</b>.</div></div>
        <div class="row" style="cursor:default;display:block;padding:12px 15px"><div style="font-size:13px;font-weight:600;margin-bottom:2px">🤖 Android</div><div style="font-size:12px;color:var(--muted);line-height:1.5">Open in <b>Chrome</b> → menu ⋮ → <b>Install app</b> (or Add to Home screen).</div></div>
        <div class="row" style="cursor:default;display:block;padding:12px 15px"><div style="font-size:13px;font-weight:600;margin-bottom:2px">💻 Desktop</div><div style="font-size:12px;color:var(--muted);line-height:1.5">Click the <b>install</b> icon in the browser's address bar.</div></div>
      </div>
      <div style="font-size:11px;color:var(--muted-3);margin-top:12px;line-height:1.5">A native Android APK / iOS build is on the way — for now the installable app above gives you the same full-screen experience on both platforms.</div>`}
    <button class="btn outline" data-close style="margin-top:12px">Close</button>`);
  setTimeout(() => {
    const b = document.querySelector('#sheet [data-a-install]');
    if (b) b.onclick = async () => { if (!installPrompt) return; installPrompt.prompt(); const r = await installPrompt.userChoice.catch(() => ({})); installPrompt = null; closeSheet(); toast(r.outcome === 'accepted' ? 'Installing StatVibe…' : 'Install dismissed'); };
  }, 30);
}

export function deleteAccountConfirm() {
  openSheet(`<h3 style="color:var(--red)">Delete account?</h3>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin:8px 0 16px">This permanently deletes your account, business setup, inventory and notes. This cannot be undone.</div>
    <button class="btn" id="daYes" style="background:var(--red)">Yes, delete everything</button>
    <button class="btn ghost" id="daNo" style="margin-top:6px">Cancel</button>`);
  setTimeout(() => {
    const n = document.getElementById('daNo'); if (n) n.onclick = closeSheet;
    const y = document.getElementById('daYes'); if (y) y.onclick = async () => {
      const { status } = await api('/account', { method: 'DELETE' }); closeSheet();
      if (status === 200) { clearTokenStorage(); const cur = state.session.currencies; state.session = { token: null, user: null, account: null, inventory: [], currencies: cur, cloudinary: state.session.cloudinary, loaded: true }; state.authed = false; state.stack = []; render(); toast('Account deleted'); }
      else toast('Could not delete account');
    };
  }, 30);
}
export function exportData() {
  try {
    const blob = new Blob([JSON.stringify({ user: state.session.user, account: state.session.account, inventory: state.session.inventory }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'statvibe-data.json'; a.click(); URL.revokeObjectURL(url); toast('Exported your data');
  } catch { toast('Export not supported here'); }
}
// Deterministic decorative QR-style grid (not a scannable code — placeholder for beta).
export function qrPlaceholder(text, size = 150) {
  let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  const n = 21, cell = size / n; let rects = '';
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const finder = (x, y) => { for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) { const edge = dx === 0 || dy === 0 || dx === 6 || dy === 6; const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4; if (edge || core) rects += `<rect x="${(x + dx) * cell}" y="${(y + dy) * cell}" width="${cell}" height="${cell}"/>`; } };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if ((x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)) continue; if (rnd() > 0.55) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`; }
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="#14171C"><rect width="${size}" height="${size}" fill="#fff"/>${rects}</svg>`;
}
/* ---- Real QR encoder (byte mode, ECC-L, versions 1–4, single block) ---- */
export const QR = (() => {
  const EXP = new Array(512), LOG = new Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  const DATA_CAP = { 1: 19, 2: 34, 3: 55, 4: 80 };   // byte-mode data codewords, ECC level L
  const EC_CW = { 1: 7, 2: 10, 3: 15, 4: 20 };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26] };

  function rsEncode(data, ec) {
    let gen = [1];
    for (let i = 0; i < ec; i++) { const g2 = new Array(gen.length + 1).fill(0); for (let j = 0; j < gen.length; j++) { g2[j] ^= gen[j]; g2[j + 1] ^= gmul(gen[j], EXP[i]); } gen = g2; }
    const res = new Array(data.length + ec).fill(0);
    for (let i = 0; i < data.length; i++) res[i] = data[i];
    for (let i = 0; i < data.length; i++) { const c = res[i]; if (c) for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], c); }
    return res.slice(data.length);
  }
  function encode(text, version) {
    const bytes = Array.from(new TextEncoder().encode(text));
    const bits = []; const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
    push(0b0100, 4); push(bytes.length, 8); bytes.forEach((b) => push(b, 8));
    const cap = DATA_CAP[version] * 8;
    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const pads = [0xEC, 0x11]; let p = 0; while (bits.length < cap) { push(pads[p++ % 2], 8); }
    const cw = []; for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; cw.push(v); }
    return cw.concat(rsEncode(cw, EC_CW[version]));
  }
  function modules(text) {
    let version = 1; while (version < 4 && new TextEncoder().encode(text).length + 2 > DATA_CAP[version]) version++;
    const size = 17 + 4 * version;
    const m = Array.from({ length: size }, () => new Array(size).fill(null));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false)); // function-module mask
    const set = (r, c, v) => { m[r][c] = v; fn[r][c] = true; };
    const finder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue; const on = i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)); set(rr, cc, on); } };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); } // timing
    const ac = ALIGN[version];
    for (const r of ac) for (const c of ac) { if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1); }
    set(size - 8, 8, true); // dark module
    for (let i = 0; i < 9; i++) { if (!fn[8][i]) { m[8][i] = null; fn[8][i] = true; } if (!fn[i][8]) { m[i][8] = null; fn[i][8] = true; } } // reserve format
    for (let i = 0; i < 8; i++) { fn[8][size - 1 - i] = true; fn[size - 1 - i][8] = true; }

    const cw = encode(text, version); const bitsArr = []; cw.forEach((b) => { for (let i = 7; i >= 0; i--) bitsArr.push((b >> i) & 1); });
    let bi = 0, up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let k = 0; k < size; k++) { const row = up ? size - 1 - k : k; for (let c = 0; c < 2; c++) { const cc = col - c; if (fn[row][cc]) continue; m[row][cc] = bi < bitsArr.length ? bitsArr[bi++] === 1 : false; } }
      up = !up;
    }
    const maskFn = [(r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2 + (r * c) % 3) === 0, (r, c) => (((r * c) % 2 + (r * c) % 3) % 2) === 0, (r, c) => (((r + c) % 2 + (r * c) % 3) % 2) === 0];
    const fmtBits = (mask) => {
      const data5 = (0b01 << 3) | mask;      // ECC level L = 01, then 3 mask bits
      let d = data5 << 10;
      for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= (0x537 << (i - 10)); // BCH(15,5)
      return ((data5 << 10) | (d & 0x3FF)) ^ 0x5412;                            // + mask pattern
    };
    const applyFormat = (grid, mask) => {
      const v = fmtBits(mask); const bit = (i) => (v >> i) & 1;
      // Copy 1 — around the top-left finder (skips timing modules).
      for (let i = 0; i <= 5; i++) grid[8][i] = bit(i);
      grid[8][7] = bit(6); grid[8][8] = bit(7); grid[7][8] = bit(8);
      for (let i = 9; i <= 14; i++) grid[14 - i][8] = bit(i);
      // Copy 2 — split along the top-right row and bottom-left column.
      for (let i = 0; i <= 7; i++) grid[size - 1 - i][8] = bit(i);
      for (let i = 8; i <= 14; i++) grid[8][size - 15 + i] = bit(i);
      grid[size - 8][8] = 1; // dark module
    };
    const penalty = (grid) => { let p = 0; for (let r = 0; r < size; r++) { let run = 1; for (let c = 1; c < size; c++) { if (grid[r][c] === grid[r][c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } } for (let c = 0; c < size; c++) { let run = 1; for (let r = 1; r < size; r++) { if (grid[r][c] === grid[r - 1][c]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } } for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) if (grid[r][c] === grid[r][c + 1] && grid[r][c] === grid[r + 1][c] && grid[r][c] === grid[r + 1][c + 1]) p += 3; let dark = 0; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (grid[r][c]) dark++; p += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10; return p; };

    let best = null, bestP = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const g = m.map((row) => row.slice());
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fn[r][c] && maskFn[mask](r, c)) g[r][c] = g[r][c] ? 0 : 1;
      applyFormat(g, mask);
      const gb = g.map((row) => row.map((x) => x === 1 || x === true));
      const pen = penalty(gb);
      if (pen < bestP) { bestP = pen; best = gb; }
    }
    return best;
  }
  function svg(text, size = 200, quiet = 4) {
    const m = modules(text); const n = m.length; const total = n + quiet * 2; const cell = +(size / total).toFixed(3);
    let rects = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) rects += `<rect x="${((c + quiet) * cell).toFixed(2)}" y="${((r + quiet) * cell).toFixed(2)}" width="${cell}" height="${cell}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
  }
  return { svg };
})();
window.QR = QR; // exposed for QR round-trip testing

export function qrSheet() {
  const u = state.session.user || {};
  const tag = u.tag || '';
  openSheet(`<h3>My StatVibe code</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Share this code (or QR) so a partner or client can reach you in Agent → New message. Nobody can find you unless you share it.</div>
    <div style="text-align:center;background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px">
      ${qrPlaceholder('statvibe:' + (tag || 'guest'), 168)}
      <div style="font-family:var(--mono);font-size:22px;font-weight:600;margin-top:14px;letter-spacing:2px;color:#14171C">${esc(tag || '—')}</div>
      <div style="font-size:11px;color:#8A9099;margin-top:3px">Your StatVibe code${u.email ? ' · ' + esc(u.email) : ''}</div>
    </div>
    <button class="btn" data-act="copyTag" data-tag="${esc(tag)}" style="margin-top:12px">Copy my code</button>
    <button class="btn outline" data-close style="margin-top:8px">Done</button>`);
}
export async function paymentSheet() {
  const u = state.session.user || {};
  const priceMap = { Free: 0, Pro: 1699, Business: 4499 };
  const amount = priceMap[state.plan] || 1699;
  openSheet(`<h3>Payment method</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 14px">Pay via GCash, Maya or bank through <b>PayMongo</b> (QRPh). Scan the QR to pay for your subscription.</div>
    <div id="payBox" style="text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:20px">
      <div class="typing" style="color:var(--muted)"><i></i><i></i><i></i></div>
      <div style="font-size:12px;color:var(--muted-2);margin-top:10px">Requesting PayMongo QR…</div>
    </div>
    <button class="btn" data-close style="margin-top:14px">Done</button>`);
  const { status, data } = await api('/pay/qr', { method: 'POST', body: { amount } });
  const box = document.getElementById('payBox'); if (!box) return;
  if (status === 200 && data.configured && data.source) {
    box.innerHTML = `${qrPlaceholder('paymongo:' + (data.source.data && data.source.data.id || u.tag), 168)}<div style="font-size:12px;color:var(--muted);margin-top:12px">PayMongo QRPh · ₱${amount}</div><div style="font-size:11px;color:var(--teal);font-weight:600;margin-top:4px">Live payment source created</div>`;
  } else {
    box.innerHTML = `${qrPlaceholder('paymongo:demo:' + (u.tag || 'guest') + ':' + state.plan, 168)}<div style="font-size:12px;color:var(--muted);margin-top:12px">PayMongo QRPh · ₱${amount}</div><div style="font-size:11px;color:var(--amber);font-weight:600;margin-top:4px">${esc((data && data.message) || 'Test mode — add PayMongo keys on the server to accept live payments')}</div>`;
  }
}
export function editBusinessSheet() {
  const acct = state.session.account || {};
  openSheet(`<h3>Business name</h3><div class="field" style="margin-top:12px"><input id="bnName" value="${esc(acct.businessName || '')}"/></div><button class="btn" id="bnSave">Save</button>`);
  setTimeout(() => { const b = document.getElementById('bnSave'); if (b) b.onclick = async () => {
    const name = (document.getElementById('bnName') || {}).value;
    const { status, data } = await api('/account', { method: 'PATCH', body: { businessName: name } });
    if (status === 200) { state.session.account = data.account; closeSheet(); render(); toast('Saved'); } else toast(data.error || 'Could not save');
  }; }, 30);
}
export function currencySheet() {
  const cur = (state.session.account && state.session.account.currency) || 'USD';
  openSheet(`<h3>Currency</h3><div class="list" style="margin-top:12px;max-height:60vh;overflow:auto">
    ${(state.session.currencies || []).map((c) => `<button class="row" data-cur="${c.code}"><span>${esc(c.symbol)} · ${esc(c.name)}</span><span class="val">${c.code}${c.code === cur ? ' ✓' : ''}</span></button>`).join('')}
  </div>`);
  setTimeout(() => { document.getElementById('sheet').querySelectorAll('[data-cur]').forEach((b) => b.onclick = async () => {
    const { status, data } = await api('/account', { method: 'PATCH', body: { currency: b.dataset.cur } });
    if (status === 200) { state.session.account = data.account; closeSheet(); render(); toast('Currency set to ' + b.dataset.cur); }
  }); }, 30);
}

/* ---- Plans ---- */
export async function doUpgrade(name) {
  if (name === 'Enterprise') { toast('Enterprise — our team will reach out'); return; }
  if (name === 'Free' || name === state.plan) { toast(name === state.plan ? 'Already on this plan' : 'You are on Free'); return; }
  const { status, data } = await api('/account/upgrade', { method: 'POST', body: { plan: name } });
  if (status === 200) {
    state.session.account = data.account;
    state.plan = name;
    if (data.usage) {
      state.usage = {
        used: data.usage.used || 0,
        limit: data.usage.limit || data.usageLimit || 50000,
        resetDays: data.usage.resetDays,
        resetAt: data.usage.resetAt,
        period: data.usage.period || 'month',
        remaining: data.usage.remaining,
      };
    } else if (data.usageLimit) state.usage.limit = data.usageLimit;
    render(); toast(`Upgraded to ${name} ✓`);
  } else toast(data.error || 'Upgrade failed');
}
