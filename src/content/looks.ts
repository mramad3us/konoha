/**
 * Appearance palettes and generators. Everything is data so characters serialize and
 * regenerate identical sprites on load.
 */

import type { Appearance } from '../ecs/components.ts';
import type { Rng } from '../core/rng.ts';

export const SKIN_TONES = ['#f2c9a0', '#e3b48a', '#d6a072', '#c08a5c', '#a87048', '#8a5a3a'] as const;

export const HAIR_STYLES_M = ['short', 'spiky', 'tied', 'messy', 'buzz', 'long'] as const;
export const HAIR_STYLES_F = ['bob', 'ponytail', 'long', 'buns', 'short', 'tied'] as const;

export const HAIR_COLORS = [
  '#1c1a22', '#2a211c', '#3b2a1e', '#5a3b22', '#7a4a26', '#a0612e', '#c9a25a',
  '#8a8a92', '#d8d4cc', '#5a2430', '#2e3f5c', '#d98aa0',
] as const;

export const EYE_COLORS = ['#2a2420', '#3b2a1e', '#2c4a6a', '#3a6a3a', '#6a4a2a', '#5a2a5a'] as const;

const CIVIL_TOPS = ['#8a5a3a', '#5a6a8a', '#7a7a5a', '#9a6a5a', '#5a7a6a', '#a08a6a', '#6a4a6a', '#b8a888', '#4a5a4a'];
const CIVIL_BOTTOMS = ['#4a3a30', '#3a3a44', '#5a4a3a', '#2e3440', '#4a4438'];

/** Leaf shinobi uniform: navy, with a forest-green flak vest for chunin+. */
export const LEAF = { top: '#2b3550', bottom: '#232a3e', accent: '#c8c2b4', vest: '#4f6b3a', band: '#2a3e66' };

export function civilianLook(rng: Rng, frame: 'm' | 'f'): Appearance {
  return {
    frame,
    skin: rng.int(0, SKIN_TONES.length - 1),
    hair: rng.pick(frame === 'm' ? HAIR_STYLES_M : HAIR_STYLES_F),
    hairColor: rng.pick(HAIR_COLORS.slice(0, 9)),
    eyes: rng.pick(EYE_COLORS),
    top: rng.pick(CIVIL_TOPS),
    bottom: rng.pick(CIVIL_BOTTOMS),
    accent: rng.pick(['#c8b080', '#8a3a30', '#3a5a8a', '#6a8a4a', '#b0a090']),
    headband: 'none',
    headbandColor: '#000000',
  };
}

export function leafLook(rng: Rng, frame: 'm' | 'f', vest: boolean): Appearance {
  return {
    frame,
    skin: rng.int(0, SKIN_TONES.length - 1),
    hair: rng.pick(frame === 'm' ? HAIR_STYLES_M : HAIR_STYLES_F),
    hairColor: rng.pick(HAIR_COLORS),
    eyes: rng.pick(EYE_COLORS),
    top: LEAF.top,
    bottom: LEAF.bottom,
    accent: LEAF.accent,
    headband: 'leaf',
    headbandColor: LEAF.band,
    vest: vest ? 'chunin' : null,
  };
}

export function anbuLook(rng: Rng): Appearance {
  return {
    frame: rng.chance(0.5) ? 'm' : 'f',
    skin: 0,
    hair: rng.pick(['short', 'long', 'tied'] as const),
    hairColor: rng.pick(['#1c1a22', '#8a8a92', '#3b2a1e', '#2e3f5c']),
    eyes: '#1c1a22',
    top: '#3a3a42',
    bottom: '#22222a',
    accent: '#8a8a92',
    headband: 'none',
    headbandColor: '#000000',
    mask: 'anbu',
  };
}

export function banditLook(rng: Rng): Appearance {
  const browns = ['#6a4a30', '#5a4a3a', '#7a5a3a', '#4a3a2a', '#6a5a40', '#5a3a2a'];
  return {
    frame: 'm',
    skin: rng.int(1, SKIN_TONES.length - 1),
    hair: rng.pick(['messy', 'buzz', 'spiky', 'tied', 'long'] as const),
    hairColor: rng.pick(HAIR_COLORS.slice(0, 8)),
    eyes: rng.pick(EYE_COLORS),
    top: rng.pick(browns),
    bottom: rng.pick(['#3a3028', '#2e2a26', '#4a3a2e']),
    accent: rng.pick(['#8a3a30', '#5a2a24', '#9a7a4a']),
    headband: rng.chance(0.4) ? 'plain' : 'none',
    headbandColor: rng.pick(['#7a2a24', '#5a4a3a', '#3a3a3a']),
    mask: rng.chance(0.3) ? 'cloth' : null,
  };
}

export function rogueLook(rng: Rng, missing: boolean): Appearance {
  const frame = rng.chance(0.25) ? 'f' : 'm';
  return {
    frame,
    skin: rng.int(0, SKIN_TONES.length - 1),
    hair: rng.pick(frame === 'm' ? HAIR_STYLES_M : HAIR_STYLES_F),
    hairColor: rng.pick(HAIR_COLORS),
    eyes: rng.pick(['#5a2a2a', '#2a2420', '#4a4a5a']),
    top: missing ? '#26222a' : rng.pick(['#3a3a2e', '#2e3a36', '#3a2e2e']),
    bottom: '#1e1c22',
    accent: missing ? '#6a2a2a' : '#5a5a4a',
    headband: 'slashed',
    headbandColor: missing ? '#3a2228' : rng.pick(['#4a5a6a', '#5a4a3a', '#3a4a3a']),
    mask: missing && rng.chance(0.4) ? 'cloth' : null,
  };
}
