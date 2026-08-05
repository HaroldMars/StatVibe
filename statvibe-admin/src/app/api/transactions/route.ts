import { NextResponse } from 'next/server';
import { AuthError, requireSession } from '@/lib/auth';
import { listTransactions } from '@/lib/store';
import { maskName } from '@/lib/utils';

export async function GET() {
  try {
    await requireSession();
    const transactions = await listTransactions();
    const succeeded = transactions.filter((t) => t.status === 'succeeded');
    const revenue = succeeded.reduce((s, t) => s + t.amount, 0);
    const byPlan = {
      Free: succeeded.filter((t) => t.plan === 'Free').length,
      Pro: succeeded.filter((t) => t.plan === 'Pro').length,
      Enterprise: succeeded.filter((t) => t.plan === 'Enterprise').length,
    };
    return NextResponse.json({
      metrics: {
        count: transactions.length,
        succeeded: succeeded.length,
        revenueCents: revenue,
        byPlan,
      },
      transactions: transactions.map((t) => ({
        ...t,
        userName: maskName(t.userName),
      })),
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}
