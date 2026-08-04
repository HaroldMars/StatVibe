'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useDeviceRedirect } from '@/hooks/useDeviceRedirect';

export function Navbar() {
  const { openLaunch, openGetStarted, ready } = useDeviceRedirect();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/15 ring-1 ring-signal/30">
            <span className="h-2.5 w-2.5 rounded-full bg-signal shadow-[0_0_12px_rgba(45,212,191,0.8)]" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-mist-100 transition group-hover:text-white">
            StatVibe
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-mist-300 md:flex">
          <a href="#features" className="transition hover:text-mist-100">
            Features
          </a>
          <a href="#cta" className="transition hover:text-mist-100">
            Get started
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={openLaunch}
            disabled={!ready}
            className="rounded-xl px-3.5 py-2 text-sm text-mist-300 transition hover:text-white disabled:opacity-50"
          >
            Launch App
          </button>
          <button
            type="button"
            onClick={openGetStarted}
            disabled={!ready}
            className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-ink-950 shadow-glow transition hover:bg-signal-deep hover:text-white disabled:opacity-50"
          >
            Get Started
          </button>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-mist-300 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-ink-900 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            <a href="#features" className="text-mist-300" onClick={() => setOpen(false)}>
              Features
            </a>
            <button
              type="button"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-left text-mist-100"
              onClick={() => {
                setOpen(false);
                openLaunch();
              }}
            >
              Launch App
            </button>
            <button
              type="button"
              className="rounded-xl bg-signal px-4 py-2.5 text-left font-semibold text-ink-950"
              onClick={() => {
                setOpen(false);
                openGetStarted();
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
