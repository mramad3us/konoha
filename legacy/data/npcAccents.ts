/**
 * NPC accent presets for village population.
 * Each accent defines hair, headband, pupil, and belt colors.
 * All share the same black outfit via the composable sprite system.
 */

import type { CharacterAccents } from '../sprites/characters.ts';

// ── HOKAGE (white/grey hair, red/white robes feel via headband) ──
export const ACCENTS_HOKAGE: CharacterAccents = {
  hair: [200, 195, 190],
  headband: [160, 30, 40],
  pupil: [40, 35, 30],
  belt: [160, 30, 40],
  beltHighlight: [185, 50, 60],
};

// ── CHUNIN (standard village look, blue headband) ──
export const ACCENTS_CHUNIN_1: CharacterAccents = {
  hair: [50, 40, 30],
  headband: [26, 58, 92],
  pupil: [35, 30, 25],
  belt: [80, 100, 60],
  beltHighlight: [100, 120, 75],
};

export const ACCENTS_CHUNIN_2: CharacterAccents = {
  hair: [80, 55, 30],
  headband: [26, 58, 92],
  pupil: [40, 35, 28],
  belt: [80, 100, 60],
  beltHighlight: [100, 120, 75],
};

// ── JONIN (distinct, experienced look) ──
export const ACCENTS_JONIN_1: CharacterAccents = {
  hair: [160, 155, 148],  // silver
  headband: [26, 58, 92],
  pupil: [30, 30, 35],
  belt: [60, 70, 80],
  beltHighlight: [80, 90, 100],
};

export const ACCENTS_JONIN_2: CharacterAccents = {
  hair: [35, 30, 50],     // dark purple-black
  headband: [26, 58, 92],
  pupil: [140, 40, 40],   // red eyes
  belt: [60, 60, 70],
  beltHighlight: [80, 80, 90],
};

export const ACCENTS_JONIN_3: CharacterAccents = {
  hair: [100, 70, 35],    // brown
  headband: [26, 58, 92],
  pupil: [40, 35, 25],
  belt: [70, 80, 50],
  beltHighlight: [90, 100, 65],
};

// ── ACADEMY STUDENTS (young, varied) ──
export const ACCENTS_STUDENT_1: CharacterAccents = {
  hair: [40, 35, 55],     // dark blue-ish
  headband: [80, 80, 90], // grey headband (not yet graduated)
  pupil: [35, 30, 25],
  belt: [90, 85, 75],
  beltHighlight: [110, 105, 95],
};

export const ACCENTS_STUDENT_2: CharacterAccents = {
  hair: [180, 100, 50],   // orange-brown
  headband: [80, 80, 90],
  pupil: [50, 100, 50],   // green
  belt: [90, 85, 75],
  beltHighlight: [110, 105, 95],
};

export const ACCENTS_STUDENT_3: CharacterAccents = {
  hair: [60, 45, 35],     // dark brown
  headband: [80, 80, 90],
  pupil: [40, 35, 30],
  belt: [90, 85, 75],
  beltHighlight: [110, 105, 95],
};

// ── CIVILIANS (no headband — use dark hair color for band) ──
export const ACCENTS_CIVILIAN_1: CharacterAccents = {
  hair: [50, 40, 30],
  headband: [50, 40, 30], // matches hair = invisible headband
  pupil: [35, 30, 25],
  belt: [100, 80, 55],
  beltHighlight: [120, 100, 70],
};

export const ACCENTS_CIVILIAN_2: CharacterAccents = {
  hair: [30, 28, 25],     // very dark
  headband: [30, 28, 25],
  pupil: [30, 25, 22],
  belt: [90, 75, 50],
  beltHighlight: [110, 95, 65],
};

export const ACCENTS_CIVILIAN_3: CharacterAccents = {
  hair: [120, 85, 45],    // light brown
  headband: [120, 85, 45],
  pupil: [60, 50, 35],
  belt: [100, 85, 60],
  beltHighlight: [120, 105, 75],
};

export const ACCENTS_CIVILIAN_4: CharacterAccents = {
  hair: [70, 60, 55],     // grey-brown
  headband: [70, 60, 55],
  pupil: [40, 38, 35],
  belt: [95, 80, 58],
  beltHighlight: [115, 100, 72],
};

// ── MEDICAL (white/green feel) ──
export const ACCENTS_MEDIC_1: CharacterAccents = {
  hair: [45, 40, 55],
  headband: [40, 100, 60],  // green headband
  pupil: [35, 30, 28],
  belt: [40, 100, 60],
  beltHighlight: [60, 120, 80],
};

export const ACCENTS_MEDIC_2: CharacterAccents = {
  hair: [140, 120, 100],    // sandy blonde
  headband: [40, 100, 60],
  pupil: [50, 80, 50],
  belt: [40, 100, 60],
  beltHighlight: [60, 120, 80],
};

// ── SHOPKEEPER (warm, approachable) ──
export const ACCENTS_SHOPKEEPER_1: CharacterAccents = {
  hair: [60, 50, 38],
  headband: [60, 50, 38], // no visible headband
  pupil: [45, 38, 30],
  belt: [140, 100, 50],   // golden apron
  beltHighlight: [165, 125, 65],
};

export const ACCENTS_SHOPKEEPER_2: CharacterAccents = {
  hair: [40, 35, 30],
  headband: [40, 35, 30],
  pupil: [35, 30, 25],
  belt: [120, 85, 45],
  beltHighlight: [145, 110, 60],
};

// ── RAMEN CHEF ──
export const ACCENTS_CHEF: CharacterAccents = {
  hair: [200, 195, 188],
  headband: [200, 195, 188],
  pupil: [40, 35, 30],
  belt: [180, 170, 155],
  beltHighlight: [200, 190, 175],
};

// ══════════════════════════════════════════
//  CIVILIAN ACCENTS — varied clothing + hair
//  Civilians use CIVILIAN_BODIES (no headband)
//  headband field = hair color (since body has no headband rows)
//  belt/beltHighlight = clothing accent (apron, kimono sash, etc.)
// ══════════════════════════════════════════

export const ACCENTS_CIV_FARMER: CharacterAccents = {
  hair: [70, 55, 35], headband: [70, 55, 35], pupil: [40, 35, 28],
  belt: [110, 90, 55], beltHighlight: [130, 110, 70],
  outfitDark: [80, 65, 45], outfitMid: [95, 78, 55], outfitShadow: [65, 52, 35], // brown work clothes
};

export const ACCENTS_CIV_ELDER_M: CharacterAccents = {
  hair: [180, 175, 168], headband: [180, 175, 168], pupil: [50, 45, 40],
  belt: [80, 70, 55], beltHighlight: [100, 90, 72],
  outfitDark: [60, 55, 50], outfitMid: [75, 70, 64], outfitShadow: [48, 44, 40], // grey robes
};

export const ACCENTS_CIV_ELDER_F: CharacterAccents = {
  hair: [160, 155, 148], headband: [160, 155, 148], pupil: [45, 40, 38],
  belt: [120, 60, 70], beltHighlight: [140, 80, 90],
  outfitDark: [100, 45, 55], outfitMid: [120, 60, 70], outfitShadow: [80, 35, 42], // maroon kimono
};

export const ACCENTS_CIV_YOUNG_M: CharacterAccents = {
  hair: [40, 35, 30], headband: [40, 35, 30], pupil: [35, 30, 25],
  belt: [60, 80, 120], beltHighlight: [80, 100, 140],
  outfitDark: [40, 55, 90], outfitMid: [55, 72, 110], outfitShadow: [30, 42, 72], // blue work clothes
};

export const ACCENTS_CIV_YOUNG_F: CharacterAccents = {
  hair: [50, 35, 25], headband: [50, 35, 25], pupil: [60, 40, 30],
  belt: [150, 80, 90], beltHighlight: [170, 100, 110],
  outfitDark: [130, 60, 70], outfitMid: [150, 80, 90], outfitShadow: [110, 48, 55], // pink kimono
};

export const ACCENTS_CIV_MERCHANT: CharacterAccents = {
  hair: [60, 50, 40], headband: [60, 50, 40], pupil: [40, 35, 30],
  belt: [160, 130, 50], beltHighlight: [180, 150, 70],
  outfitDark: [50, 45, 35], outfitMid: [65, 58, 45], outfitShadow: [38, 34, 28], // dark brown tunic
};

export const ACCENTS_CIV_FISHERMAN: CharacterAccents = {
  hair: [80, 65, 45], headband: [80, 65, 45], pupil: [45, 40, 35],
  belt: [50, 80, 110], beltHighlight: [70, 100, 130],
  outfitDark: [35, 60, 85], outfitMid: [48, 75, 100], outfitShadow: [25, 48, 68], // navy blue vest
};

export const ACCENTS_CIV_ARTISAN: CharacterAccents = {
  hair: [45, 40, 35], headband: [45, 40, 35], pupil: [38, 33, 28],
  belt: [90, 60, 40], beltHighlight: [110, 80, 55],
  outfitDark: [70, 50, 35], outfitMid: [88, 65, 45], outfitShadow: [55, 38, 25], // leather brown
};

export const ACCENTS_CIV_MOTHER: CharacterAccents = {
  hair: [55, 40, 30], headband: [55, 40, 30], pupil: [45, 35, 28],
  belt: [100, 130, 90], beltHighlight: [120, 150, 110],
  outfitDark: [75, 100, 65], outfitMid: [90, 118, 78], outfitShadow: [60, 82, 52], // green kimono
};

export const ACCENTS_CIV_CHILD: CharacterAccents = {
  hair: [80, 60, 35], headband: [80, 60, 35], pupil: [50, 80, 50],
  belt: [180, 140, 60], beltHighlight: [200, 160, 80],
  outfitDark: [150, 110, 40], outfitMid: [175, 135, 55], outfitShadow: [125, 90, 30], // bright yellow
};

export const ACCENTS_CIV_VENDOR_F: CharacterAccents = {
  hair: [30, 28, 25], headband: [30, 28, 25], pupil: [35, 30, 28],
  belt: [140, 50, 50], beltHighlight: [165, 70, 70],
  outfitDark: [120, 38, 38], outfitMid: [140, 52, 52], outfitShadow: [95, 28, 28], // red apron outfit
};

export const ACCENTS_CIV_INNKEEPER: CharacterAccents = {
  hair: [90, 70, 50], headband: [90, 70, 50], pupil: [42, 38, 32],
  belt: [80, 60, 45], beltHighlight: [100, 80, 60],
  outfitDark: [62, 48, 35], outfitMid: [78, 62, 48], outfitShadow: [48, 36, 26], // brown vest
};

export const ACCENTS_CIV_BAKER: CharacterAccents = {
  hair: [65, 50, 38], headband: [65, 50, 38], pupil: [40, 35, 30],
  belt: [190, 185, 175], beltHighlight: [210, 205, 195],
  outfitDark: [170, 165, 155], outfitMid: [190, 185, 175], outfitShadow: [150, 145, 135], // flour-white
};

export const ACCENTS_CIV_TAILOR: CharacterAccents = {
  hair: [35, 30, 50], headband: [35, 30, 50], pupil: [40, 30, 50],
  belt: [130, 80, 140], beltHighlight: [150, 100, 160],
  outfitDark: [100, 60, 110], outfitMid: [120, 78, 130], outfitShadow: [80, 45, 88], // purple outfit
};

export const ACCENTS_CIV_GARDENER: CharacterAccents = {
  hair: [100, 80, 55], headband: [100, 80, 55], pupil: [50, 70, 40],
  belt: [60, 100, 50], beltHighlight: [80, 120, 65],
  outfitDark: [45, 80, 38], outfitMid: [58, 95, 48], outfitShadow: [35, 65, 28], // green work clothes
};

// ══════════════════════════════════════════
//  FEMALE CIVILIAN ACCENTS — colorful hair + eye variations
//  These use FEMALE_CIVILIAN_BODIES (longer hair)
// ══════════════════════════════════════════

export const ACCENTS_CIV_F_PURPLE: CharacterAccents = {
  hair: [120, 60, 140], headband: [120, 60, 140], pupil: [60, 100, 180], // blue eyes
  belt: [100, 80, 120], beltHighlight: [120, 100, 140],
  outfitDark: [80, 50, 95], outfitMid: [100, 68, 115], outfitShadow: [62, 38, 75],
};

export const ACCENTS_CIV_F_PINK: CharacterAccents = {
  hair: [210, 130, 150], headband: [210, 130, 150], pupil: [50, 140, 80], // green eyes
  belt: [160, 90, 110], beltHighlight: [180, 110, 130],
  outfitDark: [140, 65, 80], outfitMid: [160, 82, 98], outfitShadow: [115, 50, 62],
};

export const ACCENTS_CIV_F_BLUE: CharacterAccents = {
  hair: [70, 100, 170], headband: [70, 100, 170], pupil: [50, 140, 80], // green eyes
  belt: [60, 80, 130], beltHighlight: [80, 100, 150],
  outfitDark: [45, 60, 100], outfitMid: [58, 75, 118], outfitShadow: [32, 45, 78],
};

export const ACCENTS_CIV_F_BLONDE: CharacterAccents = {
  hair: [210, 190, 120], headband: [210, 190, 120], pupil: [60, 100, 180], // blue eyes
  belt: [170, 140, 80], beltHighlight: [190, 160, 100],
  outfitDark: [130, 50, 60], outfitMid: [150, 68, 78], outfitShadow: [105, 38, 45],
};

export const ACCENTS_CIV_F_RED: CharacterAccents = {
  hair: [170, 55, 40], headband: [170, 55, 40], pupil: [50, 120, 60], // green eyes
  belt: [120, 40, 35], beltHighlight: [145, 60, 52],
  outfitDark: [85, 70, 50], outfitMid: [102, 85, 62], outfitShadow: [68, 55, 38],
};

export const ACCENTS_CIV_F_SILVER: CharacterAccents = {
  hair: [180, 180, 190], headband: [180, 180, 190], pupil: [100, 60, 140], // purple eyes
  belt: [130, 120, 140], beltHighlight: [150, 140, 160],
  outfitDark: [70, 60, 80], outfitMid: [88, 76, 98], outfitShadow: [55, 46, 64],
};

export const ACCENTS_CIV_F_TEAL: CharacterAccents = {
  hair: [60, 160, 150], headband: [60, 160, 150], pupil: [180, 120, 60], // amber eyes
  belt: [50, 120, 110], beltHighlight: [70, 140, 130],
  outfitDark: [60, 80, 55], outfitMid: [76, 98, 70], outfitShadow: [45, 62, 40],
};

/** All MALE civilian accents */
export const ALL_MALE_CIVILIAN_ACCENTS: CharacterAccents[] = [
  ACCENTS_CIV_FARMER, ACCENTS_CIV_ELDER_M, ACCENTS_CIV_YOUNG_M,
  ACCENTS_CIV_MERCHANT, ACCENTS_CIV_FISHERMAN, ACCENTS_CIV_ARTISAN,
  ACCENTS_CIV_INNKEEPER, ACCENTS_CIV_BAKER, ACCENTS_CIV_GARDENER,
];

/** All FEMALE civilian accents (colorful hair + eye variations) */
export const ALL_FEMALE_CIVILIAN_ACCENTS: CharacterAccents[] = [
  ACCENTS_CIV_ELDER_F, ACCENTS_CIV_YOUNG_F, ACCENTS_CIV_MOTHER,
  ACCENTS_CIV_VENDOR_F, ACCENTS_CIV_TAILOR,
  ACCENTS_CIV_F_PURPLE, ACCENTS_CIV_F_PINK, ACCENTS_CIV_F_BLUE,
  ACCENTS_CIV_F_BLONDE, ACCENTS_CIV_F_RED, ACCENTS_CIV_F_SILVER, ACCENTS_CIV_F_TEAL,
];

/** Combined for backward compat */
export const ALL_CIVILIAN_ACCENTS: CharacterAccents[] = [
  ...ALL_MALE_CIVILIAN_ACCENTS, ...ALL_FEMALE_CIVILIAN_ACCENTS,
];
