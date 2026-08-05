import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import type { AdminRole } from './rbac';
import { ROLES } from './rbac';

export const SESSION_COOKIE = 'sv_admin_session';
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 8;

type RateBucket = { count: number; resetAt: number };
const loginAttempts = new Map<string, RateBucket>();

function secretKey() {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'dev-statvibe-admin-secret-change-me';
  return new TextEncoder().encode(secret);
}

export type SessionAdmin = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function checkLoginRateLimit(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = loginAttempts.get(key);
  if (!bucket || bucket.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_MAX) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

export function clearLoginRateLimit(key: string) {
  loginAttempts.delete(key);
}

export async function signSession(admin: SessionAdmin) {
  return new SignJWT({
    sub: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    role: admin.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionAdmin | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.username !== 'string') return null;
    const role = payload.role === ROLES.CEO_FOUNDER ? ROLES.CEO_FOUNDER : ROLES.EMPLOYEE;
    return {
      id: String(payload.sub),
      username: payload.username,
      displayName: typeof payload.displayName === 'string' ? payload.displayName : payload.username,
      role,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionAdmin | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionAdmin> {
  const session = await getSession();
  if (!session) throw new AuthError('Unauthorized', 401);
  return session;
}

export async function requireCeo(): Promise<SessionAdmin> {
  const session = await requireSession();
  if (session.role !== ROLES.CEO_FOUNDER) throw new AuthError('CEO_FOUNDER role required', 403);
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function sessionCookieOptions(token: string) {
  const secure = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 12,
  };
}
