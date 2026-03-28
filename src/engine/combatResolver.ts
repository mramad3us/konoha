/**
 * Combat resolution: simultaneous blind pick.
 * Both combatants choose a move, this resolves the outcome.
 */

import type { CombatMove, CombatOutcome, TempoState } from '../types/combat.ts';
import { isAttack, isDefend, MIRROR_PAIRS, calculateDamage } from '../types/combat.ts';

/**
 * Resolve a combat exchange between two combatants.
 *
 * @param moveA - Move chosen by entity A
 * @param moveB - Move chosen by entity B
 * @param idA - Entity ID of A
 * @param idB - Entity ID of B
 * @param tempoA - A's current tempo state
 * @param tempoB - B's current tempo state
 * @param taijutsuA - A's combat skill (0-100)
 * @param taijutsuB - B's combat skill (0-100)
 * @param phyA - A's physical stat (0-100)
 * @param phyB - B's physical stat (0-100)
 */
export function resolveCombat(
  moveA: CombatMove,
  moveB: CombatMove,
  idA: number,
  idB: number,
  tempoA: TempoState,
  tempoB: TempoState,
  taijutsuA: number,
  taijutsuB: number,
  phyA: number,
  phyB: number,
): CombatOutcome {
  const aAttacks = isAttack(moveA);
  const bAttacks = isAttack(moveB);
  const aDefends = isDefend(moveA);
  const bDefends = isDefend(moveB);

  // ── BOTH DEFEND ──
  if (aDefends && bDefends) {
    return {
      type: 'circling',
      attackerId: idA, defenderId: idB,
      damage: 0,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveA, defenderMove: moveB,
    };
  }

  // ── A ATTACKS, B DEFENDS ──
  if (aAttacks && bDefends) {
    return resolveAttackVsDefend(moveA, moveB, idA, idB, tempoA, tempoB, taijutsuA, phyA);
  }

  // ── B ATTACKS, A DEFENDS ──
  if (bAttacks && aDefends) {
    // Flip perspective: B is attacker, A is defender
    const result = resolveAttackVsDefend(moveB, moveA, idB, idA, tempoB, tempoA, taijutsuB, phyB);
    return result;
  }

  // ── BOTH ATTACK ──
  if (aAttacks && bAttacks) {
    return resolveClash(moveA, moveB, idA, idB, tempoA, tempoB, taijutsuA, taijutsuB, phyA, phyB);
  }

  // Fallback (shouldn't happen)
  return {
    type: 'circling',
    attackerId: idA, defenderId: idB,
    damage: 0,
    tempoChange: { attacker: 0, defender: 0 },
    attackerMove: moveA, defenderMove: moveB,
  };
}

/** Resolve: one attacks, one defends */
function resolveAttackVsDefend(
  attackMove: CombatMove,
  defendMove: CombatMove,
  attackerId: number,
  defenderId: number,
  _attackerTempo: TempoState,
  defenderTempo: TempoState,
  attackerTaijutsu: number,
  attackerPhy: number,
): CombatOutcome {
  const perfectBlock = MIRROR_PAIRS[attackMove as keyof typeof MIRROR_PAIRS] === defendMove;

  if (perfectBlock) {
    // Perfect parry — defender earns a tempo
    return {
      type: 'perfect_parry',
      attackerId, defenderId,
      damage: 0,
      tempoChange: { attacker: 0, defender: 1 },
      attackerMove: attackMove, defenderMove: defendMove,
    };
  }

  // Imperfect block — hit lands but half damage
  const fullDamage = calculateDamage(attackerTaijutsu, attackerPhy);
  let halfDamage = Math.max(1, Math.round(fullDamage * 0.5));

  // Check if defender has tempo to auto-save
  if (defenderTempo.current > 0) {
    return {
      type: 'tempo_save',
      attackerId, defenderId,
      damage: 0,
      tempoChange: { attacker: 0, defender: -1 },
      attackerMove: attackMove, defenderMove: defendMove,
    };
  }

  return {
    type: 'imperfect_block',
    attackerId, defenderId,
    damage: halfDamage,
    tempoChange: { attacker: 0, defender: 0 },
    attackerMove: attackMove, defenderMove: defendMove,
  };
}

/** Resolve: both attack */
function resolveClash(
  moveA: CombatMove,
  moveB: CombatMove,
  idA: number,
  idB: number,
  tempoA: TempoState,
  tempoB: TempoState,
  taijutsuA: number,
  taijutsuB: number,
  phyA: number,
  phyB: number,
): CombatOutcome {
  const sameKey = moveA === moveB;

  if (sameKey) {
    // Both chose the same attack
    if (tempoA.current > 0 && tempoB.current === 0) {
      // A has tempo advantage — A hits, spends a tempo
      const damage = calculateDamage(taijutsuA, phyA);
      return {
        type: 'clash_tempo_win',
        attackerId: idA, defenderId: idB,
        damage,
        tempoChange: { attacker: -1, defender: 0 },
        attackerMove: moveA, defenderMove: moveB,
      };
    }

    if (tempoB.current > 0 && tempoA.current === 0) {
      // B has tempo advantage — B hits
      const damage = calculateDamage(taijutsuB, phyB);
      return {
        type: 'clash_tempo_win',
        attackerId: idB, defenderId: idA,
        damage,
        tempoChange: { attacker: -1, defender: 0 },
        attackerMove: moveB, defenderMove: moveA,
      };
    }

    // Both have tempo or neither — stalemate
    return {
      type: 'clash_stalemate',
      attackerId: idA, defenderId: idB,
      damage: 0,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveA, defenderMove: moveB,
    };
  }

  // Different attack keys — RNG weighted by skill
  const totalSkill = taijutsuA + taijutsuB;
  const aChance = totalSkill > 0 ? taijutsuA / totalSkill : 0.5;
  const roll = Math.random();

  if (roll < aChance) {
    // A wins the exchange
    const damage = calculateDamage(taijutsuA, phyA);

    // Check if B has tempo to auto-save
    if (tempoB.current > 0) {
      return {
        type: 'tempo_save',
        attackerId: idA, defenderId: idB,
        damage: 0,
        tempoChange: { attacker: 0, defender: -1 },
        attackerMove: moveA, defenderMove: moveB,
      };
    }

    return {
      type: 'clash_rng',
      attackerId: idA, defenderId: idB,
      damage,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveA, defenderMove: moveB,
    };
  } else {
    // B wins the exchange
    const damage = calculateDamage(taijutsuB, phyB);

    // Check if A has tempo to auto-save
    if (tempoA.current > 0) {
      return {
        type: 'tempo_save',
        attackerId: idB, defenderId: idA,
        damage: 0,
        tempoChange: { attacker: 0, defender: -1 },
        attackerMove: moveB, defenderMove: moveA,
      };
    }

    return {
      type: 'clash_rng',
      attackerId: idB, defenderId: idA,
      damage,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveB, defenderMove: moveA,
    };
  }
}
