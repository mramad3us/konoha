/**
 * Combat AI — picks moves for NPCs during melee exchanges.
 *
 * Training dummies: reactive wooden posts, swing back with energy
 * from hits dealt. They always pick random attacks at skill 10,
 * never defend, and have no tempo.
 *
 * Future NPCs will have smarter AI based on their skill level.
 */

import type { CombatMove, AttackMove, DefendMove } from '../types/combat.ts';

export type CombatAIType = 'dummy' | 'basic' | 'skilled' | 'master';

const ATTACKS: AttackMove[] = ['a', 'z', 'e'];
const DEFENDS: DefendMove[] = ['q', 's', 'd'];
const ALL_MOVES: CombatMove[] = [...ATTACKS, ...DEFENDS];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a combat move for an NPC.
 *
 * @param aiType - The AI behavior type
 * @param combatSkill - The NPC's combat skill (0-100)
 * @param npcTempo - NPC's current tempo beads
 * @param opponentTempo - Opponent's current tempo beads
 */
export function pickNpcMove(
  aiType: CombatAIType,
  _combatSkill: number,
  npcTempo: number,
  opponentTempo: number,
): CombatMove {
  switch (aiType) {
    case 'dummy':
      // Dummies always attack randomly — they're swinging wooden arms
      return randomFrom(ATTACKS);

    case 'basic':
      // Low-skill NPCs: 70% attack, 30% defend, random picks
      return Math.random() < 0.7 ? randomFrom(ATTACKS) : randomFrom(DEFENDS);

    case 'skilled': {
      // Mid-skill: smarter about defending when losing tempo
      if (opponentTempo > npcTempo && Math.random() < 0.5) {
        return randomFrom(DEFENDS);
      }
      // Otherwise 60/40 attack/defend
      return Math.random() < 0.6 ? randomFrom(ATTACKS) : randomFrom(DEFENDS);
    }

    case 'master': {
      // High-skill: adapt to situation
      if (opponentTempo > 0 && npcTempo === 0) {
        // Opponent has momentum — prioritize defense to build tempo
        return Math.random() < 0.65 ? randomFrom(DEFENDS) : randomFrom(ATTACKS);
      }
      if (npcTempo > opponentTempo) {
        // NPC has momentum — press the attack
        return Math.random() < 0.75 ? randomFrom(ATTACKS) : randomFrom(DEFENDS);
      }
      // Neutral — balanced play
      return Math.random() < 0.55 ? randomFrom(ATTACKS) : randomFrom(DEFENDS);
    }

    default:
      return randomFrom(ALL_MOVES);
  }
}

/** Determine AI type from combat skill level */
export function aiTypeFromSkill(skill: number): CombatAIType {
  if (skill < 20) return 'basic';
  if (skill < 60) return 'skilled';
  return 'master';
}
