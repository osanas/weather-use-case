import type { Metadata } from 'next';
import { Inter, Pixelify_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import './world-tokens.css';
import './world.css';
import './forecast.css';

// Self-hosted at build time by next/font: visitors never request Google Fonts.
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
// Pixel font for the wordmark, section titles and badges only; body text stays in Inter.
const pixel = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixel', display: 'swap' });

export const metadata: Metadata = {
  title: 'Weather Window',
  description: 'Current weather and outdoor activity planning for Canadian cities.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${pixel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
