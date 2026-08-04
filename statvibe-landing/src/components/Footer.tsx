'use client';

import { useEffect, useState } from 'react';
import { getClientBase } from '@/lib/urls';

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
        const r = await fetch(`${api.replace(/\/$/, '')}/api/health`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!cancelled) setStatus(r.ok ? 'online' : 'degraded');
      } catch {
        // Fall back to client origin health (combined deploys)
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
    <footer className="border-t border-white/5 bg-ink-950/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-white">StatVibe</p>
          <p className="mt-1 max-w-xs text-sm text-mist-500">
            A project of Illuminary Peak Company. Analytics with a pulse.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-mist-300">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'online'
                  ? 'bg-signal shadow-[0_0_8px_rgba(45,212,191,0.8)]'
                  : status === 'checking'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-mist-500'
              }`}
              aria-hidden
            />
            {statusLabel}
          </div>
        </div>

        <div className="flex flex-wrap gap-10 text-sm">
          <div>
            <p className="mb-2 font-medium text-mist-100">Legal</p>
            <ul className="space-y-1.5 text-mist-500">
              <li>
                <a className="hover:text-signal" href={`${client}/privacy`}>
                  Privacy
                </a>
              </li>
              <li>
                <a className="hover:text-signal" href={`${client}/terms`}>
                  Terms
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-medium text-mist-100">Social</p>
            <ul className="space-y-1.5 text-mist-500">
              <li>
                <a
                  className="hover:text-signal"
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  X / Twitter
                </a>
              </li>
              <li>
                <a
                  className="hover:text-signal"
                  href="https://github.com/HaroldMars/StatVibe"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  className="hover:text-signal"
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-mist-500">
        © {year} StatVibe · Illuminary Peak
      </div>
    </footer>
  );
}
