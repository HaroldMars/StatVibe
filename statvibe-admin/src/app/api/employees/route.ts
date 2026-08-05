import { NextResponse } from 'next/server';
import { AuthError, requireCeo, requireSession } from '@/lib/auth';
import { createEmployee, listEmployees } from '@/lib/store';
import { maskName } from '@/lib/utils';

export async function GET() {
  try {
    await requireSession();
    const employees = await listEmployees();
    return NextResponse.json({
      employees: employees.map((e) => ({
        ...e,
        displayName: maskName(e.displayName),
      })),
    });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const ceo = await requireCeo();
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }
    const employee = await createEmployee({
      username,
      displayName: displayName || username,
      password,
      createdBy: ceo.username,
    });
    return NextResponse.json({
      employee: { ...employee, displayName: maskName(employee.displayName) },
    }, { status: 201 });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 400;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status });
  }
}
