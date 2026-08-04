'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeviceDetect } from '../hooks/useDeviceDetect';
import { clientUrl } from '../lib/urls';

type Props = {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
};

export function DeviceCta({ label = 'Get StatVibe', size = 'md', fullWidth, className = '' }: Props) {
  const { ready, isMobile } = useDeviceDetect();
  const [open, setOpen] = useState(false);
  const url = clientUrl();

  const sizeCls =
    size === 'sm'
      ? 'px-3.5 py-2 text-[12.5px]'
      : size === 'lg'
        ? 'px-7 py-3.5 text-[15px]'
        : 'px-5 py-2.5 text-[13.5px]';

  function onClick() {
    if (!ready) {
      window.location.href = url;
      return;
    }
    if (isMobile) {
      window.location.href = url;
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={[
          'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] font-semibold text-white shadow-[0_8px_24px_rgba(91,103,250,0.28)] transition hover:bg-[var(--primary-deep)] active:scale-[0.98]',
          sizeCls,
          fullWidth ? 'w-full' : '',
          className,
        ].join(' ')}
      >
        <Smartphone size={size === 'sm' ? 14 : 16} strokeWidth={2.2} />
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(24,33,63,0.45)] p-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="desktop-qr-title"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="glass relative w-full max-w-md rounded-3xl p-6 sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-white/80 text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X size={16} />
              </button>

              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Mobile beta</div>
              <h2 id="desktop-qr-title" className="pr-8 text-[22px] font-bold leading-tight tracking-tight text-[var(--ink)]">
                Oops! The StatVibe Beta is optimized for mobile devices.
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
                Please scan the QR code below using your phone camera or visit{' '}
                <a href={url} className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
                  {url.replace(/\/$/, '')}
                </a>{' '}
                on your mobile browser.
              </p>

              <div className="mt-6 flex justify-center">
                <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                  <QRCodeSVG value={url} size={180} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#18213f" />
                </div>
              </div>

              <p className="mt-4 text-center text-[12px] text-[var(--muted)]">
                App Store &amp; Google Play versions are coming soon.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
