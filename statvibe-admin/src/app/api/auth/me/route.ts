import { NextResponse } from 'next/server';
import { AuthError, getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ admin: session });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }
}
