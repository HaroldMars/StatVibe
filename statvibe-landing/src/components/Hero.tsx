'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useDeviceRedirect } from '@/hooks/useDeviceRedirect';

export function Hero() {
  const { openGetStarted, openDemo, ready } = useDeviceRedirect();

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hero-mesh" aria-hidden />
      <div
        className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-leaf-400/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-24 h-72 w-72 rounded-full bg-leaf-600/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-5 inline-flex w-fit items-center rounded-full border border-leaf-800/10 bg-white/60 px-3 py-1 text-xs font-medium text-leaf-800"
        >
          Now live for growing teams
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="font-display text-5xl font-semibold tracking-tight text-leaf-950 sm:text-6xl md:text-7xl lg:text-[5.25rem] lg:leading-[0.95]"
        >
          StatVibe
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="mt-5 max-w-3xl font-display text-3xl font-medium leading-[1.15] text-leaf-900 sm:text-4xl md:text-5xl"
        >
          Business noise hides.
          <br />
          <span className="text-leaf-600">StatVibe</span> hunts the signal.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="mt-6 max-w-xl text-base leading-relaxed text-moss-500 sm:text-lg"
        >
          One screen for revenue, inventory, ideas, and AI copilots. StatVibe watches the pulse of
          your business and surfaces what needs a human — before the day gets away from you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28 }}
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <button
            type="button"
            onClick={openGetStarted}
            disabled={!ready}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-leaf-950 px-6 py-3.5 text-base font-semibold text-cream shadow-lift transition hover:bg-leaf-800 disabled:opacity-50"
          >
            Launch App
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={openDemo}
            disabled={!ready}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-leaf-800/15 bg-white/70 px-6 py-3.5 text-base font-medium text-leaf-900 backdrop-blur transition hover:border-leaf-600/40 hover:bg-leaf-100 disabled:opacity-50"
          >
            View Demo
          </button>
        </motion.div>
      </div>
    </section>
  );
}
