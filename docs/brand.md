# ScaleSquad — Squad Link

Owner selected concept 1, Squad Link: three interlocking parts for three players
working together. The original concept was made with the built-in imagegen tool.
The final asset is a clean SVG recreation with transparent gaps and no gradients,
textures or shadows, so it stays sharp at small sizes.

`public/icons/squad-link.svg` is the master mark. `BrandLogo` in
`src/components/shared` combines it with the readable SCALE / SQUAD wordmark.
Sign-in, signup, lobby and match screens all use that component.

- Theme: black, cobalt blue and acid lime (owner-selected concept 6).
- The only editable UI color values are in `src/styles/palette.ts`.
- Ink: `palette.ink`; panel: `palette.surface`; text: `palette.text`.
- Lime: `palette.lime`; cobalt: `palette.cobalt`.
- Header: lime mark, white SCALE, lime SQUAD.
- App icon: ink mark on solid lime, with space for OS masking.

`RootLayout` supplies the palette as CSS custom properties. Semantic names in
`src/styles/palette.css` map them to Tailwind/shadcn and plain CSS: use
`var(--background)`, `var(--foreground)`, `var(--primary)` (lime),
`var(--secondary)` (cobalt), and the shared border, input and status tokens.
Components must use these tokens or their Tailwind equivalents (`bg-primary`,
`text-muted-foreground`), never local hex/RGB values or built-in color shades.
Opacity and hover states must derive from shared tokens too. Cobalt outlines
the lobby cards and marks Join; lime marks Create and primary game actions.

The login uses restrained glass highlights on buttons, its badge and role cards.
Keep the form background and input fills opaque. Its pending sign-in action uses
cobalt with readable foreground text; success returns to lime. Animation and tilt
must respect reduced motion and never block typing or cover labels.

Viewport and manifest colors import the same palette. `npm run pwa:build`
generates `public/offline.html` from the template in `src/pwa/offline.html`.
Static SVG/PNG assets contain resolved colors so they work independently of
page CSS; `npm run pwa:icons` supplies their colors from the same palette.

Run `npm run pwa:icons` after editing the master. It creates the favicon, 192px
and 512px app icons, maskable icon, Apple touch icon and derived `source.svg`.
Do not edit the generated variants separately. Static cache version 3 replaces
the old icon cache; only the specific public brand assets are cacheable.

Final asset brief: preserve the selected three-link triangular geometry, use
flat lime with transparent negative space, and retain a compact silhouette at
favicon size. Raster cleanup experiments are not used by the application.
