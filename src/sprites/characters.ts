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
  o: [46, 20, 26],     // outfit dark (red-tinted navy)
  O: [58, 28, 34],     // outfit mid
  s: [212, 165, 116],  // skin
  h: [230, 150, 170],  // pink hair
  b: [92, 26, 40],     // headband (dark red)
  m: [112, 128, 144],  // metal plate
  M: [136, 153, 169],  // metal highlight
  e: [255, 255, 255],  // eye white
  p: [40, 140, 80],    // green pupil
  w: [224, 216, 200],  // hand wraps
  g: [139, 40, 30],    // belt (red-gold)
  G: [160, 55, 40],    // belt highlight
  S: [36, 16, 20],     // shadow
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
// Same body shapes as Shinobi, palette gives the red overtone + pink hair + green eyes

/** Facing South */
export const CHAR_KUNOICHI_S: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
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

/** Facing North */
export const CHAR_KUNOICHI_N: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
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

/** Facing East */
export const CHAR_KUNOICHI_E: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
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

/** Facing West */
export const CHAR_KUNOICHI_W: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
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

// ── PRONE / UNCONSCIOUS SPRITES ──

/** Shinobi prone (unconscious) — horizontal on ground */
export const CHAR_SHINOBI_PRONE: PixelPattern = {
  width: 16, height: 16,
  palette: SHINOBI_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..hhhssoooooSS..',
    '..hbbhsoOoOoSS..',
    '..hmmhswoogGww..',
    '..hhhssoooooooo.',
    '................',
    '................',
  ],
};

/** Kunoichi prone (unconscious) — horizontal on ground */
export const CHAR_KUNOICHI_PRONE: PixelPattern = {
  width: 16, height: 16,
  palette: KUNOICHI_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..hhhssoooooSS..',
    '..hbbhsoOoOoSS..',
    '..hmmhswoogGww..',
    '..hhhssoooooooo.',
    '................',
    '................',
  ],
};
