import { NextResponse } from 'next/server';
import {
  AuthError,
  checkLoginRateLimit,
  clearLoginRateLimit,
  sessionCookieOptions,
  signSession,
  verifyPassword,
} from '@/lib/auth';
import { findAdminByUsername } from '@/lib/store';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const rateKey = `${ip}:${username.toLowerCase()}`;
    const rate = checkLoginRateLimit(rateKey);
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.', retryAfterSec: rate.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    const admin = await findAdminByUsername(username);
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    clearLoginRateLimit(rateKey);
    const token = await signSession({
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
    });

    const res = NextResponse.json({
      ok: true,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
      },
    });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
