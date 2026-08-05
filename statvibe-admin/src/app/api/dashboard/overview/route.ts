import { NextResponse } from 'next/server';
import { AuthError, requireSession } from '@/lib/auth';
import { getOverview } from '@/lib/store';

export async function GET() {
  try {
    await requireSession();
    const overview = await getOverview();
    return NextResponse.json(overview);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status });
  }
}
