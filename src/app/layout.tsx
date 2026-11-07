import { appStrings } from '@/constants/strings/app';
import { commonStrings } from '@/constants/strings/common';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PwaBoot } from '@/pwa/PwaBoot';
import { palette, paletteVariables } from '@/styles/palette';
import './globals.css';
export const metadata: Metadata = {
  title: commonStrings.scalesquad,
  description: appStrings.buildTogetherPredictFailureSurviveThe,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: commonStrings.scalesquad,
  },
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
export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonces are request-specific, so every page using this layout must render dynamically.
  await headers();
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
