import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StatVibe — Run the whole business from one screen',
  description:
    'Real-time analytics, smart planning, multi-branch management, and multi-model AI built for teams of any size. A project of Illuminary Peak Company.',
  icons: {
    icon: '/logo-main.png',
    apple: '/icon-192.png',
  },
  openGraph: {
    title: 'StatVibe',
    description: 'Run the whole business from one screen.',
    images: ['/logo-main.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plex.variable} antialiased`}>{children}</body>
    </html>
  );
}
