'use client';

import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceCta } from './DeviceCta';

const links = [
  { href: '#branches', label: 'Multi-branch' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)]/70 bg-[rgba(243,244,253,0.85)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <a href="#top" className="flex items-center gap-2.5">
          <Image src="/logo-main.png" alt="StatVibe" width={36} height={36} className="rounded-[10px]" priority />
          <span className="text-[17px] font-bold tracking-tight text-[var(--ink)]">StatVibe</span>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[13.5px] font-medium text-[var(--ink-2)] transition hover:text-[var(--primary)]">
              {l.label}
            </a>
          ))}
          <DeviceCta size="sm" label="Open app" />
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-white/70 text-[var(--ink)] md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--line)] bg-white/90 md:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-3">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-[14px] font-medium text-[var(--ink-2)] hover:bg-[var(--primary-tint)]"
                >
                  {l.label}
                </a>
              ))}
              <div className="pt-2">
                <DeviceCta fullWidth label="Open StatVibe" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
