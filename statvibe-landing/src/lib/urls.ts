export interface AppUrls {
  /** Main web app origin (no trailing slash required). */
  clientUrl: string;
  signupUrl: string;
  loginUrl: string;
  demoUrl: string;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
}

export function getClientBase(): string {
  const raw = process.env.NEXT_PUBLIC_CLIENT_URL || 'https://stat-vibe.vercel.app';
  return raw.replace(/\/$/, '');
}

export function getAppUrls(): AppUrls {
  const clientUrl = getClientBase();
  return {
    clientUrl,
    signupUrl: `${clientUrl}/signup`,
    loginUrl: `${clientUrl}/login`,
    demoUrl: `${clientUrl}/?demo=1`,
    iosStoreUrl: process.env.NEXT_PUBLIC_IOS_STORE_URL || null,
    androidStoreUrl: process.env.NEXT_PUBLIC_ANDROID_STORE_URL || null,
  };
}

export type DeviceKind = 'mobile' | 'desktop' | 'unknown';

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  accent: 'signal' | 'ember' | 'sky';
}
