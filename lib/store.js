// StatVibe data store — pluggable backend, same async interface either way:
//   1. Vercel KV / Upstash Redis when KV_REST_API_* or UPSTASH_REDIS_REST_* is set
//   2. Cloudinary raw asset when CLOUDINARY_* is set on Vercel (durable fallback)
//   3. Local JSON file otherwise — ./data locally, /tmp on serverless (EPHEMERAL)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKV = !!(KV_URL && KV_TOKEN);
const KV_KEY = 'statvibe:db';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const onServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const forceCloudStore = process.env.STATVIBE_CLOUD_STORE === '1';
const useCloudinary = !useKV && !!(CLOUD_NAME && CLOUD_KEY && CLOUD_SECRET) && (onServerless || forceCloudStore);
const CLOUD_PUBLIC_ID = 'statvibe_db';

const DB_FILE = process.env.STATVIBE_DB
  ? path.resolve(process.env.STATVIBE_DB)
  : onServerless
    ? path.join(require('os').tmpdir(), 'statvibe-db.json')
    : path.join(__dirname, '..', 'data', 'db.json');
const DATA_DIR = path.dirname(DB_FILE);

const EMPTY = { users: {}, byEmail: {}, byPhone: {}, byTag: {}, sessions: {}, accounts: {}, inventory: {}, ideas: {}, aiHistory: {}, conversations: {}, messages: {}, payments: [], admins: {}, adminSessions: {} };
const fresh = () => JSON.parse(JSON.stringify(EMPTY));

let db = fresh();

function backendInfo() {
  if (useKV) return { kind: 'kv', durable: true };
  if (useCloudinary) return { kind: 'cloudinary', durable: true, publicId: CLOUD_PUBLIC_ID };
  return { kind: onServerless ? 'tmp' : 'file', durable: !onServerless, path: DB_FILE };
}

function rebuildIndexes(d) {
  d.byEmail = {};
  d.byPhone = {};
  d.byTag = {};
  for (const u of Object.values(d.users || {})) {
    if (u.email) d.byEmail[String(u.email).toLowerCase()] = u.id;
    if (u.phone) d.byPhone[String(u.phone)] = u.id;
    if (u.tag) d.byTag[String(u.tag).toLowerCase()] = u.id;
  }
}

/** Merge so concurrent serverless instances don't wipe each other's sessions/data. */
function mergePreferLocal(local, remote) {
  if (!remote) return local;
  const out = fresh();
  out.users = { ...(remote.users || {}), ...(local.users || {}) };
  out.sessions = { ...(remote.sessions || {}), ...(local.sessions || {}) };
  out.accounts = { ...(remote.accounts || {}), ...(local.accounts || {}) };
  out.admins = { ...(remote.admins || {}), ...(local.admins || {}) };
  out.adminSessions = { ...(remote.adminSessions || {}), ...(local.adminSessions || {}) };
  out.conversations = { ...(remote.conversations || {}), ...(local.conversations || {}) };
  // Per-user lists: local copy is authoritative for keys present locally (after reload + mutate).
  out.inventory = { ...(remote.inventory || {}) };
  for (const [uid, list] of Object.entries(local.inventory || {})) out.inventory[uid] = list;
  out.ideas = { ...(remote.ideas || {}) };
  for (const [uid, list] of Object.entries(local.ideas || {})) out.ideas[uid] = list;
  out.aiHistory = { ...(remote.aiHistory || {}) };
  for (const [uid, list] of Object.entries(local.aiHistory || {})) out.aiHistory[uid] = list;
  out.messages = { ...(remote.messages || {}) };
  for (const [cid, list] of Object.entries(local.messages || {})) out.messages[cid] = list;
  const payMap = new Map();
  for (const p of (remote.payments || [])) if (p && p.id) payMap.set(p.id, p);
  for (const p of (local.payments || [])) if (p && p.id) payMap.set(p.id, p);
  out.payments = [...payMap.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 500);
  // Drop expired sessions during merge.
  const now = Date.now();
  for (const [t, s] of Object.entries(out.sessions)) {
    if (s && s.expiresAt && s.expiresAt < now) delete out.sessions[t];
  }
  rebuildIndexes(out);
  return out;
}

async function loadRemoteDb() {
  if (useKV) {
    const v = await kvCmd(['GET', KV_KEY]);
    if (!v) return null;
    return { ...fresh(), ...JSON.parse(v) };
  }
  if (useCloudinary) {
    const v = await cloudinaryLoad();
    if (!v) return null;
    return { ...fresh(), ...v };
  }
  try { return { ...fresh(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
  catch { return null; }
}

async function reloadFromBackend() {
  try {
    const remote = await loadRemoteDb();
    if (remote) db = remote;
  } catch (e) {
    console.error('[store] reload failed (' + backendInfo().kind + '):', e.message);
  }
}

// Upstash/Vercel KV REST — command-array protocol, fetch-based (Node 18+).
async function kvCmd(cmd) {
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('KV ' + r.status);
  return (await r.json()).result;
}

function cloudSign(params) {
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + CLOUD_SECRET;
  return crypto.createHash('sha1').update(toSign).digest('hex');
}

async function cloudinaryLoad() {
  // Cache-bust so CDN does not serve a stale DB after persist.
  const url = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${CLOUD_PUBLIC_ID}?_=${Date.now()}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Cloudinary GET ' + r.status);
  const text = await r.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

async function cloudinarySave(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: true, overwrite: true, public_id: CLOUD_PUBLIC_ID, timestamp };
  const signature = cloudSign(params);
  const form = new FormData();
  form.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }), CLOUD_PUBLIC_ID + '.json');
  form.append('api_key', CLOUD_KEY);
  form.append('timestamp', String(timestamp));
  form.append('public_id', CLOUD_PUBLIC_ID);
  form.append('overwrite', 'true');
  form.append('invalidate', 'true');
  form.append('signature', signature);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, { method: 'POST', body: form });
  if (!r.ok) {
    const err = await r.text().catch(() => '');
    throw new Error('Cloudinary upload ' + r.status + (err ? ': ' + err.slice(0, 200) : ''));
  }
}

// Initial load. Every public method awaits `ready` (via the Proxy) before it
// touches `db`, so this can be async without any ordering bugs.
const ready = (async () => {
  try {
    if (useKV) {
      const v = await kvCmd(['GET', KV_KEY]);
      if (v) db = { ...fresh(), ...JSON.parse(v) };
    } else if (useCloudinary) {
      const v = await cloudinaryLoad();
      if (v) db = { ...fresh(), ...v };
    } else {
      try { db = { ...fresh(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { /* first run */ }
    }
  } catch (e) {
    console.error('[store] load failed (' + backendInfo().kind + '):', e.message);
  }
  console.log('[store] backend=' + backendInfo().kind + ' durable=' + backendInfo().durable);
})();

let saving = null, saveAgain = false, persistError = null;
function persist() {
  // Coalesce concurrent writes within this isolate.
  if (saving) { saveAgain = true; return saving; }
  persistError = null;
  saving = (async () => {
    do {
      saveAgain = false;
      try {
        // Re-read durable store and merge so another lambda's login/session isn't wiped.
        if (useKV || useCloudinary || onServerless) {
          try {
            const remote = await loadRemoteDb();
            if (remote) db = mergePreferLocal(db, remote);
          } catch (e) {
            console.error('[store] merge-before-save failed:', e.message);
          }
        }
        if (useKV) {
          await kvCmd(['SET', KV_KEY, JSON.stringify(db)]);
        } else if (useCloudinary) {
          await cloudinarySave(db);
        } else {
          fs.mkdirSync(DATA_DIR, { recursive: true });
          const tmp = DB_FILE + '.' + process.pid + '.tmp';
          fs.writeFileSync(tmp, JSON.stringify(db));
          fs.renameSync(tmp, DB_FILE);
        }
      } catch (e) {
        console.error('[store] persist failed:', e.message);
        persistError = e;
      }
    } while (saveAgain);
    saving = null;
    if (persistError) throw persistError;
  })();
  return saving;
}

/** Serialize store ops so reload→mutate→persist can't clobber in-flight writes in one isolate. */
let opChain = Promise.resolve();
function withLock(fn) {
  const run = opChain.then(fn, fn);
  opChain = run.then(() => {}, () => {});
  return run;
}

const TOUCH_PERSIST_MS = 60 * 60 * 1000; // persist sliding TTL at most hourly per session

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

const store = {
  backend() { return backendInfo(); },
  async reload() { await reloadFromBackend(); return backendInfo(); },

  // --- users ---
  async getUserById(id) { return clone(db.users[id]) || null; },
  async getUserByEmail(email) { const id = db.byEmail[String(email).toLowerCase()]; return id ? clone(db.users[id]) : null; },
  async getUserByPhone(phone) { const id = db.byPhone[String(phone)]; return id ? clone(db.users[id]) : null; },
  async getUserByTag(tag) { const id = db.byTag[String(tag).toLowerCase()]; return id ? clone(db.users[id]) : null; },
  async createUser(user) {
    db.users[user.id] = user;
    if (user.email) db.byEmail[user.email.toLowerCase()] = user.id;
    if (user.phone) db.byPhone[user.phone] = user.id;
    if (user.tag) db.byTag[user.tag.toLowerCase()] = user.id;
    await persist();
    return clone(user);
  },
  async updateUser(id, patch) {
    const u = db.users[id]; if (!u) return null;
    if (patch.email && patch.email !== u.email) { if (u.email) delete db.byEmail[u.email.toLowerCase()]; db.byEmail[patch.email.toLowerCase()] = id; }
    Object.assign(u, patch); await persist(); return clone(u);
  },
  async deleteUser(id) {
    const u = db.users[id]; if (!u) return;
    if (u.email) delete db.byEmail[u.email.toLowerCase()];
    if (u.phone) delete db.byPhone[u.phone];
    if (u.tag) delete db.byTag[u.tag.toLowerCase()];
    delete db.users[id]; delete db.accounts[id]; delete db.inventory[id];
    delete db.ideas[id]; delete db.aiHistory[id];
    for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === id) delete db.sessions[tok];
    // Drop conversations/messages that involve this user; keep payment rows anonymized.
    for (const [cid, c] of Object.entries({ ...db.conversations })) {
      if ((c.participants || []).includes(id)) {
        delete db.conversations[cid];
        delete db.messages[cid];
      }
    }
    for (const p of (db.payments || [])) if (p.userId === id) { p.userId = null; p.email = null; p.name = '[deleted]'; }
    await persist();
  },

  // --- sessions ---
  async createSession(session) { db.sessions[session.token] = session; await persist(); return clone(session); },
  async getSession(token) {
    const s = db.sessions[token];
    if (!s) return null;
    if (s.expiresAt && s.expiresAt < Date.now()) { delete db.sessions[token]; await persist(); return null; }
    return clone(s);
  },
  async touchSession(token, expiresAt) {
    const s = db.sessions[token];
    if (!s) return null;
    const now = Date.now();
    const prevSeen = s.lastSeenAt || 0;
    s.expiresAt = expiresAt;
    s.lastSeenAt = now;
    // Avoid rewriting the whole DB on every authenticated request (cuts Cloudinary races).
    if (now - prevSeen >= TOUCH_PERSIST_MS) await persist();
    return clone(s);
  },
  async deleteSession(token) { delete db.sessions[token]; await persist(); },
  async deleteSessionsForUser(id) { for (const [t, s] of Object.entries(db.sessions)) if (s.userId === id) delete db.sessions[t]; await persist(); },

  // --- account (business profile / setup) ---
  async getAccount(userId) { return clone(db.accounts[userId]) || null; },
  async setAccount(userId, account) { db.accounts[userId] = account; await persist(); return clone(account); },

  // --- inventory ---
  async listInventory(userId) { return clone(db.inventory[userId] || []); },
  async addInventory(userId, item) { (db.inventory[userId] ||= []).push(item); await persist(); return clone(item); },
  async updateInventory(userId, itemId, patch) {
    const list = db.inventory[userId] || []; const it = list.find((x) => x.id === itemId); if (!it) return null;
    Object.assign(it, patch); await persist(); return clone(it);
  },
  async deleteInventory(userId, itemId) { db.inventory[userId] = (db.inventory[userId] || []).filter((x) => x.id !== itemId); await persist(); },

  // --- idea hub ---
  async listIdeas(userId) { return clone(db.ideas[userId] || []); },
  async addIdea(userId, idea) { (db.ideas[userId] ||= []).unshift(idea); await persist(); return clone(idea); },
  async updateIdea(userId, id, patch) { const it = (db.ideas[userId] || []).find((x) => x.id === id); if (!it) return null; Object.assign(it, patch, { updatedAt: Date.now() }); await persist(); return clone(it); },
  async deleteIdea(userId, id) { db.ideas[userId] = (db.ideas[userId] || []).filter((x) => x.id !== id); await persist(); },

  // --- AI workspace history ---
  async listHistory(userId) { return clone(db.aiHistory[userId] || []); },
  async addHistory(userId, entry) { const list = (db.aiHistory[userId] ||= []); list.unshift(entry); if (list.length > 50) list.length = 50; await persist(); return clone(entry); },
  async clearHistory(userId) { db.aiHistory[userId] = []; await persist(); },

  // --- messaging (real cross-user chat) ---
  async getConversationsFor(uid) { return Object.values(db.conversations).filter((c) => c.participants.includes(uid)).map(clone); },
  async findConversation(a, b) { const pair = [a, b].sort().join('|'); return clone(Object.values(db.conversations).find((c) => [...c.participants].sort().join('|') === pair)) || null; },
  async getConversation(id) { return clone(db.conversations[id]) || null; },
  async saveConversation(conv) { db.conversations[conv.id] = conv; await persist(); return clone(conv); },
  async listMessages(convId) { return clone(db.messages[convId] || []); },
  async addMessage(convId, msg) {
    (db.messages[convId] ||= []).push(msg);
    const c = db.conversations[convId];
    if (c) { c.lastText = msg.text; c.lastAt = msg.at; c.lastSender = msg.from; c.updatedAt = msg.at; }
    await persist(); return clone(msg);
  },
  async markConversationRead(convId, uid) {
    const c = db.conversations[convId];
    if (c) {
      const msgs = db.messages[convId] || [];
      const maxAt = msgs.length ? Math.max(...msgs.map((m) => m.at)) : Date.now();
      (c.read ||= {})[uid] = maxAt;
      await persist();
    }
  },

  // --- directory / admin visibility (privacy-safe — no passwords, messages, AI content) ---
  async listUsers() { return Object.values(db.users).map((u) => { const { passwordHash, phone, ...safe } = u; return clone(safe); }); },
  async countUsers() { return Object.keys(db.users).length; },
  async activeSessionUserCount(sinceMs) {
    const cut = Date.now() - sinceMs;
    const ids = new Set();
    for (const s of Object.values(db.sessions)) {
      const t = s.lastSeenAt || s.createdAt;
      if (t >= cut) ids.add(s.userId);
    }
    return ids.size;
  },
  async accountsMap() { return clone(db.accounts); },
  async inventoryCount(userId) { return (db.inventory[userId] || []).length; },
  async adminUserStats() {
    const users = Object.values(db.users);
    const accounts = db.accounts || {};
    let registered = 0, guests = 0, setupComplete = 0;
    const byPlan = { Free: 0, Pro: 0, Business: 0, Enterprise: 0, Other: 0 };
    const dayMs = 86400000;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const signups = [];
    for (let i = 13; i >= 0; i--) {
      const start = today.getTime() - i * dayMs;
      const end = start + dayMs;
      const count = users.filter((u) => u.createdAt >= start && u.createdAt < end).length;
      signups.push({ t: start, count });
    }
    for (const u of users) {
      if (u.isGuest) guests++; else registered++;
      const a = accounts[u.id];
      if (a && a.setupComplete) setupComplete++;
      const plan = (a && a.plan) || 'Free';
      if (byPlan[plan] !== undefined) byPlan[plan]++; else byPlan.Other++;
    }
    return {
      total: users.length,
      registered,
      guests,
      setupComplete,
      byPlan,
      signups,
      active_24h: await this.activeSessionUserCount(dayMs),
      active_7d: await this.activeSessionUserCount(7 * dayMs),
    };
  },

  // --- payments / plan upgrades (ops visibility only — no card/PII payloads) ---
  async addPayment(row) {
    (db.payments ||= []).unshift(row);
    if (db.payments.length > 500) db.payments.length = 500;
    await persist();
    return clone(row);
  },
  async findPaymentBySourceId(sourceId) {
    if (!sourceId) return null;
    return clone((db.payments || []).find((p) => p.sourceId === sourceId) || null);
  },
  async updatePayment(id, patch) {
    const it = (db.payments || []).find((p) => p.id === id);
    if (!it) return null;
    Object.assign(it, patch);
    await persist();
    return clone(it);
  },
  async listPayments(limit = 50) {
    return clone((db.payments || []).slice(0, limit));
  },
  async paymentStats() {
    const list = db.payments || [];
    const paid = list.filter((p) => p.status === 'paid' || p.status === 'demo');
    const byPlan = {};
    let revenue = 0;
    for (const p of paid) {
      byPlan[p.plan || 'Unknown'] = (byPlan[p.plan || 'Unknown'] || 0) + 1;
      revenue += Number(p.amount) || 0;
    }
    return { total: list.length, paid: paid.length, revenue, byPlan };
  },

  // --- admin accounts (developers) ---
  async countAdmins() { return Object.keys(db.admins).length; },
  async getAdminByUsername(username) { const a = db.admins[String(username).toLowerCase()]; return a ? clone(a) : null; },
  async createAdmin(admin) { db.admins[admin.username.toLowerCase()] = admin; await persist(); return clone(admin); },
  async listAdmins() { return Object.values(db.admins).map((a) => { const { passwordHash, ...safe } = a; return clone(safe); }); },
  async deleteAdmin(username) { delete db.admins[String(username).toLowerCase()]; for (const [t, s] of Object.entries(db.adminSessions)) if (s.username === String(username).toLowerCase()) delete db.adminSessions[t]; await persist(); },
  async createAdminSession(s) { db.adminSessions[s.token] = s; await persist(); return clone(s); },
  async getAdminSession(token) { const s = db.adminSessions[token]; if (!s) return null; if (s.expiresAt && s.expiresAt < Date.now()) { delete db.adminSessions[token]; await persist(); return null; } return clone(s); },
  async deleteAdminSession(token) { delete db.adminSessions[token]; await persist(); },

  // maintenance
  async purgeExpiredGuests(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    for (const u of Object.values({ ...db.users })) if (u.isGuest && u.createdAt < cutoff) await this.deleteUser(u.id);
  },
  _reset() { db = fresh(); return persist(); },
};

// Proxy so every method awaits the initial load, then reloads from the durable
// backend under a lock. Serverless isolates otherwise keep a stale in-memory copy
// and return "Not signed in" for valid tokens created on another instance.
module.exports = new Proxy(store, {
  get(target, prop) {
    const v = target[prop];
    if (typeof v !== 'function') return v;
    if (prop === 'backend' || prop === 'reload' || prop === '_reset') {
      return async (...args) => { await ready; return v.apply(target, args); };
    }
    return async (...args) => withLock(async () => {
      await ready;
      // Durable backends: refresh before read/write so auth/inventory stay in sync.
      if (useKV || useCloudinary) await reloadFromBackend();
      return v.apply(target, args);
    });
  },
});
