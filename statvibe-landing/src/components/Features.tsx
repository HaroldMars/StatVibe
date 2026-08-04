'use client';

import { motion } from 'framer-motion';
import { Activity, Smartphone, Sparkles, Zap } from 'lucide-react';
import type { FeatureItem } from '@/lib/urls';

const FEATURES: FeatureItem[] = [
  {
    id: 'realtime',
    title: 'Real-time Analytics',
    description: 'Watch revenue, refunds, and usage update as your team works — no stale dashboards.',
    accent: 'signal',
  },
  {
    id: 'mobile',
    title: 'Mobile-First Insights',
    description: 'Thumb-friendly flows for floor managers and founders who live on their phones.',
    accent: 'ember',
  },
  {
    id: 'vibe',
    title: 'Automated Vibe Check',
    description: 'AI copilots surface risks, ideas, and next moves before the day gets away from you.',
    accent: 'sky',
  },
  {
    id: 'ops',
    title: 'Ops in One Place',
    description: 'Inventory, calculators, idea hub, and AgentTech messaging — one authenticated workspace.',
    accent: 'signal',
  },
];

const ICONS = {
  realtime: Activity,
  mobile: Smartphone,
  vibe: Sparkles,
  ops: Zap,
} as const;

const ACCENT: Record<FeatureItem['accent'], string> = {
  signal: 'bg-signal/15 text-signal ring-signal/25',
  ember: 'bg-ember/15 text-ember ring-ember/25',
  sky: 'bg-sky-400/15 text-sky-300 ring-sky-400/25',
};

export function Features() {
  return (
    <section id="features" className="relative border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Built for the rhythm of real work
          </h2>
          <p className="mt-3 text-mist-500">
            Four capabilities that keep StatVibe feeling alive — not another spreadsheet you abandon.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature, i) => {
            const Icon = ICONS[feature.id as keyof typeof ICONS] || Zap;
            return (
              <motion.article
                key={feature.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="rounded-2xl border border-white/8 bg-ink-800/60 p-6 shadow-soft backdrop-blur-sm transition hover:border-signal/25 hover:bg-ink-700/50"
              >
                <div
                  className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${ACCENT[feature.accent]}`}
                >
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-semibold text-mist-100">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-500">{feature.description}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
