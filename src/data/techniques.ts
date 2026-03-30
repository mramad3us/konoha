/**
 * Ninjutsu Technique Definitions
 *
 * Techniques are automatically available when the character's ninjutsu
 * skill meets the requirement. Some techniques improve with higher levels.
 */

export interface NinjutsuTechnique {
  id: string;
  name: string;
  description: string;
  /** Minimum ninjutsu skill required to use this technique */
  requiredNinjutsu: number;
  category: 'movement' | 'combat' | 'utility';
}

/** Master list of all ninjutsu techniques */
export const NINJUTSU_TECHNIQUES: NinjutsuTechnique[] = [
  {
    id: 'substitution',
    name: 'Substitution Jutsu',
    description: 'Replace yourself with a nearby object to dodge an attack.',
    requiredNinjutsu: 5,
    category: 'combat',
  },
  {
    id: 'chakra_sprint',
    name: 'Chakra Sprint',
    description: 'Channel chakra to your feet for superhuman speed. Costs chakra and stamina each step.',
    requiredNinjutsu: 10,
    category: 'movement',
  },
  {
    id: 'water_walk',
    name: 'Water Walking',
    description: 'Walk on water by channeling a steady flow of chakra through the soles of your feet.',
    requiredNinjutsu: 15,
    category: 'movement',
  },
];

/** Get all techniques available to a character at a given ninjutsu level */
export function getAvailableTechniques(ninjutsuLevel: number): NinjutsuTechnique[] {
  return NINJUTSU_TECHNIQUES.filter(t => ninjutsuLevel >= t.requiredNinjutsu);
}

/** Get the next technique the character hasn't unlocked yet (if any) */
export function getNextTechnique(ninjutsuLevel: number): NinjutsuTechnique | null {
  return NINJUTSU_TECHNIQUES.find(t => ninjutsuLevel < t.requiredNinjutsu) ?? null;
}

/** Check if a character has a specific technique */
export function hasTechnique(ninjutsuLevel: number, techniqueId: string): boolean {
  const tech = NINJUTSU_TECHNIQUES.find(t => t.id === techniqueId);
  if (!tech) return false;
  return ninjutsuLevel >= tech.requiredNinjutsu;
}

/**
 * Chakra Sprint speed in game-seconds per step (aligned to subtick resolution).
 *   Ninjutsu 10+: 2.0s/step  (4 subticks) — Initial
 *   Ninjutsu 30+: 1.0s/step  (2 subticks) — Advanced
 *   Ninjutsu 50+: 0.5s/step  (1 subtick)  — Master
 */
export function getChakraSprintSpeed(ninjutsuLevel: number): number {
  if (ninjutsuLevel < 10) return Infinity; // can't use
  if (ninjutsuLevel >= 50) return 0.5;
  if (ninjutsuLevel >= 30) return 1.0;
  return 2.0;
}

/** Human-readable chakra sprint tier name */
export function getChakraSprintTier(ninjutsuLevel: number): string {
  if (ninjutsuLevel >= 50) return 'Master';
  if (ninjutsuLevel >= 30) return 'Advanced';
  return 'Initial';
}
