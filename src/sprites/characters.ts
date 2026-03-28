/**
 * Character sprites — 16x16 pixel patterns with auto-outline.
 * Shinobi (male) and Kunoichi (female) in 4 cardinal directions.
 * Dark outfit, headband with metal plate, visible eyes.
 */

import type { PixelPattern } from './pixelPatterns.ts';

// ── SHARED PALETTES ──
// o = outfit dark, O = outfit mid, s = skin, h = hair, b = headband cloth,
// m = metal plate, e = eye white, p = pupil, w = hand wrap, g = belt/gold,
// S = shadow/darker outfit

const SHINOBI_PAL: Record<string, [number, number, number]> = {
  o: [26, 26, 46],     // outfit dark
  O: [34, 34, 58],     // outfit mid
  s: [212, 165, 116],  // skin
  h: [26, 26, 46],     // hair (matches outfit)
  b: [26, 58, 92],     // headband blue
  m: [112, 128, 144],  // metal plate
  M: [136, 153, 169],  // metal highlight
  e: [255, 255, 255],  // eye white
  p: [26, 26, 46],     // pupil
  w: [224, 216, 200],  // hand wraps
  g: [139, 105, 20],   // belt gold
  G: [160, 130, 45],   // belt highlight
  S: [20, 20, 36],     // shadow
};

const KUNOICHI_PAL: Record<string, [number, number, number]> = {
  o: [190, 80, 110],   // pink dress base
  O: [210, 100, 130],  // pink dress light
  s: [212, 165, 116],  // skin
  h: [220, 130, 160],  // pink hair
  H: [240, 160, 185],  // hair highlight
  b: [190, 80, 110],   // headband (matches dress)
  m: [112, 128, 144],  // metal plate
  M: [136, 153, 169],  // metal highlight
  e: [255, 255, 255],  // eye white
  p: [60, 100, 180],   // blue pupil
  w: [224, 216, 200],  // hand wraps
  g: [160, 60, 90],    // belt/sash dark
  G: [190, 80, 110],   // belt highlight
  S: [150, 55, 80],    // shadow/dress dark
  d: [170, 70, 100],   // dress mid-dark (skirt folds)
};

// ── SHINOBI SPRITES ──

/** Facing South (toward camera) */
export const CHAR_SHINOBI_S: PixelPattern = {
  width: 16, height: 16,
  palette: SHINOBI_PAL,
  pixels: [
    '................',
    '....hhhhhh......',
    '...hbbbbbbh.....',
    '...hmMmmMmh.....',
    '...hsssssh......',
    '...sepsspes.....',
    '....ssssss......',
    '....oossoo......',
    '...oOoOoOoo.....',
    '...oOoOoOoo.....',
    '..wooGggGoo.....',
    '..w.oooooo.w....',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
};

/** Facing North (away) */
export const CHAR_SHINOBI_N: PixelPattern = {
  width: 16, height: 16,
  palette: SHINOBI_PAL,
  pixels: [
    '................',
    '....hhhhhh......',
    '...hhhhhhhh.....',
    '...hhhhhhhh.....',
    '...hhhhhhhh.....',
    '...bbhhhbbb.....',
    '....hhhhhh......',
    '....oossoo......',
    '...oOoOoOoo.....',
    '...oOoOoOoo.....',
    '..wooGggGoo.....',
    '..w.oooooo.w....',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
};

/** Facing East (right) */
export const CHAR_SHINOBI_E: PixelPattern = {
  width: 16, height: 16,
  palette: SHINOBI_PAL,
  pixels: [
    '................',
    '.....hhhhh......',
    '....hhhhhh......',
    '....bbbmMhh.....',
    '....hsssshh.....',
    '....hsseps......',
    '.....sssss......',
    '.....oosso......',
    '....oOoOoo......',
    '....oOoOoow.....',
    '....oGggoo.w....',
    '.....ooooow.....',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....SS.SS......',
  ],
};

/** Facing West (left) */
export const CHAR_SHINOBI_W: PixelPattern = {
  width: 16, height: 16,
  palette: SHINOBI_PAL,
  pixels: [
    '................',
    '......hhhhh.....',
    '......hhhhhh....',
    '.....hhMmbbbb...',
    '.....hhssssh....',
    '......spessh....',
    '......sssss.....',
    '......ossoo.....',
    '......ooOoOo....',
    '.....wooOoOo....',
    '....w.ooggGo....',
    '.....woooooo....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......SS.SS.....',
  ],
};

// ── KUNOICHI SPRITES ──

/** Facing South — pink combat dress, flowing hair, blue eyes */
export const CHAR_KUNOICHI_S: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
  pixels: [
    '................',
    '...HhhhhhhhH....',
    '...hbbbbbbhh....',
    '...hmMmmMmhh....',
    '..Hhssssshhh....',
    '..hsepsspeHh....',
    '...hssssshh.....',
    '....oossoo......',
    '...oOoOoOoo.....',
    '..woOGggGOow....',
    '..w.ooooooo.....',
    '...oodSdSdoo....',
    '..oOdSoooSdOo...',
    '..oOdooooOdOo...',
    '...SdS..Sdo.....',
    '....SS..SS......',
  ],
};

/** Facing North — back view, long pink hair, dress visible */
export const CHAR_KUNOICHI_N: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
  pixels: [
    '................',
    '...HhhhhhhhH....',
    '..HhhhhhhhhHh...',
    '..hhhhhhhhhhh...',
    '..hhhhhhhhhhh...',
    '..bbhhhhhbbhh...',
    '..hhhhhhhhhhh...',
    '....oossoo......',
    '...oOoOoOoo.....',
    '..woOGggGOow....',
    '..w.ooooooo.....',
    '...oodSdSdoo....',
    '..oOdSoooSdOo...',
    '..oOdooooOdOo...',
    '...SdS..Sdo.....',
    '....SS..SS......',
  ],
};

/** Facing East — side view, hair trails behind, dress flare */
export const CHAR_KUNOICHI_E: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
  pixels: [
    '................',
    '....Hhhhh.......',
    '....hhhhhh......',
    '....bbbmMhh.....',
    '...hhssssHhh....',
    '....hssepHhh....',
    '.....sssssh.....',
    '.....oossoo.....',
    '....oOoOoow.....',
    '....oGggOo.w....',
    '.....ooooo......',
    '....odSdSdoo....',
    '...oSdooSdOo....',
    '...oSdooodOo....',
    '....Sd..Sdo.....',
    '.....S..SS......',
  ],
};

/** Facing West — side view, hair trails behind, dress flare */
export const CHAR_KUNOICHI_W: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
  pixels: [
    '................',
    '.......hhhHh....',
    '......hhhhhh....',
    '.....hhMmbbbb...',
    '....hhHsssshh...',
    '....hhhpessh....',
    '.....hssssss....',
    '.....oossoo.....',
    '.....wooOoOo....',
    '....w.oOggGo....',
    '......ooooo.....',
    '....oodSdSdo....',
    '...oOdSoodSo....',
    '...oOdooodSo....',
    '.....odS..dS....',
    '......SS..S.....',
  ],
};
