'use client';

import { useDeviceDetect } from '../hooks/useDeviceDetect';
import { clientUrl } from '../lib/urls';

export function MobileBetaBanner() {
  const { ready, isMobile } = useDeviceDetect();
  if (!ready || !isMobile) return null;

  return (
    <div className="border-b border-[var(--line)] bg-[var(--primary-tint)] px-4 py-2.5 text-center text-[12.5px] font-medium leading-snug text-[var(--ink-2)]">
      StatVibe is currently running on Beta Server. App Store &amp; Google Play versions are Coming Soon!{' '}
      <a href={clientUrl()} className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
        Open the app
      </a>
    </div>
  );
}
