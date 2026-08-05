import { NextResponse } from 'next/server';
import { AuthError, requireSession } from '@/lib/auth';
import { listUsers, setUserStatus } from '@/lib/store';
import { maskName } from '@/lib/utils';
import type { UserStatus } from '@/lib/rbac';

export async function GET(req: Request) {
  try {
    await requireSession();
    const q = new URL(req.url).searchParams.get('q') || '';
    const users = await listUsers(q);
    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        name: maskName(u.name),
        nameRawHidden: true,
      })),
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireSession();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '');
    const status = String(body.status || '') as UserStatus;
    if (!id || !['PENDING', 'APPROVED', 'SUSPENDED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid id or status' }, { status: 400 });
    }
    const user = await setUserStatus(id, status);
    return NextResponse.json({
      user: { ...user, name: maskName(user.name), nameRawHidden: true },
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}
