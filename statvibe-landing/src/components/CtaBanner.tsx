'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useDeviceRedirect } from '@/hooks/useDeviceRedirect';

export function CtaBanner() {
  const { openSignup, urls, ready } = useDeviceRedirect();

  return (
    <section id="cta" className="relative pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-signal/20 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 px-6 py-12 shadow-glow sm:px-12 sm:py-16"
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-signal/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-ember/15 blur-3xl"
            aria-hidden
          />

          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to catch the vibe?
            </h2>
            <p className="mt-3 text-mist-300">
              Create your workspace in minutes. Free to start — upgrade when your team needs more signal.
            </p>
            <button
              type="button"
              onClick={openSignup}
              disabled={!ready}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-signal px-6 py-3.5 text-base font-semibold text-ink-950 transition hover:bg-signal-deep hover:text-white disabled:opacity-50"
            >
              Sign up free
              <ArrowUpRight size={18} />
            </button>
            <p className="mt-3 text-xs text-mist-500">
              Continues to <span className="text-mist-300">{urls.signupUrl}</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
