// StatVibe auth primitives — password hashing + tokens.
// Uses node:crypto only. Passwords are never stored or returned in plaintext.

const crypto = require('crypto');

// scrypt password hashing with a per-user random salt. Format: scrypt$N$salt$hash
const N = 16384, R = 8, P = 1, KEYLEN = 32;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    if (typeof password !== 'string' || typeof stored !== 'string' || !stored) return false;
    const [scheme, n, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    // Reject empty / truncated hashes so a malformed record can never match.
    if (salt.length < 8 || expected.length < 16) return false;
    const cost = Number(n);
    if (!Number.isFinite(cost) || cost < 1024) return false;
    const actual = crypto.scryptSync(password, salt, expected.length, { N: cost, r: R, p: P });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

const newId = (prefix = 'u') => prefix + '_' + crypto.randomBytes(9).toString('base64url');
const newToken = () => crypto.randomBytes(32).toString('base64url');

// Short, human-shareable StatVibe tag used for QR / contact lookup (e.g. SV-7F3K9Q).
function newTag() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[crypto.randomInt(abc.length)];
  return 'SV-' + s;
}

const emailOk = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
/** At least 8 chars with a letter and a number — common consumer-app bar. */
const passwordOk = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 200
  && /[A-Za-z]/.test(p) && /\d/.test(p);
const normalizeEmail = (e) => (typeof e === 'string' ? e.trim().toLowerCase() : '');
const passwordHint = 'Use at least 8 characters with a letter and a number';

/** True only for real registered accounts (not guests). */
function isRegisteredUser(u) {
  return !!(u && !u.isGuest && u.email && u.passwordHash);
}

// Strip secret fields before sending a user to the client.
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...safe } = u;
  return safe;
}

module.exports = {
  hashPassword, verifyPassword, newId, newToken, newTag,
  emailOk, passwordOk, passwordHint, normalizeEmail, isRegisteredUser, publicUser,
};
