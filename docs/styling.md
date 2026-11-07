# Styling conventions

Use Tailwind utilities with the semantic theme in `src/app/globals.css` and the
shared values in `src/styles/palette.css`. Font files remain local. Do not copy
palette values into feature markup.

`globals.css` contains only imports, Tailwind theme registration, base control
accessibility rules and the global reduced-motion fallback. It has no feature
selectors such as `.error`, `.muted`, `.status-bar` or `.hm-*`.

`src/styles/layout.ts` owns reusable layout recipes. `layoutClassName` combines
marker names with their Tailwind utilities, so existing test selectors and mobile
section hooks stay stable. The marker names alone carry no styling. Rules that
depend on a child or a state use Tailwind's scoped arbitrary variants.

The public home uses `src/features/landing/landingStyles.ts`. These are named
Tailwind recipes for the approved role-index layout, not CSS emitted at runtime.
They preserve the existing composition, responsive breakpoints, focus states and
reduced-motion behavior. `hallmark.css` is removed. Shared font, color, shadow and
animation tokens are registered once rather than redeclared by the feature.

Use ordinary utility classes for simple one-off elements. Extract a recipe when
it repeats or when a responsive/stateful layout would obscure the component.
Keep CSS marker hooks if browser checks or accessibility flows depend on them.
