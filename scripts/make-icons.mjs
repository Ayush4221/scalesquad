import sharp from 'sharp';
// sharp is supplied by Next.js. Keep every raster icon tied to one SVG source.
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['maskable-512', 512],
  ['apple-touch-icon', 180],
])
  await sharp('public/icons/source.svg')
    .resize(size, size)
    .png()
    .toFile(`public/icons/${name}.png`);
