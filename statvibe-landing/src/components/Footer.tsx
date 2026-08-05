'use client';

import { useEffect, useState } from 'react';
import { getClientBase } from '@/lib/urls';
import { BrandLogo } from '@/components/BrandLogo';

type StatusState = 'checking' | 'online' | 'degraded';

export function Footer() {
  const [status, setStatus] = useState<StatusState>('checking');
  const year = new Date().getFullYear();
  const client = getClientBase();

  useEffect(() => {
    let cancelled = false;
    const api = process.env.NEXT_PUBLIC_API_URL || 'https://statvibe-server.vercel.app';
    const probe = async () => {
      try {
        const r = await fetch(`${api.replace(/\/$/, '')}/api/health`, { cache: 'no-store' });
        if (!cancelled) setStatus(r.ok ? 'online' : 'degraded');
      } catch {
        try {
          const r2 = await fetch(`${client}/api/health`, { cache: 'no-store' });
          if (!cancelled) setStatus(r2.ok ? 'online' : 'degraded');
        } catch {
          if (!cancelled) setStatus('degraded');
        }
      }
    };
    probe();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const statusLabel =
    status === 'online' ? 'All systems nominal' : status === 'checking' ? 'Checking status…' : 'Status unknown';

  return (
    <footer className="border-t border-leaf-800/10 bg-cream/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <BrandLogo size={28} />
          <p className="mt-3 max-w-xs text-sm text-moss-500">
            A project of Illuminary Peak Company. Analytics with a pulse.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-leaf-800/10 bg-white/70 px-3 py-1.5 text-xs text-moss-500">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'online'
                  ? 'bg-leaf-600'
                  : status === 'checking'
                    ? 'animate-pulse bg-amber-500'
                    : 'bg-moss-400'
              }`}
              aria-hidden
            />
            {statusLabel}
          </div>
        </div>

        <div className="flex flex-wrap gap-10 text-sm">
          <div>
            <p className="mb-2 font-medium text-leaf-950">Legal</p>
            <ul className="space-y-1.5 text-moss-500">
              <li>
                <a className="hover:text-leaf-600" href={`${client}/privacy`}>
                  Privacy
                </a>
              </li>
              <li>
                <a className="hover:text-leaf-600" href={`${client}/terms`}>
                  Terms
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-medium text-leaf-950">Social</p>
            <ul className="space-y-1.5 text-moss-500">
              <li>
                <a
                  className="hover:text-leaf-600"
                  href="https://www.facebook.com/people/StatVibe/61592473247244/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook · StatVibe
                </a>
              </li>
              <li>
                <a
                  className="hover:text-leaf-600"
                  href="https://www.instagram.com/statvibe_beta"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram · StatVibe Beta
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-leaf-800/10 py-4 text-center text-xs text-moss-400">
        © {year} StatVibe · Illuminary Peak
      </div>
    </footer>
  );
}
