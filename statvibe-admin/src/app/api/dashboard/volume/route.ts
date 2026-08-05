import { NextResponse } from 'next/server';
import { AuthError, requireSession } from '@/lib/auth';
import { volumeSeries, type RangeKey } from '@/lib/analytics';

export async function GET(req: Request) {
  try {
    await requireSession();
    const range = (new URL(req.url).searchParams.get('range') || 'month') as RangeKey;
    const allowed: RangeKey[] = ['day', 'week', 'month', 'year'];
    const key = allowed.includes(range) ? range : 'month';
    return NextResponse.json({ range: key, series: await volumeSeries(key) });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}
