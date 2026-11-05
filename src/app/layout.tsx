import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PwaBoot } from '@/pwa/PwaBoot';
import { palette, paletteVariables } from '@/styles/palette';
import './globals.css';
export const metadata: Metadata = {
  title: 'ScaleSquad · CampusPass',
  description: 'Build together. Predict failure. Survive the system.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'ScaleSquad' },
  icons: {
    icon: { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    apple: '/icons/apple-touch-icon.png',
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: palette.ink,
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" style={paletteVariables}>
      <body>
        <TooltipProvider>
          <PwaBoot />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
