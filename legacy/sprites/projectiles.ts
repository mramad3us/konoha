/**
 * Projectile sprites — kunai and shuriken in various directions.
 * Small 8x8 pixel patterns rendered at 24x24 display pixels.
 *
 * Kunai matches the HUD/kill-intent SVG style:
 *   Silver blade tip → metal blade → dark edge → brown handle → red wrap → dark guard → ring
 * Rotated to 8 compass directions so the blade always points toward the target.
 */

import type { PixelPattern } from './pixelPatterns.ts';

// Kunai palette — matches the HUD SVG icon colors
const KUNAI_PAL: Record<string, [number, number, number]> = {
  t: [208, 208, 208],  // blade tip (bright silver)
  b: [176, 176, 176],  // blade body
  B: [160, 160, 160],  // blade mid
  d: [128, 128, 128],  // dark edge
  h: [139, 69, 19],    // handle (wood)
  r: [178, 34, 52],    // red wrapping
  g: [85, 85, 85],     // dark guard / ring
};

// Kunai pointing North (↑) — blade up, handle down
export const PROJ_KUNAI_N: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '...t....',
    '...b....',
    '..dBd...',
    '...d....',
    '...h....',
    '...r....',
    '...r....',
    '..g.g...',
  ],
};

// Kunai pointing South (↓) — blade down, handle up
export const PROJ_KUNAI_S: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '..g.g...',
    '...r....',
    '...r....',
    '...h....',
    '...d....',
    '..dBd...',
    '...b....',
    '...t....',
  ],
};

// Kunai pointing East (→) — blade right, handle left
export const PROJ_KUNAI_E: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '........',
    '..g..d..',
    '.g.rrhdt',
    '.g.rrBdb',
    '..g..d..',
    '........',
    '........',
  ],
};

// Kunai pointing West (←) — blade left, handle right
export const PROJ_KUNAI_W: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '........',
    '..d..g..',
    'tdhrrg..',
    'bdBrr.g.',
    '..d..g..',
    '........',
    '........',
  ],
};

// Kunai pointing NE (↗) — blade to upper-right
export const PROJ_KUNAI_NE: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '....dbt.',
    '...dBd..',
    '..rrd...',
    '.rrh....',
    'g.g.....',
    '........',
    '........',
  ],
};

// Kunai pointing NW (↖) — blade to upper-left
export const PROJ_KUNAI_NW: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '.tbd....',
    '..dBd...',
    '...drr..',
    '....hrr.',
    '.....g.g',
    '........',
    '........',
  ],
};

// Kunai pointing SE (↘) — blade to lower-right
export const PROJ_KUNAI_SE: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '........',
    'g.g.....',
    '.rrh....',
    '..rrd...',
    '...dBd..',
    '....dbt.',
    '........',
  ],
};

// Kunai pointing SW (↙) — blade to lower-left
export const PROJ_KUNAI_SW: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '........',
    '.....g.g',
    '....hrr.',
    '...drr..',
    '..dBd...',
    '.tbd....',
    '........',
  ],
};

// ── Shuriken ──

const SHURIKEN_PAL: Record<string, [number, number, number]> = {
  m: [160, 165, 175],  // metal
  M: [200, 205, 215],  // metal bright
  k: [90, 90, 100],    // dark edge
  c: [140, 140, 150],  // center
};

// Shuriken (all directions — it's a star shape, rotates visually but pattern stays same)
export const PROJ_SHURIKEN_1: PixelPattern = {
  width: 8, height: 8,
  palette: SHURIKEN_PAL,
  pixels: [
    '...k....',
    '..kM....',
    '.kMcMk..',
    '..McMk..',
    '...Mk...',
    '........',
    '........',
    '........',
  ],
};

export const PROJ_SHURIKEN_2: PixelPattern = {
  width: 8, height: 8,
  palette: SHURIKEN_PAL,
  pixels: [
    '........',
    '..kk....',
    '.kMck...',
    '..cMk...',
    '.kMc....',
    '..kk....',
    '........',
    '........',
  ],
};

// ── Blood splatters ──
// 16x16 patterns rendered at tile size (48x32) on the floor layer

const BLOOD_PAL: Record<string, [number, number, number]> = {
  r: [140, 20, 25],    // dark blood
  R: [170, 30, 35],    // blood
  b: [120, 15, 20],    // very dark
  B: [155, 25, 30],    // medium
};

export const BLOOD_SPLATTER_0: PixelPattern = {
  width: 16, height: 16,
  palette: BLOOD_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '.......r........',
    '......rRr.......',
    '.....rRBRr......',
    '......rRr.......',
    '.......rb.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

export const BLOOD_SPLATTER_1: PixelPattern = {
  width: 16, height: 16,
  palette: BLOOD_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '...r............',
    '..rRr...r.......',
    '..rBRr.rRr......',
    '...rRrrRBr......',
    '....rrRRr.......',
    '.....rBr........',
    '......r.........',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

export const BLOOD_SPLATTER_2: PixelPattern = {
  width: 16, height: 16,
  palette: BLOOD_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.........r......',
    '........rRb.....',
    '.....r.rBRr.....',
    '....rRrRBr......',
    '....rBRRr.......',
    '.....rRr........',
    '......r.........',
    '................',
    '................',
    '................',
    '................',
  ],
};
