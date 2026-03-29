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
  hair: [200, 195, 188],  // white hat look
  headband: [200, 195, 188],
  pupil: [40, 35, 30],
  belt: [180, 170, 155],  // white apron
  beltHighlight: [200, 190, 175],
};
