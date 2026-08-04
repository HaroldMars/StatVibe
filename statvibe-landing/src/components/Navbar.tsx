'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useDeviceRedirect } from '@/hooks/useDeviceRedirect';

export function Navbar() {
  const { openLaunch, openGetStarted, ready } = useDeviceRedirect();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-leaf-800/10 bg-cream/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-leaf-400/50 ring-1 ring-leaf-800/15">
            <span className="h-2.5 w-2.5 rounded-full bg-leaf-600" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-leaf-950">
            StatVibe
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-moss-500 md:flex">
          <a href="#how" className="transition hover:text-leaf-950">
            How it works
          </a>
          <a href="#compare" className="transition hover:text-leaf-950">
            Compare
          </a>
          <a href="#features" className="transition hover:text-leaf-950">
            Features
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={openLaunch}
            disabled={!ready}
            className="rounded-full px-3.5 py-2 text-sm text-moss-500 transition hover:text-leaf-950 disabled:opacity-50"
          >
            Launch App
          </button>
          <button
            type="button"
            onClick={openGetStarted}
            disabled={!ready}
            className="rounded-full bg-leaf-950 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-leaf-800 disabled:opacity-50"
          >
            Get Started
          </button>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-moss-500 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-leaf-800/10 bg-cream px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            <a href="#how" onClick={() => setOpen(false)} className="text-moss-500">
              How it works
            </a>
            <a href="#features" onClick={() => setOpen(false)} className="text-moss-500">
              Features
            </a>
            <button
              type="button"
              className="rounded-full border border-leaf-800/15 px-4 py-2.5 text-left"
              onClick={() => {
                setOpen(false);
                openLaunch();
              }}
            >
              Launch App
            </button>
            <button
              type="button"
              className="rounded-full bg-leaf-950 px-4 py-2.5 text-left font-semibold text-cream"
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
