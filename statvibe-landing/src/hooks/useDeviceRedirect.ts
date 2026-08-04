'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAppUrls, type AppUrls, type DeviceKind } from '@/lib/urls';

function detectDevice(ua: string): DeviceKind {
  if (typeof navigator !== 'undefined' && /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) {
    return 'mobile';
  }
  if (/android|iphone|ipad|ipod|iemobile|opera mini|mobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

export interface DeviceRedirectResult {
  device: DeviceKind;
  ready: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  urls: AppUrls;
  /** Primary CTA: mobile → app or store; desktop → client home / onboarding. */
  launchUrl: string;
  getStartedUrl: string;
  openLaunch: () => void;
  openGetStarted: () => void;
  openSignup: () => void;
  openDemo: () => void;
}

/**
 * Device-aware redirect helper for marketing CTAs.
 * Reads NEXT_PUBLIC_CLIENT_URL (and optional store URLs).
 */
export function useDeviceRedirect(): DeviceRedirectResult {
  const urls = useMemo(() => getAppUrls(), []);
  const [device, setDevice] = useState<DeviceKind>('unknown');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDevice(detectDevice(navigator.userAgent || ''));
    setReady(true);
  }, []);

  const isMobile = device === 'mobile';
  const isDesktop = device === 'desktop';

  const launchUrl = useMemo(() => {
    if (isMobile) {
      if (/iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') && urls.iosStoreUrl) {
        return urls.iosStoreUrl;
      }
      if (/android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') && urls.androidStoreUrl) {
        return urls.androidStoreUrl;
      }
      return urls.clientUrl;
    }
    return urls.clientUrl;
  }, [isMobile, urls]);

  const getStartedUrl = useMemo(() => {
    if (isMobile) return launchUrl;
    return urls.signupUrl;
  }, [isMobile, launchUrl, urls.signupUrl]);

  const navigate = useCallback((href: string) => {
    if (typeof window !== 'undefined') window.location.assign(href);
  }, []);

  return {
    device,
    ready,
    isMobile,
    isDesktop,
    urls,
    launchUrl,
    getStartedUrl,
    openLaunch: () => navigate(launchUrl),
    openGetStarted: () => navigate(getStartedUrl),
    openSignup: () => navigate(urls.signupUrl),
    openDemo: () => navigate(urls.demoUrl),
  };
}
