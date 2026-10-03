/**
 * Isometric tile patterns — 16x8 pixel grids scaled to 48x24 display.
 * Diamond shape is baked into the pattern (. = transparent).
 *
 * 16-wide x 8-tall pattern maps to 48x24 display pixels (3x scale).
 * The diamond occupies the shape: cols[8-i..8+i] for each row i from top.
 *
 * Retro 8-bit STYLED with modern clarity: flat fills, limited palette,
 * chunky detail blocks, clean hard edges.
 */

import type { PixelPattern } from './pixelPatterns.ts';

// ── GRASS PALETTES ──
// b = base, d = dark, l = light, e = earth speck, s = shadow

const GRASS_PAL_1: Record<string, [number, number, number]> = {
  b: [59, 125, 38],   // base green
  d: [47, 108, 30],   // dark green
  l: [74, 148, 50],   // light green
  e: [90, 74, 42],    // earth
  s: [38, 94, 24],    // shadow
};

const GRASS_PAL_2: Record<string, [number, number, number]> = {
  b: [51, 110, 32],
  d: [42, 94, 24],
  l: [67, 140, 46],
  e: [80, 66, 38],
  s: [34, 82, 20],
};

const GRASS_PAL_3: Record<string, [number, number, number]> = {
  b: [66, 138, 44],
  d: [54, 120, 34],
  l: [82, 160, 58],
  e: [85, 70, 40],
  s: [46, 104, 28],
};

/** Grass variant 1 */
export const TILE_GRASS1: PixelPattern = {
  width: 16, height: 8,
  palette: GRASS_PAL_1,
  pixels: [
    '......bbbb......',
    '....bbbdbbbb....',
    '..bblbbbbbbdbb..',
    'bbbbbdbblbbbbebb',
    'bblbbbbbbbdbbblb',
    '..bbdbblebbbbb..',
    '....bbbsbdbb....',
    '......bsbb......',
  ],
};

/** Grass variant 2 — darker */
export const TILE_GRASS2: PixelPattern = {
  width: 16, height: 8,
  palette: GRASS_PAL_2,
  pixels: [
    '......bbbb......',
    '....bbbbdbbb....',
    '..bbbdbbblbbeb..',
    'bbbblbbbbbdbbdbb',
    'bbdbbbebbbbblbbb',
    '..bbbbbdbbsbbb..',
    '....bbsbbbbb....',
    '......bbsb......',
  ],
};

/** Grass variant 3 — brighter */
export const TILE_GRASS3: PixelPattern = {
  width: 16, height: 8,
  palette: GRASS_PAL_3,
  pixels: [
    '......bbbb......',
    '....blbbbbbb....',
    '..bbbbbdblbbbb..',
    'bbbdbbbbbbblbbbb',
    'bblbbblbbdbbbbdb',
    '..bbbbbbbblbbb..',
    '....bbdbbbbb....',
    '......bbsb......',
  ],
};

// ── DIRT ──
const DIRT_PAL: Record<string, [number, number, number]> = {
  b: [139, 115, 85],   // base brown
  d: [122, 99, 69],    // dark
  l: [160, 140, 106],  // light
  p: [144, 128, 112],  // pebble
  s: [106, 85, 53],    // shadow
};

export const TILE_DIRT: PixelPattern = {
  width: 16, height: 8,
  palette: DIRT_PAL,
  pixels: [
    '......bbbb......',
    '....blbbdbbb....',
    '..bbbdbbblbpbb..',
    'bblbbpbbbbdbbdbb',
    'bbbdbbblbbpbblbb',
    '..bbblbbdbbsbb..',
    '....bsbbblbb....',
    '......bsbb......',
  ],
};

// ── STONE ──
const STONE_PAL: Record<string, [number, number, number]> = {
  b: [104, 110, 118],  // base grey
  d: [88, 94, 102],    // dark
  l: [122, 130, 138],  // light
  j: [80, 86, 94],     // joint/grout
  m: [58, 90, 48],     // moss hint
};

export const TILE_STONE: PixelPattern = {
  width: 16, height: 8,
  palette: STONE_PAL,
  pixels: [
    '......bbbb......',
    '....blbbjblb....',
    '..bblbbbjbbdbb..',
    'jjjjjjjjjjjjjjjj',
    'bbbdbjblbbbjbbmb',
    '..bbbbjbbdbbb...',
    '....bbbjbbbl....',
    '......bdbb......',
  ],
};

// ── FENCE ──
const FENCE_PAL: Record<string, [number, number, number]> = {
  g: [58, 46, 24],     // ground
  w: [122, 90, 32],    // wood
  h: [154, 120, 40],   // highlight
  k: [100, 72, 24],    // dark wood
  p: [139, 105, 20],   // post
};

export const TILE_FENCE: PixelPattern = {
  width: 16, height: 8,
  palette: FENCE_PAL,
  pixels: [
    '......gppp......',
    '....gghwwkhgg...',
    '..gghwwphwwkhgg.',
    'gghwwwwpwwwwwkhg',
    'ggkwwwwpwwwwwhgg',
    '..ggkwwpkwwwgg..',
    '....ggkpwhgg....',
    '......gkgg......',
  ],
};

// ── WATER ──
const WATER_PAL: Record<string, [number, number, number]> = {
  b: [26, 58, 92],     // base deep blue
  d: [20, 48, 80],     // dark
  l: [42, 90, 140],    // ripple light
  s: [64, 144, 192],   // specular
  w: [30, 66, 104],    // mid
};

export const TILE_WATER: PixelPattern = {
  width: 16, height: 8,
  palette: WATER_PAL,
  pixels: [
    '......bbbb......',
    '....bblbwbbb....',
    '..bbwbbslbbdbb..',
    'bbblbbbwbbblbbdb',
    'bbdbblbbbbwbbbwb',
    '..bbbwbblsbbbb..',
    '....bbdbbwbb....',
    '......bdbb......',
  ],
};

// ── GATE ──
const GATE_PAL: Record<string, [number, number, number]> = {
  b: [138, 120, 88],   // base stone
  d: [122, 104, 74],   // dark
  l: [156, 140, 106],  // light
  g: [201, 168, 76],   // gold accent
  s: [96, 104, 112],   // side pillar
};

export const TILE_GATE: PixelPattern = {
  width: 16, height: 8,
  palette: GATE_PAL,
  pixels: [
    '......bbbb......',
    '....slbbblbb....',
    '..sgbbldbblbbb..',
    'bsgbbblbbblbbbgs',
    'bsgbbdbbblbbbgsb',
    '..bgbblbdbbgbb..',
    '....sbbblbbs....',
    '......bdsb......',
  ],
};
