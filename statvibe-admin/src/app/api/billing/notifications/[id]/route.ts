import { NextResponse } from 'next/server';
import { AuthError, requireSession } from '@/lib/auth';
import { deleteSystemNotification } from '@/lib/store';
import { proxyStatvibeAdmin } from '@/lib/statvibe-proxy';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const proxied = await proxyStatvibeAdmin('DELETE', `/api/admin/notifications/${id}`);
    if (proxied) return NextResponse.json(proxied.data, { status: proxied.status });
    await deleteSystemNotification(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}
