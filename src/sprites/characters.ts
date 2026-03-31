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
  /** Override outfit colors (civilians wear colored clothing, not black) */
  outfitDark?: RGB;
  outfitMid?: RGB;
  outfitShadow?: RGB;
}

// ── BASE PALETTE (shared black outfit) ──

function buildPalette(accents: CharacterAccents): Record<string, RGB> {
  return {
    o: accents.outfitDark ?? [26, 26, 38],       // outfit dark
    O: accents.outfitMid ?? [34, 34, 48],        // outfit mid
    S: accents.outfitShadow ?? [18, 18, 28],     // outfit shadow
    s: [212, 165, 116],    // skin
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

/** ANBU variant 1: dark grey hair, pure white mask */
export const ACCENTS_ANBU: CharacterAccents = {
  hair: [60, 60, 70],
  headband: [40, 40, 50],
  pupil: [20, 20, 25],
  belt: [50, 50, 60],
  beltHighlight: [70, 70, 80],
  special: [230, 225, 218],
};

/** ANBU variant 2: black hair, off-white mask */
export const ACCENTS_ANBU_2: CharacterAccents = {
  hair: [30, 28, 35],
  headband: [35, 33, 40],
  pupil: [18, 18, 22],
  belt: [45, 45, 55],
  beltHighlight: [65, 65, 75],
  special: [215, 210, 200],
};

/** ANBU variant 3: silver hair, light grey mask */
export const ACCENTS_ANBU_3: CharacterAccents = {
  hair: [140, 140, 150],
  headband: [50, 50, 58],
  pupil: [25, 22, 28],
  belt: [55, 55, 65],
  beltHighlight: [75, 75, 85],
  special: [190, 188, 185],
};

/** ANBU variant 4: brown hair, warm white mask */
export const ACCENTS_ANBU_4: CharacterAccents = {
  hair: [70, 45, 30],
  headband: [42, 38, 45],
  pupil: [22, 20, 18],
  belt: [48, 48, 58],
  beltHighlight: [68, 68, 78],
  special: [225, 218, 205],
};

/** ANBU variant 5: dark purple hair, cool grey mask */
export const ACCENTS_ANBU_5: CharacterAccents = {
  hair: [50, 35, 65],
  headband: [38, 35, 48],
  pupil: [20, 15, 25],
  belt: [52, 48, 62],
  beltHighlight: [72, 68, 82],
  special: [200, 200, 208],
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

// ── RAISED BODY PATTERNS ──
// Hands raised to chest level, slightly apart — the ready/between-signs pose.
// Wraps (w) moved inward from sides but not touching (2px gap between them).

const BODY_RAISED_S: string[] = [
  '................',
  '....hhhhhh......',
  '...hbbbbbbh.....',
  '...hmMmmMmh.....',
  '...hsssssh......',
  '...sepsspes.....',
  '....ssssss......',
  '....oossoo......',
  '...oOwOOwOoo....',  // wraps raised inward, 2px gap
  '...oOwOOwOoo....',
  '...ooGggGoo.....',  // no side wraps
  '....oooooo......',
  '....oSooSo......',
  '....oSooSo......',
  '....oSooSo......',
  '....SS..SS......',
];

const BODY_RAISED_N: string[] = [
  '................',
  '....hhhhhh......',
  '...hhhhhhhh.....',
  '...hhhhhhhh.....',
  '...hhhhhhhh.....',
  '...bbhhhbbb.....',
  '....hhhhhh......',
  '....oossoo......',
  '...oOoOoOoo.....',
  '...oOwOOwOoo....',  // wraps visible from behind
  '...ooGggGoo.....',
  '....oooooo......',
  '....oSooSo......',
  '....oSooSo......',
  '....oSooSo......',
  '....SS..SS......',
];

const BODY_RAISED_E: string[] = [
  '................',
  '.....hhhhh......',
  '....hhhhhh......',
  '....bbbmMhh.....',
  '....hsssshh.....',
  '....hsseps......',
  '.....sssss......',
  '.....oosso......',
  '....oOoOoo......',
  '....oOwOOwoo....',  // wraps raised inward, 2px gap
  '....oGggoo......',
  '.....ooooo......',
  '.....oSoSo......',
  '.....oSoSo......',
  '.....oSoSo......',
  '.....SS.SS......',
];

const BODY_RAISED_W: string[] = [
  '................',
  '......hhhhh.....',
  '......hhhhhh....',
  '.....hhMmbbbb...',
  '.....hhssssh....',
  '......spessh....',
  '......sssss.....',
  '......ossoo.....',
  '......ooOoOo....',
  '....oowOOwoo....',  // wraps raised inward, 2px gap
  '......ooggGo....',
  '......oooooo....',
  '......oSoSo.....',
  '......oSoSo.....',
  '......oSoSo.....',
  '......SS.SS.....',
];

/** Raised body overrides for regular shinobi */
export const RAISED_BODIES: BodyOverrides = {
  s: BODY_RAISED_S,
  n: BODY_RAISED_N,
  e: BODY_RAISED_E,
  w: BODY_RAISED_W,
};

// ── SIGNING (JOINED) BODY PATTERNS ──
// Hands joined at chest level — wraps touching at center.

const BODY_SIGN_S: string[] = [
  '................',
  '....hhhhhh......',
  '...hbbbbbbh.....',
  '...hmMmmMmh.....',
  '...hsssssh......',
  '...sepsspes.....',
  '....ssssss......',
  '....oossoo......',
  '...oOowwOoo.....',  // wraps meeting at center
  '...oOowwOoo.....',
  '...ooGggGoo.....',
  '....oooooo......',
  '....oSooSo......',
  '....oSooSo......',
  '....oSooSo......',
  '....SS..SS......',
];

const BODY_SIGN_N: string[] = [
  '................',
  '....hhhhhh......',
  '...hhhhhhhh.....',
  '...hhhhhhhh.....',
  '...hhhhhhhh.....',
  '...bbhhhbbb.....',
  '....hhhhhh......',
  '....oossoo......',
  '...oOoOoOoo.....',
  '...oOowwOoo.....',  // wraps peeking from behind
  '...ooGggGoo.....',
  '....oooooo......',
  '....oSooSo......',
  '....oSooSo......',
  '....oSooSo......',
  '....SS..SS......',
];

const BODY_SIGN_E: string[] = [
  '................',
  '.....hhhhh......',
  '....hhhhhh......',
  '....bbbmMhh.....',
  '....hsssshh.....',
  '....hsseps......',
  '.....sssss......',
  '.....oosso......',
  '....oOoOoo......',
  '....oOowwoo.....',  // wraps meeting at front
  '....oGggoo......',
  '.....ooooo......',
  '.....oSoSo......',
  '.....oSoSo......',
  '.....oSoSo......',
  '.....SS.SS......',
];

const BODY_SIGN_W: string[] = [
  '................',
  '......hhhhh.....',
  '......hhhhhh....',
  '.....hhMmbbbb...',
  '.....hhssssh....',
  '......spessh....',
  '......sssss.....',
  '......ossoo.....',
  '......ooOoOo....',
  '.....oowwOoo....',  // wraps meeting at front
  '......ooggGo....',
  '......oooooo....',
  '......oSoSo.....',
  '......oSoSo.....',
  '......oSoSo.....',
  '......SS.SS.....',
];

/** Signing (joined) body overrides for regular shinobi */
export const SIGNING_BODIES: BodyOverrides = {
  s: BODY_SIGN_S,
  n: BODY_SIGN_N,
  e: BODY_SIGN_E,
  w: BODY_SIGN_W,
};

/** Raised body overrides for ANBU — mask face + hands up apart */
export const ANBU_RAISED_BODIES: BodyOverrides = {
  s: [
    '................',
    '....hhhhhh......',
    '...hhKKKKhh.....',
    '...hKKKKKKh.....',
    '...hKKKKKKh.....',
    '...hKKKKKKh.....',
    '....hKKKKh......',
    '....ooKKoo......',
    '...oOwOOwOoo....',
    '...oOwOOwOoo....',
    '...ooGggGoo.....',
    '....oooooo......',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
  e: [
    '................',
    '.....hhhhh......',
    '....hhKKKh......',
    '....hKKKKhh.....',
    '....hKKKKhh.....',
    '....hKKKKK......',
    '.....KKKK.......',
    '.....ooKKo......',
    '....oOoOoo......',
    '....oOwOOwoo....',
    '....oGggoo......',
    '.....ooooo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....SS.SS......',
  ],
  w: [
    '................',
    '......hhhhh.....',
    '......KKKhh.....',
    '.....hhKKKKh....',
    '.....hhKKKKh....',
    '......KKKKKh....',
    '......KKKK......',
    '......oKKoo.....',
    '......ooOoOo....',
    '....oowOOwoo....',
    '......ooggGo....',
    '......oooooo....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......SS.SS.....',
  ],
};

/** Signing (joined) body overrides for ANBU — mask face + hands clasped */
export const ANBU_SIGNING_BODIES: BodyOverrides = {
  s: [
    '................',
    '....hhhhhh......',
    '...hhKKKKhh.....',
    '...hKKKKKKh.....',
    '...hKKKKKKh.....',
    '...hKKKKKKh.....',
    '....hKKKKh......',
    '....ooKKoo......',
    '...oOowwOoo.....',
    '...oOowwOoo.....',
    '...ooGggGoo.....',
    '....oooooo......',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
  e: [
    '................',
    '.....hhhhh......',
    '....hhKKKh......',
    '....hKKKKhh.....',
    '....hKKKKhh.....',
    '....hKKKKK......',
    '.....KKKK.......',
    '.....ooKKo......',
    '....oOoOoo......',
    '....oOowwoo.....',
    '....oGggoo......',
    '.....ooooo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....SS.SS......',
  ],
  w: [
    '................',
    '......hhhhh.....',
    '......KKKhh.....',
    '.....hhKKKKh....',
    '.....hhKKKKh....',
    '......KKKKKh....',
    '......KKKK......',
    '......oKKoo.....',
    '......ooOoOo....',
    '.....oowwOoo....',
    '......ooggGo....',
    '......oooooo....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......SS.SS.....',
  ],
};

// ── SPRITE GENERATION ──

/** Optional custom body patterns for special character types */
export interface BodyOverrides {
  s?: string[];
  n?: string[];
  e?: string[];
  w?: string[];
  prone?: string[];
}

/** Generate a full set of directional sprites for a character */
export function generateCharacterSprites(accents: CharacterAccents, overrides?: BodyOverrides): {
  s: PixelPattern; n: PixelPattern; e: PixelPattern; w: PixelPattern; prone: PixelPattern;
} {
  const palette = buildPalette(accents);
  return {
    s:     { width: 16, height: 16, palette, pixels: overrides?.s ?? BODY_S },
    n:     { width: 16, height: 16, palette, pixels: overrides?.n ?? BODY_N },
    e:     { width: 16, height: 16, palette, pixels: overrides?.e ?? BODY_E },
    w:     { width: 16, height: 16, palette, pixels: overrides?.w ?? BODY_W },
    prone: { width: 16, height: 16, palette, pixels: overrides?.prone ?? BODY_PRONE },
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

// ── Pre-built RAISED sprites (hands up, apart — ready pose) ──
const hasuke_raised = generateCharacterSprites(ACCENTS_HASUKE, RAISED_BODIES);
export const CHAR_SHINOBI_RAISED_S = hasuke_raised.s;
export const CHAR_SHINOBI_RAISED_N = hasuke_raised.n;
export const CHAR_SHINOBI_RAISED_E = hasuke_raised.e;
export const CHAR_SHINOBI_RAISED_W = hasuke_raised.w;

const kasura_raised = generateCharacterSprites(ACCENTS_KASURA, RAISED_BODIES);
export const CHAR_KUNOICHI_RAISED_S = kasura_raised.s;
export const CHAR_KUNOICHI_RAISED_N = kasura_raised.n;
export const CHAR_KUNOICHI_RAISED_E = kasura_raised.e;
export const CHAR_KUNOICHI_RAISED_W = kasura_raised.w;

// ── Pre-built SIGNING sprites (hands joined) ──
const hasuke_sign = generateCharacterSprites(ACCENTS_HASUKE, SIGNING_BODIES);
export const CHAR_SHINOBI_SIGN_S = hasuke_sign.s;
export const CHAR_SHINOBI_SIGN_N = hasuke_sign.n;
export const CHAR_SHINOBI_SIGN_E = hasuke_sign.e;
export const CHAR_SHINOBI_SIGN_W = hasuke_sign.w;

const kasura_sign = generateCharacterSprites(ACCENTS_KASURA, SIGNING_BODIES);
export const CHAR_KUNOICHI_SIGN_S = kasura_sign.s;
export const CHAR_KUNOICHI_SIGN_N = kasura_sign.n;
export const CHAR_KUNOICHI_SIGN_E = kasura_sign.e;
export const CHAR_KUNOICHI_SIGN_W = kasura_sign.w;

// ── CIVILIAN body overrides — no headband, no hand wraps, simpler outfit ──
// Hair covers where headband would be. No metal plate. No wraps on hands.
// Belt/sash is the main color accent (apron, obi, etc.)
export const CIVILIAN_BODIES: BodyOverrides = {
  s: [
    '................',
    '....hhhhhh......',
    '...hhhhhhhh.....',
    '...hhhhhhh......',
    '...hsssssh......',
    '...sepsspes.....',
    '....ssssss......',
    '....oossoo......',
    '...oOoGgOoo.....',
    '...oOoGgOoo.....',
    '...ooGggGoo.....',
    '....oooooo......',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
  n: [
    '................',
    '....hhhhhh......',
    '...hhhhhhhh.....',
    '...hhhhhhhh.....',
    '...hhhhhhhh.....',
    '...hhhhhhhh.....',
    '....hhhhhh......',
    '....oossoo......',
    '...oOoGgOoo.....',
    '...oOoGgOoo.....',
    '...ooGggGoo.....',
    '....oooooo......',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
  e: [
    '................',
    '.....hhhhh......',
    '....hhhhhh......',
    '....hhhhhh......',
    '....hsssshh.....',
    '....hsseps......',
    '.....sssss......',
    '.....oosso......',
    '....oOoGoo......',
    '....oOoGoo......',
    '....oGggoo......',
    '.....ooooo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....SS.SS......',
  ],
  w: [
    '................',
    '......hhhhh.....',
    '......hhhhhh....',
    '......hhhhhh....',
    '.....hhssssh....',
    '......spessh....',
    '......sssss.....',
    '......ossoo.....',
    '......ooGoOo....',
    '......ooGoOo....',
    '......ooggGo....',
    '......oooooo....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......SS.SS.....',
  ],
  prone: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.hhhh...........',
    '.hhhhss.........',
    '.hhhhsssoooooo..',
    '.hhhsssoOoGoOo..',
    '..sssssoOoGoOo..',
    '......ooGggGoo..',
    '......oSoooSo...',
    '......oSoooSo...',
    '.......SS.SS....',
    '................',
    '................',
  ],
};

// ── FEMALE CIVILIAN body overrides — longer hair, no headband ──
export const FEMALE_CIVILIAN_BODIES: BodyOverrides = {
  s: [
    '................',
    '...hhhhhhh......',
    '..hhhhhhhhh.....',
    '..hhhhhhhhh.....',
    '..hhsssshh......',
    '..hsepsspesh....',
    '...hsssssh......',
    '....oossoo......',
    '...oOoGgOoo.....',
    '...oOoGgOoo.....',
    '...ooGggGoo.....',
    '....oooooo......',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
  n: [
    '................',
    '...hhhhhhh......',
    '..hhhhhhhhh.....',
    '..hhhhhhhhh.....',
    '..hhhhhhhhh.....',
    '..hhhhhhhhh.....',
    '...hhhhhhh......',
    '....oossoo......',
    '...oOoGgOoo.....',
    '...oOoGgOoo.....',
    '...ooGggGoo.....',
    '....oooooo......',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
  e: [
    '................',
    '....hhhhhh......',
    '...hhhhhhh......',
    '...hhhhhhh......',
    '...hhssshhh.....',
    '...hhssepsh.....',
    '....hsssss......',
    '.....oosso......',
    '....oOoGoo......',
    '....oOoGoo......',
    '....oGggoo......',
    '.....ooooo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....SS.SS......',
  ],
  w: [
    '................',
    '......hhhhhh....',
    '.......hhhhhh...',
    '.......hhhhhh...',
    '.....hhhsshhh...',
    '.....hspesshhh..',
    '......sssss.....',
    '......ossoo.....',
    '......ooGoOo....',
    '......ooGoOo....',
    '......ooggGo....',
    '......oooooo....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......oSoSo.....',
    '......SS.SS.....',
  ],
  prone: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.hhhhh..........',
    '.hhhhhss........',
    '.hhhssssoooooo..',
    '.hhhhssoOoGoOo..',
    '..sssssoOoGoOo..',
    '......ooGggGoo..',
    '......oSoooSo...',
    '......oSoooSo...',
    '.......SS.SS....',
    '................',
    '................',
  ],
};

// ANBU body overrides — same as regular but face is solid mask (K), no eyes/chin/ears
// Hair and headband stay. Face area = solid porcelain white.
export const ANBU_BODIES: BodyOverrides = {
  s: [
    '................',
    '....hhhhhh......',
    '...hhKKKKhh.....',
    '...hKKKKKKh.....',
    '...hKKKKKKh.....',
    '...hKKKKKKh.....',
    '....hKKKKh......',
    '....ooKKoo......',
    '...oOoOoOoo.....',
    '...oOoOoOoo.....',
    '..wooGggGoo.....',
    '..w.oooooo.w....',
    '....oSooSo......',
    '....oSooSo......',
    '....oSooSo......',
    '....SS..SS......',
  ],
  e: [
    '................',
    '.....hhhhh......',
    '....hhKKKh......',
    '....hKKKKhh.....',
    '....hKKKKhh.....',
    '....hKKKKK......',
    '.....KKKK.......',
    '.....ooKKo......',
    '....oOoOoo......',
    '....oOoOoow.....',
    '....oGggoo.w....',
    '.....ooooow.....',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....oSoSo......',
    '.....SS.SS......',
  ],
  w: [
    '................',
    '......hhhhh.....',
    '......KKKhh.....',
    '.....hhKKKKh....',
    '.....hhKKKKh....',
    '......KKKKKh....',
    '......KKKK......',
    '......oKKoo.....',
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

const anbu1 = generateCharacterSprites(ACCENTS_ANBU, ANBU_BODIES);
export const CHAR_ANBU_S = anbu1.s;
export const CHAR_ANBU_N = anbu1.n;
export const CHAR_ANBU_E = anbu1.e;
export const CHAR_ANBU_W = anbu1.w;
export const CHAR_ANBU_PRONE = anbu1.prone;

const anbu2 = generateCharacterSprites(ACCENTS_ANBU_2, ANBU_BODIES);
export const CHAR_ANBU2_S = anbu2.s;
export const CHAR_ANBU2_N = anbu2.n;
export const CHAR_ANBU2_E = anbu2.e;
export const CHAR_ANBU2_W = anbu2.w;
export const CHAR_ANBU2_PRONE = anbu2.prone;

const anbu3 = generateCharacterSprites(ACCENTS_ANBU_3, ANBU_BODIES);
export const CHAR_ANBU3_S = anbu3.s;
export const CHAR_ANBU3_N = anbu3.n;
export const CHAR_ANBU3_E = anbu3.e;
export const CHAR_ANBU3_W = anbu3.w;
export const CHAR_ANBU3_PRONE = anbu3.prone;

const anbu4 = generateCharacterSprites(ACCENTS_ANBU_4, ANBU_BODIES);
export const CHAR_ANBU4_S = anbu4.s;
export const CHAR_ANBU4_N = anbu4.n;
export const CHAR_ANBU4_E = anbu4.e;
export const CHAR_ANBU4_W = anbu4.w;
export const CHAR_ANBU4_PRONE = anbu4.prone;

const anbu5 = generateCharacterSprites(ACCENTS_ANBU_5, ANBU_BODIES);
export const CHAR_ANBU5_S = anbu5.s;
export const CHAR_ANBU5_N = anbu5.n;
export const CHAR_ANBU5_E = anbu5.e;
export const CHAR_ANBU5_W = anbu5.w;
export const CHAR_ANBU5_PRONE = anbu5.prone;

const takeshi = generateCharacterSprites(ACCENTS_TAKESHI);
export const CHAR_TAKESHI_S = takeshi.s;
export const CHAR_TAKESHI_N = takeshi.n;
export const CHAR_TAKESHI_E = takeshi.e;
export const CHAR_TAKESHI_W = takeshi.w;
export const CHAR_TAKESHI_PRONE = takeshi.prone;

// ── Pre-built SIGNING sprites for named NPCs ──

const takeshi_raised = generateCharacterSprites(ACCENTS_TAKESHI, RAISED_BODIES);
export const CHAR_TAKESHI_RAISED_S = takeshi_raised.s;
export const CHAR_TAKESHI_RAISED_N = takeshi_raised.n;
export const CHAR_TAKESHI_RAISED_E = takeshi_raised.e;
export const CHAR_TAKESHI_RAISED_W = takeshi_raised.w;

const takeshi_sign = generateCharacterSprites(ACCENTS_TAKESHI, SIGNING_BODIES);
export const CHAR_TAKESHI_SIGN_S = takeshi_sign.s;
export const CHAR_TAKESHI_SIGN_N = takeshi_sign.n;
export const CHAR_TAKESHI_SIGN_E = takeshi_sign.e;
export const CHAR_TAKESHI_SIGN_W = takeshi_sign.w;

const anbu1_raised = generateCharacterSprites(ACCENTS_ANBU, ANBU_RAISED_BODIES);
export const CHAR_ANBU_RAISED_S = anbu1_raised.s;
export const CHAR_ANBU_RAISED_N = anbu1_raised.n;
export const CHAR_ANBU_RAISED_E = anbu1_raised.e;
export const CHAR_ANBU_RAISED_W = anbu1_raised.w;

const anbu1_sign = generateCharacterSprites(ACCENTS_ANBU, ANBU_SIGNING_BODIES);
export const CHAR_ANBU_SIGN_S = anbu1_sign.s;
export const CHAR_ANBU_SIGN_N = anbu1_sign.n;
export const CHAR_ANBU_SIGN_E = anbu1_sign.e;
export const CHAR_ANBU_SIGN_W = anbu1_sign.w;

const anbu2_raised = generateCharacterSprites(ACCENTS_ANBU_2, ANBU_RAISED_BODIES);
export const CHAR_ANBU2_RAISED_S = anbu2_raised.s;
export const CHAR_ANBU2_RAISED_N = anbu2_raised.n;
export const CHAR_ANBU2_RAISED_E = anbu2_raised.e;
export const CHAR_ANBU2_RAISED_W = anbu2_raised.w;

const anbu2_sign = generateCharacterSprites(ACCENTS_ANBU_2, ANBU_SIGNING_BODIES);
export const CHAR_ANBU2_SIGN_S = anbu2_sign.s;
export const CHAR_ANBU2_SIGN_N = anbu2_sign.n;
export const CHAR_ANBU2_SIGN_E = anbu2_sign.e;
export const CHAR_ANBU2_SIGN_W = anbu2_sign.w;

const anbu3_raised = generateCharacterSprites(ACCENTS_ANBU_3, ANBU_RAISED_BODIES);
export const CHAR_ANBU3_RAISED_S = anbu3_raised.s;
export const CHAR_ANBU3_RAISED_N = anbu3_raised.n;
export const CHAR_ANBU3_RAISED_E = anbu3_raised.e;
export const CHAR_ANBU3_RAISED_W = anbu3_raised.w;

const anbu3_sign = generateCharacterSprites(ACCENTS_ANBU_3, ANBU_SIGNING_BODIES);
export const CHAR_ANBU3_SIGN_S = anbu3_sign.s;
export const CHAR_ANBU3_SIGN_N = anbu3_sign.n;
export const CHAR_ANBU3_SIGN_E = anbu3_sign.e;
export const CHAR_ANBU3_SIGN_W = anbu3_sign.w;

const anbu4_raised = generateCharacterSprites(ACCENTS_ANBU_4, ANBU_RAISED_BODIES);
export const CHAR_ANBU4_RAISED_S = anbu4_raised.s;
export const CHAR_ANBU4_RAISED_N = anbu4_raised.n;
export const CHAR_ANBU4_RAISED_E = anbu4_raised.e;
export const CHAR_ANBU4_RAISED_W = anbu4_raised.w;

const anbu4_sign = generateCharacterSprites(ACCENTS_ANBU_4, ANBU_SIGNING_BODIES);
export const CHAR_ANBU4_SIGN_S = anbu4_sign.s;
export const CHAR_ANBU4_SIGN_N = anbu4_sign.n;
export const CHAR_ANBU4_SIGN_E = anbu4_sign.e;
export const CHAR_ANBU4_SIGN_W = anbu4_sign.w;

const anbu5_raised = generateCharacterSprites(ACCENTS_ANBU_5, ANBU_RAISED_BODIES);
export const CHAR_ANBU5_RAISED_S = anbu5_raised.s;
export const CHAR_ANBU5_RAISED_N = anbu5_raised.n;
export const CHAR_ANBU5_RAISED_E = anbu5_raised.e;
export const CHAR_ANBU5_RAISED_W = anbu5_raised.w;

const anbu5_sign = generateCharacterSprites(ACCENTS_ANBU_5, ANBU_SIGNING_BODIES);
export const CHAR_ANBU5_SIGN_S = anbu5_sign.s;
export const CHAR_ANBU5_SIGN_N = anbu5_sign.n;
export const CHAR_ANBU5_SIGN_E = anbu5_sign.e;
export const CHAR_ANBU5_SIGN_W = anbu5_sign.w;
