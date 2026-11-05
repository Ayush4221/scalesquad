import type { CSSProperties } from 'react';

/** All UI color values live here. CSS, browser metadata and icons share this palette. */
export const palette = {
  ink: '#090c10',
  surface: '#101927',
  raised: '#19253a',
  line: '#31425b',
  input: '#60718a',
  text: '#edf2f7',
  muted: '#a6b4c8',
  subtle: '#94a4bb',
  cobalt: '#2957e8',
  'cobalt-hover': '#2049cf',
  lime: '#c2ff64',
  'lime-hover': '#b1ee53',
  'lime-tint': '#1c2b18',
  'lime-line': '#58793b',
  danger: '#ff929e',
  'danger-tint': '#301923',
  'danger-line': '#99515d',
  warning: '#f0c878',
  'page-overlay': '#090c10f5',
  'dialog-overlay': '#090c10cc',
} as const;

/** Set once on the root element; semantic CSS tokens reference these properties. */
export const paletteVariables: CSSProperties & Record<`--palette-${string}`, string> =
  Object.fromEntries(Object.entries(palette).map(([name, value]) => [`--palette-${name}`, value]));
