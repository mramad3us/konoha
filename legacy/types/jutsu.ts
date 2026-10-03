/**
 * Jutsu system types — scalable framework for all special techniques.
 *
 * Every jutsu is a JutsuDefinition in the registry. Effects are a
 * discriminated union that the resolver dispatches by type.
 * Adding a new jutsu = one registry entry + one effect handler.
 */

export type JutsuCategory = 'ninjutsu' | 'genjutsu' | 'taijutsu_special';

export type JutsuEffect =
  | { type: 'substitution' }
  | { type: 'clone'; count: number }
  | { type: 'elemental'; element: string; baseDamage: number; radius: number }
  | { type: 'buff'; stat: string; amount: number; durationTicks: number }
  | { type: 'heal'; amount: number }
  ;

export interface JutsuDefinition {
  id: string;
  name: string;
  description: string;
  chakraCost: number;
  minNinjutsuSkill: number;
  combatKey?: string;          // key to activate mid-combat
  cooldownPasses: number;
  category: JutsuCategory;
  effect: JutsuEffect;
  /** Flavor text templates for successful cast (many variations) */
  castMessages: string[];
  /** Flavor text for failed cast (not enough chakra, cooldown, etc.) */
  failMessages?: Record<string, string[]>;
}

/** Cooldown tracker: jutsuId → tick when it becomes available */
export type JutsuCooldowns = Record<string, number>;
