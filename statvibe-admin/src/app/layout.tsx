import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'StatVibe Admin',
  description: 'StatVibe Admin Dashboard — founders & employee operators',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} font-sans antialiased`}>
        <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</div>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
