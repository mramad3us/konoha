/**
 * Character sheet: skills, stats, class, rank, title.
 * Central to the game — every entity with combat/social capabilities has one.
 */

// ── CLASS ──

export type CharacterClass =
  | 'shinobi'
  | 'samurai'
  | 'monk'
  | 'merchant'
  | 'civilian';

// ── RANK (flexible — add to end to extend) ──

export type ShinobiRank =
  | 'civilian'
  | 'academy_student'
  | 'genin'
  | 'chuunin'
  | 'special_jounin'
  | 'jounin'
  | 'anbu'
  | 'kage';

export const SHINOBI_RANK_LABELS: Record<ShinobiRank, string> = {
  civilian: 'Civilian',
  academy_student: 'Academy Student',
  genin: 'Genin',
  chuunin: 'Chunin',
  special_jounin: 'Special Jonin',
  jounin: 'Jonin',
  anbu: 'ANBU',
  kage: 'Kage',
} as const;

// ── TITLE ──

export type CharacterTitle = string; // Flexible: "Student", "Shinobi of the Leaf", "Hokage", etc.

// ── SKILLS (0-100) ──

export interface CharacterSkills {
  taijutsu: number;    // Hand-to-hand combat effectiveness + melee weapon damage
  bukijutsu: number;   // Tool use — kunai/shuriken accuracy & damage, equipment thresholds
  ninjutsu: number;    // Chakra efficiency, jutsu power, seal mastery & speed
  genjutsu: number;    // Illusion effectiveness and resistance
  med: number;         // Medical knowledge — healing effectiveness, wound treatment
}

export type SkillId = keyof CharacterSkills;

export const SKILL_LABELS: Record<SkillId, string> = {
  taijutsu: 'Taijutsu',
  bukijutsu: 'Bukijutsu',
  ninjutsu: 'Ninjutsu',
  genjutsu: 'Genjutsu',
  med: 'Medicine',
} as const;

export const SKILL_DESCRIPTIONS: Record<SkillId, string> = {
  taijutsu: 'Hand-to-hand combat, melee weapon damage',
  bukijutsu: 'Tool use, thrown weapon accuracy & damage',
  ninjutsu: 'Chakra efficiency, jutsu power, seal speed',
  genjutsu: 'Illusion effectiveness and resistance',
  med: 'Healing effectiveness, wound treatment, poison resistance',
} as const;

export const ALL_SKILL_IDS: SkillId[] = ['taijutsu', 'bukijutsu', 'ninjutsu', 'genjutsu', 'med'];

// ── STATS (0-100) ──

export interface CharacterStats {
  phy: number;  // Physical fitness & strength
  cha: number;  // Chakra reserves
  men: number;  // Mental power / willpower
}

export type StatId = keyof CharacterStats;

export const STAT_LABELS: Record<StatId, string> = {
  phy: 'Physical',
  cha: 'Chakra',
  men: 'Mental',
} as const;

export const STAT_DESCRIPTIONS: Record<StatId, string> = {
  phy: 'Strength, endurance — improves with physical activity',
  cha: 'Raw chakra reserves — improves with meditation and jutsu use',
  men: 'Willpower, mental fortitude — improves slowly through meditation',
} as const;

export const ALL_STAT_IDS: StatId[] = ['phy', 'cha', 'men'];

// ── PROFICIENCY TIERS (Dwarf Fortress inspired) ──
// Maps 0-100 scale to named tiers

export interface ProficiencyTier {
  name: string;
  minValue: number;
  color: string; // CSS color for UI display
}

export const PROFICIENCY_TIERS: ProficiencyTier[] = [
  { name: 'Dabbling',      minValue: 0,  color: '#5a5750' },
  { name: 'Novice',        minValue: 4,  color: '#6b6560' },
  { name: 'Adequate',      minValue: 10, color: '#7a7570' },
  { name: 'Competent',     minValue: 18, color: '#8a8580' },
  { name: 'Skilled',       minValue: 26, color: '#9a9590' },
  { name: 'Proficient',    minValue: 34, color: '#9e9a92' },
  { name: 'Talented',      minValue: 42, color: '#a09868' },
  { name: 'Adept',         minValue: 50, color: '#b0a870' },
  { name: 'Expert',        minValue: 58, color: '#c0b880' },
  { name: 'Professional',  minValue: 66, color: '#c9a84c' },
  { name: 'Accomplished',  minValue: 74, color: '#e0c468' },
  { name: 'Great',         minValue: 80, color: '#d4a040' },
  { name: 'Master',        minValue: 86, color: '#d4364a' },
  { name: 'High Master',   minValue: 92, color: '#e04858' },
  { name: 'Grand Master',  minValue: 96, color: '#ff6070' },
  { name: 'Legendary',     minValue: 99, color: '#ffd700' },
];

/** Get the proficiency tier for a 0-100 value */
export function getProficiencyTier(value: number): ProficiencyTier {
  const clamped = Math.max(0, Math.min(100, Math.floor(value)));
  let result = PROFICIENCY_TIERS[0];
  for (const tier of PROFICIENCY_TIERS) {
    if (clamped >= tier.minValue) {
      result = tier;
    } else {
      break;
    }
  }
  return result;
}

// ── FULL CHARACTER SHEET ──

export interface CharacterSheet {
  class: CharacterClass;
  rank: ShinobiRank;
  title: CharacterTitle;
  skills: CharacterSkills;
  stats: CharacterStats;
  learnedJutsus: string[];
}

// ── SKILL / STAT IMPROVEMENT ──

/**
 * Logarithmic improvement curve.
 * At low values, gains are fast. At high values, gains are very slow.
 * Returns the new value after applying experience.
 *
 * Formula: gain = baseGain * (1 - currentValue/100)^curve
 * This means at value 0, full gain. At value 99, nearly zero gain.
 */
export function computeImprovement(
  currentValue: number,
  baseGain: number,
  curve: number = 2.0,
  /** Multiplier applied to base gain (e.g., 2 for mission bonus) */
  multiplier: number = 1,
): number {
  const ratio = 1 - currentValue / 100;
  const diminished = (baseGain * multiplier) * Math.pow(Math.max(0, ratio), curve);
  return Math.min(100, currentValue + diminished);
}

// ── IMPROVEMENT RATES ──
// How much base XP each activity grants per occurrence

/**
 * Skill improvement rates per combat pass (2s in-game).
 *
 * Calibrated so that 1→10 taijutsu takes ~2 full days (86,400 passes)
 * of constant dummy training. Sparring with equal/higher skill = 2× rate.
 */
export const SKILL_IMPROVEMENT_RATES = {
  taijutsu_dummy: 0.000116,     // hitting a training dummy
  taijutsu_spar: 0.000232,      // sparring with skill >= yours (2×)
  bukijutsu: 0.000100,          // per tool use
  bukijutsu_throw: 0.001160,    // per thrown projectile (10× taijutsu punch rate)
  ninjutsu: 0.000090,           // per jutsu cast
  genjutsu: 0.000070,           // per genjutsu attempt
  med: 0.000050,                // per medical action (patch up, first aid)
} as const;

export const STAT_IMPROVEMENT_RATES = {
  phy_combat: 0.000040,         // physical activity (combat, running)
  phy_training: 0.000080,       // dedicated physical training
  cha_meditation: 0.000060,     // meditation (high impact for chakra)
  cha_ninjutsu_use: 0.000015,   // low impact
  men_meditation: 0.000020,     // very slow, only way
} as const;

// ── RANK TIER HELPERS ──

import type { SkillRankTier } from './awayMission.ts';
import { RANK_TIER_GENIN_MAX, RANK_TIER_CHUUNIN_MAX, RANK_TIER_JONIN_MAX } from '../core/constants.ts';

/** Determine the effective rank tier for a given skill/stat value */
export function getSkillRankTier(value: number): SkillRankTier {
  if (value < RANK_TIER_GENIN_MAX) return 'genin';
  if (value < RANK_TIER_CHUUNIN_MAX) return 'chuunin';
  if (value < RANK_TIER_JONIN_MAX) return 'jonin';
  return 'elite';
}

/** Numeric rank for comparison (higher = stronger) */
export function rankTierToNumber(tier: SkillRankTier): number {
  switch (tier) {
    case 'genin': return 0;
    case 'chuunin': return 1;
    case 'jonin': return 2;
    case 'elite': return 3;
  }
}

/** Convert mission rank letter to SkillRankTier */
export function missionRankToTier(rank: string): SkillRankTier {
  switch (rank) {
    case 'D': return 'genin';
    case 'C': return 'chuunin';
    case 'B': return 'jonin';
    case 'A': return 'elite';
    default: return 'genin';
  }
}

// ── DEFAULTS FOR NEW CHARACTERS ──

export const DEFAULT_SHINOBI_SHEET: CharacterSheet = {
  class: 'shinobi',
  rank: 'genin',
  title: 'Academy Graduate',
  skills: {
    taijutsu: 8,
    bukijutsu: 5,
    ninjutsu: 3,
    genjutsu: 1,
    med: 2,
  },
  stats: {
    phy: 12,
    cha: 8,
    men: 6,
  },
  learnedJutsus: [],
};
