'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { MapPinned, Store } from 'lucide-react';

const BranchMap = dynamic(() => import('./BranchMap').then((m) => m.BranchMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-2xl bg-[var(--primary-tint)] text-[13px] font-medium text-[var(--muted)]">
      Loading map…
    </div>
  ),
});

export function BranchMapSection() {
  return (
    <section id="branches" className="scroll-mt-24 px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-8 max-w-2xl"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-[11.5px] font-semibold text-[var(--primary)]">
            <MapPinned size={13} /> Multi-branch operations
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.15rem)] font-bold tracking-tight text-[var(--ink)]">
            Manage every store from one hub
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
            Users with multiple locations sync stock, revenue, and staff in one centralized view. Tap a pin for live
            branch stats — or add a demo location right on the map.
          </p>
        </motion.div>

        <div className="glass overflow-hidden rounded-3xl p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 px-1 text-[12px] font-medium text-[var(--ink-2)]">
            <Store size={14} className="text-[var(--primary)]" />
            Click a pin for daily revenue, staff count, and stock alerts · Use &ldquo;Add demo branch&rdquo; to place a
            new marker
          </div>
          {/* Leaflet attribution clipped: outer overflow + inner height calc(100% + 28px) */}
          <div className="relative h-[400px] overflow-hidden rounded-2xl border border-[var(--line)]">
            <div className="h-[calc(100%+28px)] w-full">
              <BranchMap />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
