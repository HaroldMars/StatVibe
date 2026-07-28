// StatVibe data store.
//
// A small async interface so the same server code runs on a local JSON store
// (dev / this machine) and, in production on Vercel, on Postgres/Supabase — you
// swap the implementation via DATABASE_URL without touching the API handlers.
//
// This file is the JSON implementation used when no DATABASE_URL is set. It is
// process-local and writes atomically. For Vercel, add lib/store.postgres.js
// (same method names) and select it in index below. See ROADMAP.md.

const fs = require('fs');
const path = require('path');

// DB path is overridable via STATVIBE_DB (used by tests for isolation).
const DB_FILE = process.env.STATVIBE_DB ? path.resolve(process.env.STATVIBE_DB) : path.join(__dirname, '..', 'data', 'db.json');
const DATA_DIR = path.dirname(DB_FILE);

const EMPTY = { users: {}, byEmail: {}, byPhone: {}, byTag: {}, sessions: {}, accounts: {}, inventory: {}, ideas: {}, aiHistory: {}, admins: {}, adminSessions: {} };

function load() {
  try { return { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
  catch { return JSON.parse(JSON.stringify(EMPTY)); }
}

let db = load();
let saving = null, saveAgain = false;

function persist() {
  // Coalesce concurrent writes; write to a temp file then rename (atomic).
  if (saving) { saveAgain = true; return saving; }
  saving = (async () => {
    do {
      saveAgain = false;
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const tmp = DB_FILE + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(db));
        fs.renameSync(tmp, DB_FILE);
      } catch (e) { /* best effort */ }
    } while (saveAgain);
    saving = null;
  })();
  return saving;
}

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

const store = {
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
    for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === id) delete db.sessions[tok];
    await persist();
  },

  // --- sessions ---
  async createSession(session) { db.sessions[session.token] = session; await persist(); return clone(session); },
  async getSession(token) { const s = db.sessions[token]; if (!s) return null; if (s.expiresAt && s.expiresAt < Date.now()) { delete db.sessions[token]; await persist(); return null; } return clone(s); },
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

  // --- directory / admin visibility ---
  async listUsers() { return Object.values(db.users).map((u) => { const { passwordHash, ...safe } = u; return clone(safe); }); },
  async countUsers() { return Object.keys(db.users).length; },
  async activeSessionUserCount(sinceMs) { const cut = Date.now() - sinceMs; const ids = new Set(); for (const s of Object.values(db.sessions)) if (s.createdAt >= cut) ids.add(s.userId); return ids.size; },
  async accountsMap() { return clone(db.accounts); },
  async inventoryCount(userId) { return (db.inventory[userId] || []).length; },

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
  _reset() { db = JSON.parse(JSON.stringify(EMPTY)); return persist(); },
};

module.exports = store;
