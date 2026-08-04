'use client';

import { motion } from 'framer-motion';

const SIGNALS = [
  { label: 'Revenue', detail: 'Live totals, refunds, and period deltas' },
  { label: 'Inventory', detail: 'Stock moves tied to the same workspace' },
  { label: 'AI copilots', detail: 'Hosted models that know your account' },
];

const ACTIONS = [
  {
    tag: 'Pulse',
    title: 'Revenue dips mid-shift',
    body: 'Flags the drop with the entries that caused it — not a vague chart.',
  },
  {
    tag: 'Ops',
    title: 'Inventory running thin',
    body: 'Surfaces low stock before the floor asks why the shelf is empty.',
  },
  {
    tag: 'Assist',
    title: 'Idea stuck in the hub',
    body: 'AI drafts the next step so projects leave “maybe later.”',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative border-t border-leaf-800/10 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <h2 className="font-display text-3xl font-semibold tracking-tight text-leaf-950 sm:text-4xl">
            StatVibe learns your business{' '}
            <span className="text-leaf-600">like your best operator would.</span>
          </h2>
          <p className="mt-4 text-moss-500">
            Plugs into the numbers you already track — billing, stock, ideas, messages — and builds
            one live picture of the day.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {SIGNALS.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="glass rounded-2xl p-5 shadow-soft"
            >
              <p className="text-sm font-semibold text-leaf-800">{item.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-moss-500">{item.detail}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-16 max-w-2xl"
        >
          <h3 className="font-display text-2xl font-semibold text-leaf-950 sm:text-3xl">
            It spots the pattern, <span className="text-leaf-600">then acts.</span>
          </h3>
          <p className="mt-3 text-moss-500">Different noise → different fix.</p>
        </motion.div>

        <div className="mt-8 space-y-4">
          {ACTIONS.map((row, i) => (
            <motion.article
              key={row.title}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="flex flex-col gap-3 rounded-2xl border border-leaf-800/10 bg-white/65 p-5 shadow-soft sm:flex-row sm:items-start sm:gap-6"
            >
              <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-leaf-400/60 px-3 text-xs font-semibold text-leaf-800">
                {row.tag}
              </span>
              <div>
                <h4 className="font-semibold text-leaf-950">{row.title}</h4>
                <p className="mt-1 text-sm leading-relaxed text-moss-500">{row.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
