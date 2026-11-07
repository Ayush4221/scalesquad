import type { MetadataRoute } from 'next';
import { palette } from '@/styles/palette';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ScaleSquad',
    short_name: 'ScaleSquad',
    description: 'Solve system failures with your squad.',
    start_url: '/play',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: palette.ink,
    background_color: palette.ink,
    categories: ['games', 'education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
