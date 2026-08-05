import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canManageEmployees } from '@/lib/rbac';
import { LogoutButton } from '@/components/dashboard/logout-button';
import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/users', label: 'Users' },
  { href: '/dashboard/transactions', label: 'Transactions' },
  { href: '/dashboard/pricing', label: 'Pricing' },
  { href: '/dashboard/announcements', label: 'Announcements' },
  { href: '/dashboard/employees', label: 'Employees', ceoOnly: true },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-[#f5f7fc] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-[#dde3f5] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#5865f2] text-sm font-bold text-white">SV</div>
            <div>
              <div className="text-sm font-semibold tracking-tight">StatVibe Admin</div>
              <div className="text-xs text-slate-500">
                {session.displayName} · {session.role === 'CEO_FOUNDER' ? 'CEO / Founder' : 'Employee'}
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {links
              .filter((l) => !l.ceoOnly || canManageEmployees(session.role))
              .map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {l.label}
                </Link>
              ))}
          </nav>
          <LogoutButton />
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {links
            .filter((l) => !l.ceoOnly || canManageEmployees(session.role))
            .map((l) => (
              <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {l.label}
              </Link>
            ))}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
