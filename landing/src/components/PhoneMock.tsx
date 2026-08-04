'use client';

import Image from 'next/image';

/** Stylized phone frame recreating the StatVibe welcome / dashboard look. */
export function PhoneMock() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_30%_20%,#cfd5ff,transparent_55%),radial-gradient(circle_at_80%_70%,#e8ebff,transparent_50%)] blur-2xl"
      />
      <div className="w-[min(100%,300px)] rounded-[2.4rem] border-[5px] border-[#1a2244] bg-[#0f142e] p-2 shadow-[0_30px_80px_rgba(24,33,63,0.28)]">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-[linear-gradient(180deg,#f6f7ff_0%,#ffffff_55%)]">
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#0f142e]" />
          <div className="flex items-center justify-between px-5 pb-1 pt-4 text-[10px] font-semibold text-[var(--ink)]">
            <span>9:41</span>
            <span className="opacity-60">StatVibe</span>
          </div>

          <div className="px-4 pb-5 pt-2">
            <div className="mb-4 flex items-center gap-2.5">
              <Image src="/logo-main.png" alt="" width={34} height={34} className="rounded-[9px]" />
              <div>
                <div className="text-[15px] font-bold tracking-tight text-[var(--ink)]">StatVibe</div>
                <div className="text-[10px] font-medium text-[var(--muted)]">Illuminary Peak</div>
              </div>
            </div>

            <div className="mb-3 text-[20px] font-bold leading-tight tracking-tight text-[var(--ink)]">
              Run the whole business from one screen.
            </div>
            <p className="mb-4 text-[11.5px] leading-relaxed text-[var(--muted)]">
              Real-time analytics, smart planning, and client messaging for teams of any size.
            </p>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
                <div className="text-[10px] font-semibold text-[var(--muted)]">Net revenue</div>
                <div className="mt-1 font-mono text-[16px] font-semibold text-[var(--ink)]">₱128.4k</div>
                <div className="mt-2 h-8 w-full rounded-md bg-[linear-gradient(90deg,#eef0ff,#5b67fa33)]" />
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
                <div className="text-[10px] font-semibold text-[var(--muted)]">Branches</div>
                <div className="mt-1 font-mono text-[16px] font-semibold text-[var(--ink)]">3 live</div>
                <div className="mt-2 text-[10px] font-medium text-[var(--primary)]">Cebu · Manila · Davao</div>
              </div>
            </div>

            <div className="rounded-2xl bg-[var(--primary)] px-3 py-2.5 text-center text-[12px] font-semibold text-white">
              Continue on mobile
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
