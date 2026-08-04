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
          className="relative overflow-hidden rounded-3xl bg-leaf-950 px-6 py-12 text-cream shadow-lift sm:px-12 sm:py-16"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-leaf-400/30 blur-3xl"
            aria-hidden
          />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to catch the vibe?
            </h2>
            <p className="mt-3 text-leaf-200">
              Create your workspace in minutes. Free to start — upgrade when your team needs more
              signal.
            </p>
            <button
              type="button"
              onClick={openSignup}
              disabled={!ready}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-leaf-400 px-6 py-3.5 text-base font-semibold text-leaf-950 transition hover:bg-cream disabled:opacity-50"
            >
              Sign up free
              <ArrowUpRight size={18} />
            </button>
            <p className="mt-3 text-xs text-moss-400">
              Continues to <span className="text-leaf-200">{urls.signupUrl}</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
