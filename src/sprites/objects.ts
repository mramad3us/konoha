/**
 * Object sprites — 16×16 pixel patterns rendered on top of tiles.
 * Training dummy, trees, rocks, wooden posts.
 */

import type { PixelPattern } from './pixelPatterns.ts';

// ── TRAINING DUMMY ──
// w = wood, W = wood highlight, k = dark wood, s = straw, S = straw dark
// r = red target, R = red bright, b = headband, m = metal plate

const DUMMY_PAL: Record<string, [number, number, number]> = {
  w: [139, 105, 20],   // wood
  W: [160, 130, 45],   // wood highlight
  k: [107, 86, 48],    // dark wood
  s: [212, 167, 106],  // straw
  S: [185, 138, 74],   // straw dark
  r: [178, 34, 52],    // target red
  R: [212, 54, 74],    // target bright
  b: [26, 58, 92],     // headband
  m: [112, 128, 144],  // metal
};

export const OBJ_DUMMY: PixelPattern = {
  width: 16, height: 16,
  palette: DUMMY_PAL,
  pixels: [
    '................',
    '.....sSSs.......',
    '....sSbbSs......',
    '....sSmmSs......',
    '....sSSSSs......',
    '.....ssSs.......',
    '....ssssss......',
    '...wsSrRSsw.....',
    '...WsrRRrsW.....',
    '...wsSrRSsw.....',
    '....ssssss......',
    '.....wWw........',
    '.....wWw........',
    '.....wWw........',
    '....kwWwk.......',
    '....kkkk........',
  ],
};

// ── SMALL TREE ──
// t = trunk, T = trunk highlight, c = canopy dark, C = canopy mid, l = leaf highlight

const TREE_SM_PAL: Record<string, [number, number, number]> = {
  t: [107, 76, 30],    // trunk
  T: [122, 90, 42],    // trunk highlight
  c: [26, 74, 51],     // canopy dark
  C: [45, 110, 79],    // canopy mid
  l: [64, 144, 94],    // leaf highlight
};

export const OBJ_TREE_SMALL: PixelPattern = {
  width: 16, height: 16,
  palette: TREE_SM_PAL,
  pixels: [
    '................',
    '................',
    '......cCc.......',
    '.....cCClCc.....',
    '....cClCCcCc....',
    '...cCCcClcCCc...',
    '...cClcCCcClc...',
    '....cCCClCCc....',
    '.....cCcCc......',
    '......tTt.......',
    '......tTt.......',
    '......tTt.......',
    '......tTt.......',
    '......tTt.......',
    '.....ttTt.......',
    '................',
  ],
};

// ── LARGE TREE ──
const TREE_LG_PAL: Record<string, [number, number, number]> = {
  t: [90, 60, 20],
  T: [107, 76, 30],
  c: [22, 61, 42],
  C: [45, 110, 79],
  l: [64, 144, 94],
  d: [16, 48, 33],     // deepest shadow
};

export const OBJ_TREE_LARGE: PixelPattern = {
  width: 16, height: 16,
  palette: TREE_LG_PAL,
  pixels: [
    '.....dCCd.......',
    '....dCClCCd.....',
    '...dCClCcCCd....',
    '..dCCcClcCCCd...',
    '..dClCCcCClCd...',
    '.dCCcClCcCCCCd..',
    '.dClCCcCClcCCd..',
    '..dCCcClcCCCd...',
    '...dCClCcCCd....',
    '....dCCCCd......',
    '......tTt.......',
    '.....tTTTt......',
    '......tTt.......',
    '......tTt.......',
    '.....ttTtt......',
    '................',
  ],
};

// ── ROCK ──
const ROCK_PAL: Record<string, [number, number, number]> = {
  d: [80, 80, 80],     // dark
  b: [96, 96, 96],     // base
  l: [120, 120, 120],  // light
  h: [140, 140, 140],  // highlight
  s: [64, 64, 64],     // shadow
};

export const OBJ_ROCK: PixelPattern = {
  width: 16, height: 16,
  palette: ROCK_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......hlb.......',
    '.....hllbb......',
    '....hllbbbd.....',
    '...hlllbbbd.....',
    '...hllbbbds.....',
    '....bbbbds......',
    '.....ssss.......',
    '................',
    '................',
  ],
};
