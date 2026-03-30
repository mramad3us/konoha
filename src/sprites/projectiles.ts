/**
 * Projectile sprites — kunai and shuriken in various directions.
 * Small 8x8 pixel patterns rendered at 24x24 display pixels.
 */

import type { PixelPattern } from './pixelPatterns.ts';

const KUNAI_PAL: Record<string, [number, number, number]> = {
  m: [180, 185, 195],  // metal blade
  M: [210, 215, 220],  // metal highlight
  k: [100, 100, 110],  // dark blade
  h: [120, 80, 45],    // handle (wood)
  H: [150, 110, 65],   // handle highlight
  r: [178, 34, 52],    // red wrapping
};

// Kunai pointing East (→)
export const PROJ_KUNAI_E: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '........',
    '....kM..',
    '..hhkMm.',
    '..HhrMM.',
    '....km..',
    '........',
    '........',
  ],
};

// Kunai pointing West (←)
export const PROJ_KUNAI_W: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '........',
    '..Mk....',
    '.mMkhh..',
    '.MMrHH..',
    '..mk....',
    '........',
    '........',
  ],
};

// Kunai pointing South (↓)
export const PROJ_KUNAI_S: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '..hH....',
    '..hH....',
    '..kr....',
    '..Mm....',
    '..MM....',
    '..kk....',
    '........',
  ],
};

// Kunai pointing North (↑)
export const PROJ_KUNAI_N: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '..kk....',
    '..MM....',
    '..Mm....',
    '..kr....',
    '..hH....',
    '..hH....',
    '........',
  ],
};

// Diagonal kunai SE
export const PROJ_KUNAI_SE: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '.Hh.....',
    '..hr....',
    '...kM...',
    '....Mm..',
    '.....k..',
    '........',
    '........',
  ],
};

// Diagonal kunai NE
export const PROJ_KUNAI_NE: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '........',
    '.....k..',
    '....Mm..',
    '...kM...',
    '..hr....',
    '.Hh.....',
    '........',
  ],
};

// Diagonal kunai SW
export const PROJ_KUNAI_SW: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '.....hH.',
    '....rh..',
    '...Mk...',
    '..mM....',
    '..k.....',
    '........',
    '........',
  ],
};

// Diagonal kunai NW
export const PROJ_KUNAI_NW: PixelPattern = {
  width: 8, height: 8,
  palette: KUNAI_PAL,
  pixels: [
    '........',
    '........',
    '..k.....',
    '..mM....',
    '...Mk...',
    '....rh..',
    '.....hH.',
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
