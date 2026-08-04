'use client';

import { motion } from 'framer-motion';
import { DeviceCta } from './DeviceCta';
import { PhoneMock } from './PhoneMock';

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:pb-20 sm:pt-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#dfe4ff] opacity-70 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-40 h-80 w-80 rounded-full bg-[#e8ebff] opacity-80 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-[11.5px] font-semibold tracking-wide text-[var(--primary)]">
            Illuminary Peak · Beta
          </div>
          <h1 className="max-w-xl text-[clamp(2.15rem,5vw,3.35rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--ink)]">
            Run the whole business from one screen.
          </h1>
          <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed text-[var(--muted)] sm:text-[16.5px]">
            Real-time analytics, smart planning, multi-branch management, and multi-model AI built for teams of any
            size, in any industry.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <DeviceCta size="lg" label="Open StatVibe" />
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white/80 px-5 py-3.5 text-[14px] font-semibold text-[var(--ink-2)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              Explore features
            </a>
          </div>
          <p className="mt-5 text-[12.5px] text-[var(--muted)]">
            Mobile-first beta · PWA installable · Powered by hosted AI
          </p>
        </motion.div>

        <motion.div
          className="flex justify-center lg:justify-end"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <PhoneMock />
        </motion.div>
      </div>
    </section>
  );
}
