'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Calculator,
  Sparkles,
  MessagesSquare,
  Network,
  X,
  ArrowRight,
} from 'lucide-react';

type Feature = {
  id: string;
  title: string;
  summary: string;
  icon: React.ReactNode;
  details: string[];
};

const FEATURES: Feature[] = [
  {
    id: 'dashboards',
    title: 'Predictive Dashboards',
    summary: 'See revenue trends, forecasting, and live business telemetry.',
    icon: <LineChart size={20} />,
    details: [
      'Net-volume charts that rise on sales and fall on refunds — the same live ledger used inside StatVibe.',
      'Period views (live / day / week / month) so you can compare momentum, not just totals.',
      'Alerts when stock cover or AI token usage needs attention before it becomes a fire drill.',
      'Designed for phone-first operators who need the pulse of the business in one glance.',
    ],
  },
  {
    id: 'calculator',
    title: 'Business Calculator',
    summary: 'Live margin tracking, retail pricing math, and supply chain updates.',
    icon: <Calculator size={20} />,
    details: [
      'Retail markup and product target-margin modes that recompute price and profit as you type.',
      'Supply tab with days / weeks / months of cover and AI reorder hints for each SKU.',
      'Freight and overhead baked into landed cost so quotes stay honest.',
      'Saved with your account so every device shares the same working numbers.',
    ],
  },
  {
    id: 'ai',
    title: 'Multi-model AI Workspace',
    summary: 'Flexible LLM workspace powered by hosted AI models (openrouter/auto).',
    icon: <Sparkles size={20} />,
    details: [
      'Production runs on an OpenAI-compatible hosted endpoint (OpenRouter / auto routing) when Ollama isn’t available.',
      'Token metering on Free (weekly) and paid plans (monthly) so usage stays predictable.',
      'Blend-ready workspace for board updates, forecasts, quotes, and idea expansion.',
      'History saved to your account so outputs stay with the business, not lost in a chat scroll.',
    ],
  },
  {
    id: 'agent',
    title: 'AgentTech Assistant',
    summary: 'Automated AI assistant handling client, customer, and partner messaging.',
    icon: <MessagesSquare size={20} />,
    details: [
      'Messenger-style inbox keyed by StatVibe tags and QR — people reach you only when you share a code.',
      'Thread unread counts and auto-reply hooks for partner / client follow-ups.',
      'Built for the same account graph as inventory and revenue — context stays in one product.',
      'Part of the Illuminary Peak AgentTech line, shipping inside StatVibe’s Agent tab.',
    ],
  },
  {
    id: 'branches',
    title: 'Multi-Branch Hub',
    summary: 'Real-time synchronization across unlimited store locations.',
    icon: <Network size={20} />,
    details: [
      'Central view of stock, revenue, and staff across Cebu, Manila, Davao — or any locations you add.',
      'Map pins surface daily revenue, headcount, and stock alert status without opening a spreadsheet.',
      'Demo “add branch” on the landing map mirrors how operators extend coverage as they grow.',
      'Durable Mongo-backed accounts keep every branch’s session and data across cold starts on Vercel.',
    ],
  },
];

export function Features() {
  const [active, setActive] = useState<Feature | null>(null);

  return (
    <section id="features" className="scroll-mt-24 px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-10 max-w-2xl"
        >
          <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            Core platform
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.15rem)] font-bold tracking-tight text-[var(--ink)]">
            Everything in one place
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
            The same modules you use inside the StatVibe app — open Learn more for how each piece works under the hood.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="glass flex flex-col rounded-3xl p-5"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]">
                {f.icon}
              </div>
              <h3 className="text-[16px] font-bold tracking-tight text-[var(--ink)]">{f.title}</h3>
              <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-[var(--muted)]">{f.summary}</p>
              <button
                type="button"
                onClick={() => setActive(f)}
                className="mt-4 inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-[var(--primary)] hover:gap-2.5 transition-all"
              >
                Learn more <ArrowRight size={14} />
              </button>
            </motion.article>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-[70] flex justify-end bg-[rgba(24,33,63,0.4)] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="feature-panel-title"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="flex h-full w-full max-w-md flex-col bg-[linear-gradient(180deg,#f6f7ff,#ffffff)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
                <div>
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-tint)] text-[var(--primary)]">
                    {active.icon}
                  </div>
                  <h3 id="feature-panel-title" className="text-[20px] font-bold tracking-tight text-[var(--ink)]">
                    {active.title}
                  </h3>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">{active.summary}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setActive(null)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-[var(--muted)]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <ul className="space-y-3">
                  {active.details.map((d) => (
                    <li key={d} className="flex gap-3 text-[14px] leading-relaxed text-[var(--ink-2)]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
