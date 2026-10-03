/**
 * Ninjutsu techniques. Learned automatically when Ninjutsu reaches the unlock level.
 * No new techniques in the remaster's first phase — these are the original five, rebalanced.
 */

export type TechniqueKind = 'reactive' | 'stance' | 'passive' | 'signs';

export interface TechniqueDef {
  id: string;
  name: string;
  jp: string;
  kind: TechniqueKind;
  unlock: number;
  /** Chakra cost at a given Ninjutsu level. */
  cost: (nin: number) => number;
  /** Hand-sign sequence (indices into HAND_SIGNS) for 'signs' techniques. */
  signs?: number[];
  description: string;
}

/** The twelve hand signs, in zodiac order, bound to the number row (1 … = ). */
export const HAND_SIGNS = [
  { name: 'Rat', jp: 'Ne' },
  { name: 'Ox', jp: 'Ushi' },
  { name: 'Tiger', jp: 'Tora' },
  { name: 'Hare', jp: 'U' },
  { name: 'Dragon', jp: 'Tatsu' },
  { name: 'Snake', jp: 'Mi' },
  { name: 'Horse', jp: 'Uma' },
  { name: 'Ram', jp: 'Hitsuji' },
  { name: 'Monkey', jp: 'Saru' },
  { name: 'Bird', jp: 'Tori' },
  { name: 'Dog', jp: 'Inu' },
  { name: 'Boar', jp: 'I' },
] as const;

const scaled = (base: number, min: number) => (nin: number) => Math.max(min, Math.round(base - nin * 0.2));

export const TECHNIQUES: Record<string, TechniqueDef> = {
  kawarimi: {
    id: 'kawarimi', name: 'Substitution', jp: 'Kawarimi no Jutsu', kind: 'reactive', unlock: 5,
    cost: scaled(14, 6),
    description: 'Swap with a log and reappear a few steps away. Breaks a melee engagement. Costs 1 tempo.',
  },
  vanish: {
    id: 'vanish', name: 'Vanish', jp: 'Ninpō: Kakuremino', kind: 'signs', unlock: 5,
    cost: scaled(18, 6), signs: [5, 7, 8, 11],
    description: 'Fade from sight. Enemies cannot see you unless they touch you. Lasts longer with mastery; attacking ends it.',
  },
  dash: {
    id: 'dash', name: 'Chakra Dash', jp: 'Shunshin no Ashi', kind: 'stance', unlock: 10,
    cost: () => 1,
    description: 'Movement stance: chakra in the legs. Very fast, noisy, 1 chakra per step.',
  },
  shadow_step: {
    id: 'shadow_step', name: 'Shadow Step', jp: 'Ninpō: Kage Fumi', kind: 'signs', unlock: 10,
    cost: scaled(24, 8), signs: [2, 3, 4, 9],
    description: 'Blink to a tile you can see. Range grows with mastery. Enemies nearby lose track of you for a moment.',
  },
  water_walk: {
    id: 'water_walk', name: 'Water Walking', jp: 'Suimen Hokō', kind: 'passive', unlock: 15,
    cost: () => 1,
    description: 'Walk on deep water instead of swimming. 1 chakra per step.',
  },
};

export const TECHNIQUE_ORDER = ['kawarimi', 'vanish', 'dash', 'shadow_step', 'water_walk'] as const;

export function vanishDurationTicks(nin: number): number {
  // 30 s at 5, 2 min at 25, 5 min at 50+
  const s = nin >= 50 ? 300 : 30 + (nin - 5) * 4.5;
  return Math.round(s * 10);
}

export function shadowStepRange(nin: number): number {
  return Math.min(10, 3 + Math.floor((nin - 10) / 6));
}

/** Ticks per hand sign: 1.2 s at Ninjutsu 0 → 0.3 s at 60+. */
export function signTicks(nin: number): number {
  return Math.max(3, Math.round(12 - nin * 0.15));
}

export function knownTechniques(nin: number): string[] {
  return TECHNIQUE_ORDER.filter(id => nin >= TECHNIQUES[id].unlock);
}

/** Match a partial sign sequence: 'partial' while it prefixes some technique. */
export function matchSigns(signs: number[]): { status: 'partial' } | { status: 'match'; id: string } | { status: 'invalid' } {
  let partial = false;
  for (const id of TECHNIQUE_ORDER) {
    const seq = TECHNIQUES[id].signs;
    if (!seq || signs.length > seq.length) continue;
    if (signs.every((s, i) => seq[i] === s)) {
      if (signs.length === seq.length) return { status: 'match', id };
      partial = true;
    }
  }
  return partial ? { status: 'partial' } : { status: 'invalid' };
}
