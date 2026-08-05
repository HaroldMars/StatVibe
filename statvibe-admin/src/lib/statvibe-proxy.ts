/**
 * Optional proxy to the durable StatVibe API (source of truth for live checkout).
 * When STATVIBE_API_URL + STATVIBE_ADMIN_USER/PASSWORD are set, admin UI writes
 * go through the production store so pricing changes apply without redeploy.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function proxyStatvibeAdmin(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown } | null> {
  const base = (process.env.STATVIBE_API_URL || '').replace(/\/$/, '');
  if (!base) return null;

  const user = process.env.STATVIBE_ADMIN_USER || process.env.ADMIN_CEO_USERNAME;
  const pass = process.env.STATVIBE_ADMIN_PASSWORD || process.env.ADMIN_CEO_PASSWORD;
  if (!user || !pass) return null;

  try {
    if (!cachedToken || cachedToken.expiresAt < Date.now()) {
      const login = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const lj = await login.json();
      if (!login.ok || !lj.token) return null;
      cachedToken = { token: lj.token, expiresAt: Date.now() + 6 * 3600 * 1000 };
    }

    const r = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': cachedToken.token,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  } catch {
    return null;
  }
}
