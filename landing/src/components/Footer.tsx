import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <Image src="/logo-main.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="text-[14px] font-bold text-[var(--ink)]">StatVibe</span>
        </div>
        <p className="max-w-md text-[12.5px] leading-relaxed text-[var(--muted)]">
          StatVibe · A new, upcoming project of Illuminary Peak Company · 2026
        </p>
        <a
          href="https://illuminary-peak.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-semibold text-[var(--primary)] hover:underline"
        >
          Illuminary Peak Company
        </a>
      </div>
    </footer>
  );
}
