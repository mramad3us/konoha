/**
 * Character archetypes: stat ranges, behavior, fighting style, look.
 */

import type { AiKind, Appearance, Attr, Faction, ItemKind, Move, Rank, Skill } from '../ecs/components.ts';
import type { Rng } from '../core/rng.ts';
import { banditLook, rogueLook, leafLook, anbuLook, civilianLook } from './looks.ts';

type Range = readonly [number, number];

export interface Archetype {
  id: string;
  label: string;
  ai: AiKind;
  faction: Faction;
  rank: Rank;
  attrs: Record<Attr, Range>;
  skills: Record<Skill, Range>;
  /** Fights with a blade. */
  lethal: boolean;
  /** Flee below this HP fraction (0 = never). */
  flee: number;
  ammo?: Partial<Record<ItemKind, Range>>;
  /** Move preference weights before situational adjustments. */
  style: Record<Move, number>;
  look: (rng: Rng) => Appearance;
  names?: readonly string[];
}

const S = (t: Range, b: Range, n: Range, s: Range, m: Range): Record<Skill, Range> =>
  ({ taijutsu: t, bukijutsu: b, ninjutsu: n, stealth: s, medicine: m });
const A = (body: Range, chakra: Range, mind: Range): Record<Attr, Range> => ({ body, chakra, mind });

export const BANDIT_NAMES = [
  'Goro', 'Jiro', 'Saburo', 'Tetsu', 'Kenta', 'Daisuke', 'Masa', 'Bunta', 'Juzo', 'Sabu',
  'Hachi', 'Roku', 'Gonta', 'Kuma', 'Ippei', 'Torao', 'Zenji', 'Mokichi', 'Yasu', 'Heita',
] as const;

export const BANDIT_EPITHETS = [
  'the Scarred', 'Iron Fist', 'One-Eye', 'the Viper', 'Red Hand', 'the Jackal', 'Stone Wall',
  'the Fox', 'Broken Tooth', 'the Crow', 'Nine Fingers', 'the Butcher',
] as const;

export const ROGUE_NAMES = [
  'Kagero', 'Ushio', 'Hayato', 'Suzume', 'Aoba', 'Tsubaki', 'Enrai', 'Yakumo', 'Kurogane',
  'Jinpachi', 'Mukuro', 'Shizuka', 'Raiden', 'Hotaru', 'Sekka', 'Garyo',
] as const;

export const ARCHETYPES: Record<string, Archetype> = {
  bandit_thug: {
    id: 'bandit_thug', label: 'Bandit', ai: 'bandit', faction: 'bandit', rank: 'civilian',
    attrs: A([7, 11], [0, 2], [3, 7]), skills: S([3, 7], [0, 4], [0, 0], [2, 6], [0, 3]),
    lethal: true, flee: 0.25, style: { strike: 5, break: 3, guard: 3 }, look: banditLook,
    names: BANDIT_NAMES,
  },
  bandit_enforcer: {
    id: 'bandit_enforcer', label: 'Enforcer', ai: 'bandit', faction: 'bandit', rank: 'civilian',
    attrs: A([11, 15], [0, 3], [5, 9]), skills: S([9, 14], [4, 10], [0, 0], [4, 8], [2, 5]),
    lethal: true, flee: 0.2, ammo: { shuriken: [0, 3] }, style: { strike: 4, break: 4, guard: 3 }, look: banditLook,
    names: BANDIT_NAMES,
  },
  bandit_boss: {
    id: 'bandit_boss', label: 'Bandit Boss', ai: 'bandit', faction: 'bandit', rank: 'civilian',
    attrs: A([15, 19], [2, 5], [8, 12]), skills: S([16, 22], [8, 14], [0, 2], [5, 9], [4, 8]),
    lethal: true, flee: 0.12, ammo: { kunai: [1, 3] }, style: { strike: 4, break: 4, guard: 4 }, look: banditLook,
    names: BANDIT_NAMES,
  },
  rogue_genin: {
    id: 'rogue_genin', label: 'Rogue Shinobi', ai: 'ninja', faction: 'rogue', rank: 'genin',
    attrs: A([14, 20], [12, 20], [10, 16]), skills: S([20, 28], [16, 24], [10, 18], [14, 22], [6, 12]),
    lethal: true, flee: 0.15, ammo: { kunai: [2, 4], shuriken: [3, 6] }, style: { strike: 4, break: 3, guard: 4 },
    look: (r) => rogueLook(r, false), names: ROGUE_NAMES,
  },
  rogue_chunin: {
    id: 'rogue_chunin', label: 'Rogue Chunin', ai: 'ninja', faction: 'rogue', rank: 'chunin',
    attrs: A([22, 30], [22, 30], [18, 26]), skills: S([32, 42], [28, 36], [24, 34], [22, 30], [10, 18]),
    lethal: true, flee: 0.1, ammo: { kunai: [3, 5], shuriken: [4, 8] }, style: { strike: 4, break: 4, guard: 4 },
    look: (r) => rogueLook(r, false), names: ROGUE_NAMES,
  },
  missing_jonin: {
    id: 'missing_jonin', label: 'Missing-nin', ai: 'ninja', faction: 'rogue', rank: 'jonin',
    attrs: A([34, 44], [36, 46], [30, 40]), skills: S([50, 60], [44, 54], [42, 52], [36, 46], [16, 26]),
    lethal: true, flee: 0, ammo: { kunai: [4, 6], shuriken: [5, 8] }, style: { strike: 4, break: 4, guard: 4 },
    look: (r) => rogueLook(r, true), names: ROGUE_NAMES,
  },
  leaf_guard: {
    id: 'leaf_guard', label: 'Leaf Chunin', ai: 'guard', faction: 'leaf', rank: 'chunin',
    attrs: A([22, 28], [20, 28], [18, 24]), skills: S([30, 38], [26, 34], [22, 30], [20, 28], [10, 16]),
    lethal: false, flee: 0, ammo: { kunai: [4, 6] }, style: { strike: 4, break: 3, guard: 4 },
    look: (r) => leafLook(r, r.chance(0.7) ? 'm' : 'f', true),
  },
  anbu: {
    id: 'anbu', label: 'ANBU', ai: 'guard', faction: 'leaf', rank: 'anbu',
    attrs: A([38, 46], [40, 50], [36, 44]), skills: S([55, 65], [50, 60], [50, 60], [60, 70], [20, 30]),
    lethal: false, flee: 0, ammo: { kunai: [6, 6] }, style: { strike: 4, break: 4, guard: 4 }, look: anbuLook,
  },
  villager: {
    id: 'villager', label: 'Villager', ai: 'villager', faction: 'civilian', rank: 'civilian',
    attrs: A([5, 10], [0, 1], [4, 10]), skills: S([0, 3], [0, 1], [0, 0], [0, 3], [0, 4]),
    lethal: false, flee: 0.9, style: { strike: 3, break: 1, guard: 6 },
    look: (r) => civilianLook(r, r.chance(0.5) ? 'm' : 'f'),
  },
  sparring: {
    id: 'sparring', label: 'Genin', ai: 'examiner', faction: 'leaf', rank: 'genin',
    attrs: A([10, 14], [8, 12], [6, 10]), skills: S([9, 13], [5, 9], [4, 8], [4, 8], [2, 4]),
    lethal: false, flee: 0, style: { strike: 4, break: 3, guard: 4 },
    look: (r) => leafLook(r, r.chance(0.5) ? 'm' : 'f', false),
  },
  examiner_chunin: {
    id: 'examiner_chunin', label: 'Chunin Proctor', ai: 'examiner', faction: 'leaf', rank: 'chunin',
    attrs: A([20, 22], [18, 20], [16, 18]), skills: S([26, 28], [22, 24], [18, 20], [16, 18], [8, 10]),
    lethal: false, flee: 0, style: { strike: 4, break: 4, guard: 4 },
    look: (r) => leafLook(r, 'm', true),
  },
  examiner_jonin: {
    id: 'examiner_jonin', label: 'Jonin Proctor', ai: 'examiner', faction: 'leaf', rank: 'jonin',
    attrs: A([34, 36], [34, 36], [30, 32]), skills: S([50, 52], [44, 46], [42, 44], [36, 38], [14, 16]),
    lethal: false, flee: 0, style: { strike: 4, break: 4, guard: 4 },
    look: (r) => leafLook(r, 'f', true),
  },
};

export function rollRange(rng: Rng, r: Range): number {
  return rng.int(r[0], r[1]);
}
