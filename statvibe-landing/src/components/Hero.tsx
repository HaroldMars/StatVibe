'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { useDeviceRedirect } from '@/hooks/useDeviceRedirect';

export function Hero() {
  const { openLaunch, openDemo, ready, isMobile } = useDeviceRedirect();

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-fade" aria-hidden />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
        >
          StatVibe
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="mt-5 max-w-3xl text-2xl font-medium leading-snug text-mist-100 sm:text-3xl md:text-4xl"
        >
          Feel the pulse of your business — live analytics, mobile-first insights, automated vibe checks.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16 }}
          className="mt-5 max-w-xl text-base leading-relaxed text-mist-500 sm:text-lg"
        >
          One screen for revenue, inventory, ideas, and AI copilots. Built for teams who move on phones
          first and desktops when it counts.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <button
            type="button"
            onClick={openLaunch}
            disabled={!ready}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-signal px-6 py-3.5 text-base font-semibold text-ink-950 shadow-glow transition hover:bg-signal-deep hover:text-white disabled:opacity-50"
          >
            Launch App
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={openDemo}
            disabled={!ready}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-base font-medium text-mist-100 backdrop-blur transition hover:border-signal/40 hover:bg-signal/10 disabled:opacity-50"
          >
            <Play size={16} className="text-signal" />
            View Demo
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 text-xs text-mist-500"
        >
          {ready
            ? isMobile
              ? 'Mobile detected — Launch opens the live app (or store when configured).'
              : 'Desktop detected — Launch opens the web app; Get Started walks you through signup.'
            : 'Detecting device…'}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="pointer-events-none absolute -right-16 bottom-8 hidden h-72 w-72 rounded-full bg-signal/10 blur-3xl md:block"
          aria-hidden
        />
      </div>
    </section>
  );
}
