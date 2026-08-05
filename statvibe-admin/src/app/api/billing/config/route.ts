import { NextResponse } from 'next/server';
import { AuthError, requireSession } from '@/lib/auth';
import { getSubscriptionsConfig, setSubscriptionsConfig } from '@/lib/store';
import { proxyStatvibeAdmin } from '@/lib/statvibe-proxy';

export async function GET() {
  try {
    await requireSession();
    const proxied = await proxyStatvibeAdmin('GET', '/api/admin/billing/subscriptions-config');
    if (proxied) return NextResponse.json(proxied.data, { status: proxied.status });
    return NextResponse.json(await getSubscriptionsConfig());
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    await requireSession();
    const body = await req.json();
    const proxied = await proxyStatvibeAdmin('PUT', '/api/admin/billing/subscriptions-config', body);
    if (proxied) return NextResponse.json(proxied.data, { status: proxied.status });
    return NextResponse.json(await setSubscriptionsConfig(body));
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}
