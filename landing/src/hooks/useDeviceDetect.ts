'use client';

import { useEffect, useState } from 'react';

export type DeviceKind = 'mobile' | 'desktop' | 'unknown';

function detect(ua: string): DeviceKind {
  if (/android|iphone|ipad|ipod|iemobile|opera mini|mobile/i.test(ua)) return 'mobile';
  if (/macintosh|windows|linux|cros|x11/i.test(ua) && !/mobile/i.test(ua)) return 'desktop';
  // iPadOS 13+ may report as Macintosh with touch
  if (typeof navigator !== 'undefined' && /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) {
    return 'mobile';
  }
  return 'desktop';
}

export function useDeviceDetect() {
  const [device, setDevice] = useState<DeviceKind>('unknown');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDevice(detect(navigator.userAgent || ''));
    setReady(true);
  }, []);

  return {
    device,
    ready,
    isMobile: device === 'mobile',
    isDesktop: device === 'desktop',
  };
}
