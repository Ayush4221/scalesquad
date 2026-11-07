import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { palette } from '../src/styles/palette.ts';

// The approved Squad Link SVG is the single source for every app icon.
const originalMark = await readFile('public/icons/squad-link.svg', 'utf8');
const mark = originalMark.replace(/fill="#[0-9a-f]+"/gi, `fill="${palette.lime}"`);
if (mark !== originalMark) await writeFile('public/icons/squad-link.svg', mark);
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="${palette.lime}"/>
${mark.replace('<svg ', '<svg x="64" y="64" width="384" height="384" ').replaceAll(palette.lime, palette.ink)}
</svg>`;
await writeFile('public/icons/source.svg', icon);

// sharp is supplied by Next.js. The central artwork stays inside the maskable safe area.
for (const [name, size] of [
  ['favicon-32', 32],
  ['icon-192', 192],
  ['icon-512', 512],
  ['maskable-512', 512],
  ['apple-touch-icon', 180],
])
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(`public/icons/${name}.png`);
