/**
 * Composable character sprite system.
 *
 * All shinobi/kunoichi share the same black outfit pixel patterns.
 * Only accent colors differ: hair, headband, belt, pupil.
 * This scales to hundreds of unique characters from minimal data.
 *
 * Pattern slots:
 *   o/O = outfit dark/mid (always black)
 *   S   = outfit shadow (always darkest)
 *   s   = skin
 *   h   = hair (accent)
 *   b   = headband cloth (accent)
 *   m/M = metal plate/highlight (shared)
 *   e   = eye white
 *   p   = pupil (accent)
 *   w   = hand wraps (shared)
 *   g/G = belt/highlight (accent)
 *   K   = special slot (mask for ANBU, hat for Kage)
 */

import type { PixelPattern, RGB } from './pixelPatterns.ts';

// ── ACCENT DEFINITION ──

export interface CharacterAccents {
  hair: RGB;
  headband: RGB;
  pupil: RGB;
  belt: RGB;
  beltHighlight: RGB;
  /** Optional special overlay color (ANBU mask, Kage hat) */
  special?: RGB;
  /** Override skin color (e.g. porcelain white for ANBU mask) */
  skinOverride?: RGB;
}

// ── BASE PALETTE (shared black outfit) ──

function buildPalette(accents: CharacterAccents): Record<string, RGB> {
  return {
    o: [26, 26, 38],       // outfit dark
    O: [34, 34, 48],       // outfit mid
    S: [18, 18, 28],       // outfit shadow
    s: accents.skinOverride ?? [212, 165, 116],    // skin (or mask)
    h: accents.hair,
    b: accents.headband,
    m: [112, 128, 144],    // metal plate
    M: [136, 153, 169],    // metal highlight
    e: [255, 255, 255],    // eye white
    p: accents.pupil,
    w: [200, 195, 185],    // hand wraps (slightly off-white)
    g: accents.belt,
    G: accents.beltHighlight,
    K: accents.special ?? [112, 128, 144], // special slot
  };
}

// ── PRESET ACCENTS ──

/** Default shinobi: dark hair, blue headband, dark eyes, gold belt */
export const ACCENTS_HASUKE: CharacterAccents = {
  hair: [26, 26, 38],
  headband: [26, 58, 92],
  pupil: [26, 26, 38],
  belt: [139, 105, 20],
  beltHighlight: [160, 130, 45],
};

/** Default kunoichi (Kasura): pink hair, red headband, green eyes, red belt */
export const ACCENTS_KASURA: CharacterAccents = {
  hair: [230, 150, 170],
  headband: [92, 26, 40],
  pupil: [40, 140, 80],
  belt: [139, 40, 30],
  beltHighlight: [160, 55, 40],
};

/** Takeshi (training grounds sparring partner): spiky brown hair, green headband */
export const ACCENTS_TAKESHI: CharacterAccents = {
  hair: [90, 60, 30],
  headband: [30, 80, 50],
  pupil: [50, 40, 30],
  belt: [80, 100, 60],
  beltHighlight: [100, 120, 75],
};

/** Generic NPC shinobi: brown hair, blue headband */
export const ACCENTS_GENERIC_SHINOBI: CharacterAccents = {
  hair: [70, 50, 35],
  headband: [26, 58, 92],
  pupil: [40, 35, 30],
  belt: [100, 80, 50],
  beltHighlight: [120, 100, 65],
};

/** ANBU: grey hair, porcelain mask (skin replaced with white mask color) */
export const ACCENTS_ANBU: CharacterAccents = {
  hair: [80, 80, 90],
  headband: [40, 40, 50],
  pupil: [30, 10, 10],       // dark red slits for mask eyes
  belt: [60, 60, 70],
  beltHighlight: [80, 80, 90],
  special: [220, 215, 210],  // white mask
  skinOverride: [225, 220, 215], // porcelain white replaces skin = mask
};

/** Kage: white robes accent (special = hat color) */
export const ACCENTS_KAGE: CharacterAccents = {
  hair: [60, 55, 50],
  headband: [178, 34, 52],
  pupil: [30, 30, 35],
  belt: [178, 34, 52],
  beltHighlight: [200, 50, 65],
  special: [200, 30, 45],  // Kage hat red
};

// ── SHARED BODY PATTERNS ──
// These are the SAME for every character. Palette swap = different look.

const BODY_S: string[] = [
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
];

const BODY_N: string[] = [
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
];

const BODY_E: string[] = [
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
];

const BODY_W: string[] = [
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
];

const BODY_PRONE: string[] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.hhhh...........',
  '.hbbhss.........',
  '.hmmhsssoooooo..',
  '.hhhhssoOoOoOo..',
  '..sssssoOoOoOo..',
  '......ooGggGoo..',
  '......oSoooSo...',
  '......oSoooSo...',
  '.......SS.SS....',
  '................',
  '................',
];

// ── SPRITE GENERATION ──

/** Generate a full set of directional sprites for a character */
export function generateCharacterSprites(accents: CharacterAccents): {
  s: PixelPattern; n: PixelPattern; e: PixelPattern; w: PixelPattern; prone: PixelPattern;
} {
  const palette = buildPalette(accents);
  return {
    s:     { width: 16, height: 16, palette, pixels: BODY_S },
    n:     { width: 16, height: 16, palette, pixels: BODY_N },
    e:     { width: 16, height: 16, palette, pixels: BODY_E },
    w:     { width: 16, height: 16, palette, pixels: BODY_W },
    prone: { width: 16, height: 16, palette, pixels: BODY_PRONE },
  };
}

// ── PRE-BUILT SPRITES (for manifest) ──

const hasuke = generateCharacterSprites(ACCENTS_HASUKE);
const kasura = generateCharacterSprites(ACCENTS_KASURA);

export const CHAR_SHINOBI_S = hasuke.s;
export const CHAR_SHINOBI_N = hasuke.n;
export const CHAR_SHINOBI_E = hasuke.e;
export const CHAR_SHINOBI_W = hasuke.w;
export const CHAR_SHINOBI_PRONE = hasuke.prone;

export const CHAR_KUNOICHI_S = kasura.s;
export const CHAR_KUNOICHI_N = kasura.n;
export const CHAR_KUNOICHI_E = kasura.e;
export const CHAR_KUNOICHI_W = kasura.w;
export const CHAR_KUNOICHI_PRONE = kasura.prone;

const anbu = generateCharacterSprites(ACCENTS_ANBU);
export const CHAR_ANBU_S = anbu.s;
export const CHAR_ANBU_N = anbu.n;
export const CHAR_ANBU_E = anbu.e;
export const CHAR_ANBU_W = anbu.w;
export const CHAR_ANBU_PRONE = anbu.prone;

const takeshi = generateCharacterSprites(ACCENTS_TAKESHI);
export const CHAR_TAKESHI_S = takeshi.s;
export const CHAR_TAKESHI_N = takeshi.n;
export const CHAR_TAKESHI_E = takeshi.e;
export const CHAR_TAKESHI_W = takeshi.w;
export const CHAR_TAKESHI_PRONE = takeshi.prone;
