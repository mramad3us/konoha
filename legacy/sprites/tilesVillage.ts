/**
 * Village tile sprites — 16×8 pixel patterns for new tile types.
 * Same format as tiles.ts: isometric diamond with '.' = transparent.
 */

import type { PixelPattern } from './pixelPatterns.ts';

// ── ROAD (packed tan earth, wider feel than dirt) ──
const ROAD_PAL: Record<string, [number, number, number]> = {
  b: [150, 130, 100],
  d: [130, 112, 85],
  l: [168, 148, 118],
  s: [120, 102, 78],
};

export const TILE_ROAD: PixelPattern = {
  width: 16, height: 8,
  palette: ROAD_PAL,
  pixels: [
    '......bbbb......',
    '....blbbdbbb....',
    '..bbbdbbblbdbb..',
    'bblbbbbbbbbdblbb',
    'bbbdbblbbdbbbbdb',
    '..bbbblbdbbsbb..',
    '....bbsbbbdb....',
    '......bdsb......',
  ],
};

// ── WOODEN FLOOR (warm brown planks with grain lines) ──
const FLOOR_PAL: Record<string, [number, number, number]> = {
  b: [120, 85, 50],
  d: [100, 70, 40],
  l: [140, 100, 62],
  j: [90, 62, 35],    // plank joint
};

export const TILE_WOODEN_FLOOR: PixelPattern = {
  width: 16, height: 8,
  palette: FLOOR_PAL,
  pixels: [
    '......bbbb......',
    '....blbbblbb....',
    '..bbjbbblbbjbb..',
    'bblbjbbbbbjbblbb',
    'bbdbjblbbbjbbdbb',
    '..bbjbbdbbbjbb..',
    '....bbjbblbb....',
    '......bdjb......',
  ],
};

// ── BUILDING WALL (with visible front face for volume) ──
const WALL_PAL: Record<string, [number, number, number]> = {
  b: [75, 65, 55],     // wall top surface
  d: [58, 50, 42],     // top shadow
  l: [90, 80, 68],     // top highlight
  m: [48, 42, 36],     // mortar line
  f: [45, 38, 32],     // front face (darker = receding)
  F: [55, 48, 40],     // front face highlight
  k: [35, 30, 25],     // front face shadow (deepest)
};

export const TILE_BUILDING_WALL: PixelPattern = {
  width: 16, height: 8,
  palette: WALL_PAL,
  pixels: [
    '......lblb......',
    '....blbbdbbb....',
    '..bbmbbblbbmbb..',
    'bblbmbbbbbbmblbb',
    'kkfFfkfFfkfFfkkk',
    '..kkfFfkfFfkkk..',
    '....kkfFfkkk....',
    '......kfkk......',
  ],
};

// ── DOOR (dark frame with lighter center) ──
const DOOR_PAL: Record<string, [number, number, number]> = {
  b: [90, 65, 35],    // door wood
  d: [70, 50, 28],    // frame dark
  l: [110, 82, 48],   // wood highlight
  h: [140, 110, 60],  // handle
};

export const TILE_DOOR: PixelPattern = {
  width: 16, height: 8,
  palette: DOOR_PAL,
  pixels: [
    '......dddd......',
    '....ddbllddd....',
    '..ddbblhblbbdd..',
    'ddbblbbbbbbblbdd',
    'ddbblbbbbbbblbdd',
    '..ddbbblbbbbdd..',
    '....ddbbbbdd....',
    '......dddd......',
  ],
};

// ── BRIDGE (wood planks over water) ──
const BRIDGE_PAL: Record<string, [number, number, number]> = {
  b: [130, 95, 55],
  d: [110, 78, 42],
  l: [150, 115, 70],
  r: [100, 70, 35],   // rail
};

export const TILE_BRIDGE: PixelPattern = {
  width: 16, height: 8,
  palette: BRIDGE_PAL,
  pixels: [
    '......rbbr......',
    '....rlbbdbrl....',
    '..rlbblbbblbrl..',
    'rlbblbbbbbblbblr',
    'rlbbdbblbbbdbbrl',
    '..rlbbblbdblrl..',
    '....rlbbblrl....',
    '......rlrl......',
  ],
};

// ── ROOF (red/brown tiles, Japanese style) ──
const ROOF_PAL: Record<string, [number, number, number]> = {
  b: [140, 50, 40],
  d: [110, 38, 30],
  l: [165, 65, 50],
  s: [100, 32, 25],
};

export const TILE_ROOF: PixelPattern = {
  width: 16, height: 8,
  palette: ROOF_PAL,
  pixels: [
    '......bbbb......',
    '....blbbdbbb....',
    '..bblbdbblbdbb..',
    'bblbdbblbbdblbbb',
    'bbdblbbdbblbdbdb',
    '..bblbdbbblbbb..',
    '....bbdbbblb....',
    '......bdsb......',
  ],
};

// ── SAND (pale tan, training areas) ──
const SAND_PAL: Record<string, [number, number, number]> = {
  b: [200, 185, 150],
  d: [180, 165, 132],
  l: [218, 202, 168],
  s: [165, 150, 118],
};

export const TILE_SAND: PixelPattern = {
  width: 16, height: 8,
  palette: SAND_PAL,
  pixels: [
    '......bbbb......',
    '....blbbdbbb....',
    '..bbbdbbblbbbb..',
    'bblbbbbdbbbdblbb',
    'bbbdblbbbblbbbdb',
    '..bbblbdbbbbsbb..',
    '....bbsbblbb....',
    '......bdsb......',
  ],
};

// ── DEEP WATER (darker blue than regular water) ──
const DEEP_PAL: Record<string, [number, number, number]> = {
  b: [14, 40, 68],
  d: [10, 32, 56],
  l: [30, 60, 95],
  s: [45, 100, 140],
};

export const TILE_DEEP_WATER: PixelPattern = {
  width: 16, height: 8,
  palette: DEEP_PAL,
  pixels: [
    '......bbbb......',
    '....bblbdbbb....',
    '..bbdbbslbbdbb..',
    'bbblbbbdbbblbbdb',
    'bbdbblbbbbdbbblb',
    '..bbbdbblsbbbb..',
    '....bbdbbdbb....',
    '......bdbb......',
  ],
};

// ── CLIFF (grey rock face, impassable) ──
const CLIFF_PAL: Record<string, [number, number, number]> = {
  b: [85, 80, 78],
  d: [65, 60, 58],
  l: [105, 100, 96],
  s: [50, 48, 45],
};

export const TILE_CLIFF: PixelPattern = {
  width: 16, height: 8,
  palette: CLIFF_PAL,
  pixels: [
    '......bbbb......',
    '....blbbdbbb....',
    '..bblbdblbbdbb..',
    'bblbdbblbbdblbbb',
    'bbdblbbsbbblbddb',
    '..bblbdbbblbbb..',
    '....bbdbbblb....',
    '......bdsb......',
  ],
};
