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
    const [scheme, n, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), salt, expected.length, { N: Number(n), r: R, p: P });
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

const emailOk = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passwordOk = (p) => typeof p === 'string' && p.length >= 8;

// Strip secret fields before sending a user to the client.
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...safe } = u;
  return safe;
}

module.exports = { hashPassword, verifyPassword, newId, newToken, newTag, emailOk, passwordOk, publicUser };
