import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PwaBoot } from '@/pwa/PwaBoot';
import './globals.css';
export const metadata: Metadata = {
  title: 'ScaleSquad · CampusPass',
  description: 'Build together. Predict failure. Survive the system.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'ScaleSquad' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edf1f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <TooltipProvider>
          <PwaBoot />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
