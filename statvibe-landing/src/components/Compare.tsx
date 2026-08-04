'use client';

import { motion } from 'framer-motion';

export function Compare() {
  return (
    <section id="compare" className="relative border-t border-leaf-800/10 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <h2 className="font-display text-3xl font-semibold tracking-tight text-leaf-950 sm:text-4xl">
            Spreadsheet alerts fire <span className="text-leaf-600">after the damage.</span>
          </h2>
          <p className="mt-3 text-moss-500">And you can’t watch every number yourself.</p>
        </motion.div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="rounded-3xl border border-leaf-800/10 bg-leaf-900 p-6 text-cream shadow-soft sm:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-moss-400">The old way</p>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-leaf-200">
              <li>Export a CSV. Wait for month end.</li>
              <li>Alert: “something changed.” No idea which SKU, shift, or refund.</li>
              <li>You spelunk through chats and sheets — after the money’s gone.</li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="rounded-3xl border border-leaf-600/20 bg-leaf-400/35 p-6 shadow-soft sm:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-leaf-800">The StatVibe way</p>
            <div className="mt-5 rounded-2xl bg-cream/90 p-4 shadow-lift">
              <p className="text-xs font-medium text-leaf-600">live · floor manager</p>
              <p className="mt-2 text-sm font-semibold text-leaf-950">
                Refund spike on Bundle A — three returns in 40 minutes.
              </p>
              <p className="mt-1 text-sm text-moss-500">
                Catches the vibe as it happens — and points to the fix before closing.
              </p>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-leaf-800">
              <li>Revenue, stock, and AI on one authenticated screen</li>
              <li>Mobile-first so the floor stays in sync</li>
              <li>Only escalates what needs a human</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
