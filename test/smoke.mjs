// StatVibe browser smoke test.
// Launches the server + headless Chrome, drives the real UI, and asserts that
// each screen renders and the key interactions work. Skips gracefully if no
// Chrome is found. Run: npm run smoke
//
// Zero dependencies — implements a tiny Chrome DevTools (CDP) WebSocket client
// on top of Node built-ins.

import { spawn } from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4188;
const DEBUG_PORT = 9333;
const BASE = `http://127.0.0.1:${PORT}`;

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  process.env.CHROME_PATH,
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } });

const results = [];
const ok = (name) => { results.push([true, name]); console.log('  ✔ ' + name); };
const fail = (name, e) => { results.push([false, name]); console.log('  ✖ ' + name + (e ? ' — ' + e : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(p) {
  return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: DEBUG_PORT, path: p }, (r) => { let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
}
function waitHealthy(tries = 60) {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < tries; i++) {
      try { await new Promise((res, rej) => http.get(BASE + '/api/health', (r) => (r.statusCode === 200 ? res() : rej())).on('error', rej)); return resolve(); } catch { await sleep(150); }
    }
    reject(new Error('server not healthy'));
  });
}

// Minimal CDP-over-WebSocket client (text frames).
function connectWS(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(u.port, u.hostname, () => sock.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    let buf = Buffer.alloc(0), hs = false; const listeners = [];
    sock.on('data', (d) => { buf = Buffer.concat([buf, d]);
      if (!hs) { const i = buf.indexOf('\r\n\r\n'); if (i < 0) return; hs = true; buf = buf.slice(i + 4); resolve({ send, on: (cb) => listeners.push(cb) }); }
      while (buf.length >= 2) { const len = buf[1] & 127; let off = 2, pl = len;
        if (len === 126) { pl = buf.readUInt16BE(2); off = 4; } else if (len === 127) { pl = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + pl) return; const pay = buf.slice(off, off + pl).toString(); buf = buf.slice(off + pl); listeners.forEach((cb) => cb(pay)); } });
    sock.on('error', reject);
    function send(s) { const p = Buffer.from(s); const m = crypto.randomBytes(4); const h = [0x81];
      if (p.length < 126) h.push(0x80 | p.length); else { h.push(0x80 | 126, (p.length >> 8) & 255, p.length & 255); }
      const hb = Buffer.from(h); const mk = Buffer.alloc(p.length); for (let i = 0; i < p.length; i++) mk[i] = p[i] ^ m[i % 4];
      sock.write(Buffer.concat([hb, m, mk])); }
  });
}

async function main() {
  if (!chrome) { console.log('No Chrome found — skipping browser smoke test (API tests still cover the server).'); process.exit(0); }

  const server = spawn(process.execPath, ['server.js'], { cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', OLLAMA_HOST: 'http://127.0.0.1:9', ADMIN_TOKEN: 'smoke-token' } });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-smoke-'));
  let browser;
  try {
    await waitHealthy();
    browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--window-size=420,880', BASE + '/'], { stdio: 'ignore' });
    // wait for the debugging endpoint
    let page;
    for (let i = 0; i < 40; i++) { try { const t = await getJSON('/json'); page = t.find((x) => x.type === 'page'); if (page && page.webSocketDebuggerUrl) break; } catch { /* retry */ } await sleep(200); }
    if (!page) throw new Error('Chrome DevTools endpoint unavailable');

    const ws = await connectWS(page.webSocketDebuggerUrl);
    let id = 0; const pend = {};
    ws.on((m) => { const o = JSON.parse(m); if (o.id && pend[o.id]) { pend[o.id](o); delete pend[o.id]; } });
    const cmd = (method, params) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result && r.result.result ? r.result.result.value : null; };
    await cmd('Runtime.enable');
    await cmd('Page.enable');

    // capture page errors
    const pageErrors = [];
    ws.on((m) => { const o = JSON.parse(m); if (o.method === 'Runtime.exceptionThrown') pageErrors.push(o.params.exceptionDetails.text || 'error'); });

    await sleep(1800); // let boot + loadModels finish

    // 1. Welcome renders with logo + credit
    const welcome = await ev(`document.body.innerText.includes('Run the whole business') && !!document.querySelector('img[src*="logo.svg"]') && document.body.innerText.includes('Illuminary Peak Company')`);
    welcome ? ok('welcome renders (logo + credit)') : fail('welcome renders (logo + credit)');

    // 2. Continue as guest → business setup wizard
    await ev(`document.querySelector('[data-act=guest]')?.click()`);
    let onSetup = false; for (let i = 0; i < 20; i++) { await sleep(300); if (await ev(`document.body.innerText.includes('Tell us about your business')`)) { onSetup = true; break; } }
    onSetup ? ok('guest → setup wizard') : fail('guest → setup wizard');

    // 3. Fill setup → into the app
    await ev(`(function(){document.querySelector('#suName').value='Smoke Store';var c=document.querySelector('#suCurrency');if(c)c.value='PHP';})()`);
    await ev(`document.querySelector('[data-act=finishSetup]')?.click()`);
    let inApp = false; for (let i = 0; i < 20; i++) { await sleep(300); if (await ev(`!!document.querySelector('.tabbar')`)) { inApp = true; break; } }
    inApp ? ok('setup → app (tab bar)') : fail('setup → app (tab bar)');

    // 3. Tab navigation across all five tabs (use data-tab, robust to badges)
    let tabsOk = true;
    for (const [tab, needle] of [['calc', 'Calculator'], ['hub', 'Idea Hub'], ['ai', 'AI Workspace'], ['agent', 'AgentTech'], ['stats', 'Revenue by channel']]) {
      await ev(`document.querySelector('.tabbar [data-tab=${tab}]')?.click()`);
      await sleep(250);
      const seen = await ev(`document.body.innerText.includes(${JSON.stringify(needle)})`);
      if (!seen) { tabsOk = false; console.log('    [debug] missing on', tab, JSON.stringify(await ev(`document.body.innerText.slice(0,60)`))); break; }
    }
    tabsOk ? ok('all five tabs navigate') : fail('all five tabs navigate');

    // 4. Calculator live math
    await ev(`document.querySelector('.tabbar [data-tab=calc]')?.click()`); await sleep(250);
    const priceBefore = await ev(`document.querySelector('.card.dark .big-num').textContent`);
    await ev(`(function(){var i=document.querySelector('.calc-input[data-k=markup]');i.value='60';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(150);
    const priceAfter = await ev(`document.querySelector('.card.dark .big-num').textContent`);
    (priceBefore !== priceAfter) ? ok('calculator recomputes on input') : fail('calculator recomputes on input', `${priceBefore} == ${priceAfter}`);

    // 4b. Inventory: Supply tab → add product → AI days-to-last prediction
    await ev(`[...document.querySelectorAll('[data-seg=calc] button')].find(b=>b.textContent.trim()==='Supply')?.click()`); await sleep(300);
    await ev(`document.querySelector('[data-act=addItem]')?.click()`); await sleep(350);
    await ev(`(function(){document.querySelector('#itName').value='Smoke Rice';document.querySelector('#itStock').value='100';document.querySelector('#itRate').value='5';})()`);
    await ev(`document.querySelector('#itSave')?.click()`);
    let inv = false; for (let i = 0; i < 25; i++) { await sleep(400); if (await ev(`document.body.innerText.includes('Smoke Rice') && /(days|weeks|months) left/.test(document.body.innerText)`)) { inv = true; break; } }
    inv ? ok('inventory add + days/weeks/months prediction') : fail('inventory add + days/weeks/months prediction');

    // 5. AgentTech drafts once, does not stack
    await ev(`document.querySelector('.tabbar [data-tab=agent]')?.click()`); await sleep(250);
    await ev(`document.querySelector('[data-act=agentDraft]').click()`);
    for (let i = 0; i < 20; i++) { await sleep(400); const n = await ev(`document.querySelectorAll('.bubble.ai').length`); if (n >= 1 && await ev(`!!document.querySelector('[data-act=approveSend]')`)) break; }
    await ev(`document.querySelector('[data-act=agentDraft]').click()`); await sleep(1500);
    const aiCount = await ev(`document.querySelectorAll('.bubble.ai').length`);
    (aiCount === 1) ? ok('AgentTech drafts exactly once') : fail('AgentTech drafts exactly once', 'count=' + aiCount);

    // 6. AI workspace generates a document
    await ev(`document.querySelector('.tabbar [data-tab=ai]')?.click()`); await sleep(300);
    await ev(`[...document.querySelectorAll('[data-act=runTask]')].find(x=>/Forecast/.test(x.textContent)).click()`);
    let gen = false; for (let i = 0; i < 20; i++) { await sleep(500); if (await ev(`!document.querySelector('.typing') && document.body.innerText.includes('Generated by')`)) { gen = true; break; } }
    gen ? ok('AI workspace produces output document') : fail('AI workspace produces output document');

    // 6a. Idea Hub: create + persist an idea (return from the AI output sub-screen first)
    await ev(`document.querySelector('[data-act=back]')?.click()`); await sleep(250);
    await ev(`document.querySelector('.tabbar [data-tab=hub]')?.click()`); await sleep(300);
    await ev(`document.querySelector('[data-act=newIdea]')?.click()`); await sleep(300);
    await ev(`(function(){var t=document.getElementById('ideaTitle');if(t)t.value='Smoke Idea';})()`);
    await ev(`document.getElementById('ideaSave')?.click()`); await sleep(600);
    const idea = await ev(`document.body.innerText.includes('Smoke Idea')`);
    idea ? ok('idea hub: create idea') : fail('idea hub: create idea');

    // 6b. Consumer app has no admin UI (separation)
    const noAdminUI = await ev(`!document.body.innerText.includes('Developer access') && !document.body.innerText.includes('Admin console')`);
    noAdminUI ? ok('consumer app has no admin UI') : fail('consumer app has no admin UI');

    // 7. Admin is a SEPARATE console at /admin — founder logs in with user + password
    await ev("location.href='/admin'"); await sleep(1500);
    const onLogin = await ev(`!!document.querySelector('#admU') && document.body.innerText.includes('Developer Console')`);
    onLogin ? ok('/admin is a separate console page') : fail('/admin is a separate console page');
    await ev(`(function(){var u=document.querySelector('#admU'),p=document.querySelector('#admP');if(u&&p){u.value='GenAdmin';p.value='genadmin-2026';document.querySelector('[data-a=login]').click();}})()`);
    let admin = false; for (let i = 0; i < 20; i++) { await sleep(400); if (await ev(`document.body.innerText.includes('Uptime') && document.body.innerText.includes('Run test call')`)) { admin = true; break; } }
    if (!admin) { console.log('    [debug] admin text:', JSON.stringify(await ev(`document.body.innerText.slice(0,120)`))); }
    admin ? ok('founder signs in to developer console') : fail('founder signs in to developer console');

    // 8. No uncaught page errors
    if (pageErrors.length) console.log('    [debug] page errors:', pageErrors.slice(0, 3));
    (pageErrors.length === 0) ? ok('no uncaught JS errors') : fail('no uncaught JS errors', pageErrors[0]);

  } catch (e) {
    fail('smoke run', e.message);
  } finally {
    try { browser && browser.kill('SIGKILL'); } catch { /* ignore */ }
    try { server.kill('SIGKILL'); } catch { /* ignore */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  const failed = results.filter(([p]) => !p).length;
  console.log(`\n  ${results.length - failed}/${results.length} browser checks passed`);
  process.exit(failed ? 1 : 0);
}
main();
