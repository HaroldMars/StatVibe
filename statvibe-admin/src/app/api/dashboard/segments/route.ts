import { NextResponse } from 'next/server';
import { AuthError, requireSession } from '@/lib/auth';
import { userSegments } from '@/lib/analytics';

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({ segments: await userSegments() });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}
