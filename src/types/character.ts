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
  | 'academy_student'
  | 'genin'
  | 'chuunin'
  | 'special_jounin'
  | 'jounin'
  | 'anbu'
  | 'kage';

export const SHINOBI_RANK_LABELS: Record<ShinobiRank, string> = {
  academy_student: 'Academy Student',
  genin: 'Genin',
  chuunin: 'Chūnin',
  special_jounin: 'Special Jōnin',
  jounin: 'Jōnin',
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
}

export type SkillId = keyof CharacterSkills;

export const SKILL_LABELS: Record<SkillId, string> = {
  taijutsu: 'Taijutsu',
  bukijutsu: 'Bukijutsu',
  ninjutsu: 'Ninjutsu',
  genjutsu: 'Genjutsu',
} as const;

export const SKILL_DESCRIPTIONS: Record<SkillId, string> = {
  taijutsu: 'Hand-to-hand combat, melee weapon damage',
  bukijutsu: 'Tool use, thrown weapon accuracy & damage',
  ninjutsu: 'Chakra efficiency, jutsu power, seal speed',
  genjutsu: 'Illusion effectiveness and resistance',
} as const;

export const ALL_SKILL_IDS: SkillId[] = ['taijutsu', 'bukijutsu', 'ninjutsu', 'genjutsu'];

// ── STATS (0-100) ──

export interface CharacterStats {
  phy: number;  // Physical fitness & strength
  cha: number;  // Chakra reserves
  men: number;  // Mental power / willpower
  soc: number;  // Social skills
}

export type StatId = keyof CharacterStats;

export const STAT_LABELS: Record<StatId, string> = {
  phy: 'Physical',
  cha: 'Chakra',
  men: 'Mental',
  soc: 'Social',
} as const;

export const STAT_DESCRIPTIONS: Record<StatId, string> = {
  phy: 'Strength, endurance — improves with physical activity',
  cha: 'Raw chakra reserves — improves with meditation and jutsu use',
  men: 'Willpower, mental fortitude — improves slowly through meditation',
  soc: 'Social influence — improves through conversation and special training',
} as const;

export const ALL_STAT_IDS: StatId[] = ['phy', 'cha', 'men', 'soc'];

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
): number {
  const ratio = 1 - currentValue / 100;
  const diminished = baseGain * Math.pow(Math.max(0, ratio), curve);
  return Math.min(100, currentValue + diminished);
}

// ── IMPROVEMENT RATES ──
// How much base XP each activity grants per occurrence

export const SKILL_IMPROVEMENT_RATES: Record<SkillId, number> = {
  taijutsu: 0.3,   // per combat round / training hit
  bukijutsu: 0.25,  // per tool use
  ninjutsu: 0.2,   // per jutsu cast
  genjutsu: 0.15,  // per genjutsu attempt
} as const;

export const STAT_IMPROVEMENT_RATES = {
  phy_physical_activity: 0.08,  // running, taijutsu, etc.
  cha_meditation: 0.15,         // high impact
  cha_ninjutsu_use: 0.03,      // low impact
  men_meditation: 0.05,         // very slow
  soc_conversation: 0.02,      // very slow passive
  soc_training: 0.12,          // special trainer, faster
} as const;

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
  },
  stats: {
    phy: 12,
    cha: 8,
    men: 6,
    soc: 10,
  },
};
