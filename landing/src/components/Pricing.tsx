'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { PLANS, formatPhp } from '../lib/plans';
import { DeviceCta } from './DeviceCta';

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            Subscriptions
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.15rem)] font-bold tracking-tight text-[var(--ink)]">
            Plans that scale with your AI usage
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
            Same tiers as inside StatVibe — Free weekly tokens, Pro and Business monthly capacity, Enterprise custom.
          </p>

          <div className="mt-6 inline-flex items-center gap-1 rounded-2xl border border-[var(--line)] bg-white/80 p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={[
                'rounded-xl px-4 py-2 text-[13px] font-semibold transition',
                !annual ? 'bg-[var(--primary)] text-white' : 'text-[var(--ink-2)] hover:bg-[var(--primary-tint)]',
              ].join(' ')}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={[
                'rounded-xl px-4 py-2 text-[13px] font-semibold transition',
                annual ? 'bg-[var(--primary)] text-white' : 'text-[var(--ink-2)] hover:bg-[var(--primary-tint)]',
              ].join(' ')}
            >
              Annual <span className="ml-1 text-[11px] opacity-90">2 mo free</span>
            </button>
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p, i) => {
            const price = annual ? p.annual : p.monthly;
            const period = p.id === 'Free' ? '' : annual ? '/yr' : '/mo';
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={[
                  'relative flex flex-col rounded-3xl p-5',
                  p.popular
                    ? 'bg-[linear-gradient(165deg,#1f2b63_0%,#2a3a7a_100%)] text-white shadow-[0_16px_40px_rgba(31,43,99,0.28)]'
                    : 'glass',
                ].join(' ')}
              >
                {p.popular && (
                  <span className="absolute -top-2.5 left-5 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
                    Most popular
                  </span>
                )}
                <div className={['text-[15px] font-bold', p.popular ? 'text-white' : 'text-[var(--ink)]'].join(' ')}>
                  {p.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={['font-mono text-[26px] font-semibold', p.popular ? 'text-white' : 'text-[var(--ink)]'].join(' ')}>
                    {price == null ? 'Custom' : formatPhp(price)}
                  </span>
                  {period && (
                    <span className={['text-[12px]', p.popular ? 'text-[#9FBAB2]' : 'text-[var(--muted)]'].join(' ')}>
                      {period}
                    </span>
                  )}
                </div>
                <p className={['mt-2 text-[12.5px] leading-relaxed', p.popular ? 'text-[#C3D6D0]' : 'text-[var(--muted)]'].join(' ')}>
                  {p.blurb}
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className={['flex gap-2 text-[12.5px] leading-snug', p.popular ? 'text-[#eaf0ee]' : 'text-[var(--ink-2)]'].join(' ')}
                    >
                      <Check size={14} className={['mt-0.5 shrink-0', p.popular ? 'text-[#7b87ff]' : 'text-[var(--primary)]'].join(' ')} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {p.id === 'Enterprise' ? (
                    <a
                      href="mailto:hello@illuminarypeak.com?subject=StatVibe%20Enterprise"
                      className={[
                        'inline-flex w-full items-center justify-center rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition',
                        p.popular
                          ? 'bg-white text-[var(--ink)] hover:bg-[#eef0ff]'
                          : 'border border-[var(--line)] bg-white text-[var(--ink-2)] hover:border-[var(--primary)]',
                      ].join(' ')}
                    >
                      Contact sales
                    </a>
                  ) : (
                    <DeviceCta
                      fullWidth
                      size="sm"
                      label={p.id === 'Free' ? 'Start free' : `Upgrade to ${p.name}`}
                      className={
                        p.popular
                          ? '!bg-white !text-[var(--ink)] hover:!bg-[#eef0ff] !shadow-none'
                          : ''
                      }
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
