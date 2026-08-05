import { NextResponse } from 'next/server';
import { AuthError, requireSession } from '@/lib/auth';
import { createSystemNotification, listSystemNotifications } from '@/lib/store';
import { proxyStatvibeAdmin } from '@/lib/statvibe-proxy';

export async function GET() {
  try {
    await requireSession();
    const proxied = await proxyStatvibeAdmin('GET', '/api/admin/notifications');
    if (proxied) return NextResponse.json(proxied.data, { status: proxied.status });
    return NextResponse.json({ notifications: await listSystemNotifications() });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = await req.json();
    const proxied = await proxyStatvibeAdmin('POST', '/api/admin/notifications', body);
    if (proxied) return NextResponse.json(proxied.data, { status: proxied.status });
    if (!body?.title || !body?.body) {
      return NextResponse.json({ error: 'title and body required' }, { status: 400 });
    }
    const notification = await createSystemNotification(body);
    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}
