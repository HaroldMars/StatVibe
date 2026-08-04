import type { Metadata } from 'next';
import { Fraunces, Sora } from 'next/font/google';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Sora({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StatVibe — Feel the pulse of your business',
  description:
    'Real-time analytics, mobile-first insights, and automated vibe checks. Launch the StatVibe app from this marketing site.',
  icons: {
    icon: '/logo-main.png',
    apple: '/icon-192.png',
  },
  openGraph: {
    title: 'StatVibe',
    description: 'Feel the pulse of your business.',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${display.variable} ${sans.variable} antialiased`}>{children}</body>
    </html>
  );
}
