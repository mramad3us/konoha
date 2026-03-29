/**
 * Combat resolution: simultaneous blind pick with conditions.
 */

import type { CombatMove, CombatOutcome, TempoState, ConditionState } from '../types/combat.ts';
import { isAttack, isDefend, MIRROR_PAIRS, calculateDamage } from '../types/combat.ts';

export function resolveCombat(
  moveA: CombatMove,
  moveB: CombatMove,
  idA: number,
  idB: number,
  tempoA: TempoState,
  tempoB: TempoState,
  condA: ConditionState,
  condB: ConditionState,
  taijutsuA: number,
  taijutsuB: number,
  phyA: number,
  phyB: number,
): CombatOutcome {
  const base = { isCritical: false, conditionApplied: null } as const;

  // ── STUNNED: free hit for the other side ──
  if (condA.condition === 'stunned') {
    const damage = calculateDamage(taijutsuB, phyB);
    return {
      type: 'clean_hit', attackerId: idB, defenderId: idA, damage,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveB, defenderMove: moveA, ...base,
    };
  }
  if (condB.condition === 'stunned') {
    const damage = calculateDamage(taijutsuA, phyA);
    return {
      type: 'clean_hit', attackerId: idA, defenderId: idB, damage,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveA, defenderMove: moveB, ...base,
    };
  }

  // ── DOWN: opponent acts as if they have a free bead (phantom bead) ──
  // We create effective tempo that includes the phantom bead
  const effTempoA: TempoState = condB.condition === 'down'
    ? { current: tempoA.current + 1, max: tempoA.max } // A gets phantom bead vs downed B
    : tempoA;
  const effTempoB: TempoState = condA.condition === 'down'
    ? { current: tempoB.current + 1, max: tempoB.max } // B gets phantom bead vs downed A
    : tempoB;

  const aAttacks = isAttack(moveA);
  const bAttacks = isAttack(moveB);
  const aDefends = isDefend(moveA);
  const bDefends = isDefend(moveB);

  // ── BOTH DEFEND ──
  if (aDefends && bDefends) {
    return {
      type: 'circling', attackerId: idA, defenderId: idB, damage: 0,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveA, defenderMove: moveB, ...base,
    };
  }

  // ── A ATTACKS, B DEFENDS ──
  if (aAttacks && bDefends) {
    return resolveAttackVsDefend(moveA, moveB, idA, idB, effTempoB, taijutsuA, phyA);
  }

  // ── B ATTACKS, A DEFENDS ──
  if (bAttacks && aDefends) {
    return resolveAttackVsDefend(moveB, moveA, idB, idA, effTempoA, taijutsuB, phyB);
  }

  // ── BOTH ATTACK ──
  if (aAttacks && bAttacks) {
    return resolveClash(moveA, moveB, idA, idB, effTempoA, effTempoB, taijutsuA, taijutsuB, phyA, phyB, condA, condB);
  }

  return {
    type: 'circling', attackerId: idA, defenderId: idB, damage: 0,
    tempoChange: { attacker: 0, defender: 0 },
    attackerMove: moveA, defenderMove: moveB, ...base,
  };
}

function resolveAttackVsDefend(
  attackMove: CombatMove,
  defendMove: CombatMove,
  attackerId: number,
  defenderId: number,
  defenderTempo: TempoState,
  attackerTaijutsu: number,
  attackerPhy: number,
): CombatOutcome {
  const base = { isCritical: false, conditionApplied: null } as const;
  const perfectBlock = MIRROR_PAIRS[attackMove as keyof typeof MIRROR_PAIRS] === defendMove;

  if (perfectBlock) {
    return {
      type: 'perfect_parry', attackerId, defenderId, damage: 0,
      tempoChange: { attacker: 0, defender: 1 },
      attackerMove: attackMove, defenderMove: defendMove, ...base,
    };
  }

  // Imperfect block — check tempo save first
  if (defenderTempo.current > 0) {
    return {
      type: 'tempo_save', attackerId, defenderId, damage: 0,
      tempoChange: { attacker: 0, defender: -1 },
      attackerMove: attackMove, defenderMove: defendMove, ...base,
    };
  }

  const fullDamage = calculateDamage(attackerTaijutsu, attackerPhy);
  const halfDamage = Math.max(1, Math.round(fullDamage * 0.5));

  return {
    type: 'imperfect_block', attackerId, defenderId, damage: halfDamage,
    tempoChange: { attacker: 0, defender: 0 },
    attackerMove: attackMove, defenderMove: defendMove, ...base,
  };
}

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
  condA: ConditionState,
  condB: ConditionState,
): CombatOutcome {
  const base = { isCritical: false, conditionApplied: null } as const;
  const sameKey = moveA === moveB;

  if (sameKey) {
    // Tempo advantage check (phantom bead from Down doesn't consume real bead)
    const aHasAdvantage = tempoA.current > 0 && tempoB.current === 0;
    const bHasAdvantage = tempoB.current > 0 && tempoA.current === 0;

    if (aHasAdvantage) {
      const damage = calculateDamage(taijutsuA, phyA);
      // Only spend a real bead (not phantom)
      const tempoSpend = condB.condition === 'down' ? 0 : -1;
      return {
        type: 'clash_tempo_win', attackerId: idA, defenderId: idB, damage,
        tempoChange: { attacker: tempoSpend, defender: 0 },
        attackerMove: moveA, defenderMove: moveB, ...base,
      };
    }
    if (bHasAdvantage) {
      const damage = calculateDamage(taijutsuB, phyB);
      const tempoSpend = condA.condition === 'down' ? 0 : -1;
      return {
        type: 'clash_tempo_win', attackerId: idB, defenderId: idA, damage,
        tempoChange: { attacker: tempoSpend, defender: 0 },
        attackerMove: moveB, defenderMove: moveA, ...base,
      };
    }

    return {
      type: 'clash_stalemate', attackerId: idA, defenderId: idB, damage: 0,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveA, defenderMove: moveB, ...base,
    };
  }

  // Different attacks — RNG weighted by skill
  const totalSkill = taijutsuA + taijutsuB;
  const aChance = totalSkill > 0 ? taijutsuA / totalSkill : 0.5;

  if (Math.random() < aChance) {
    const damage = calculateDamage(taijutsuA, phyA);
    if (tempoB.current > 0) {
      const tempoSpend = condA.condition === 'down' ? 0 : -1;
      return {
        type: 'tempo_save', attackerId: idA, defenderId: idB, damage: 0,
        tempoChange: { attacker: 0, defender: tempoSpend },
        attackerMove: moveA, defenderMove: moveB, ...base,
      };
    }
    return {
      type: 'clash_rng', attackerId: idA, defenderId: idB, damage,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveA, defenderMove: moveB, ...base,
    };
  } else {
    const damage = calculateDamage(taijutsuB, phyB);
    if (tempoA.current > 0) {
      const tempoSpend = condB.condition === 'down' ? 0 : -1;
      return {
        type: 'tempo_save', attackerId: idB, defenderId: idA, damage: 0,
        tempoChange: { attacker: 0, defender: tempoSpend },
        attackerMove: moveB, defenderMove: moveA, ...base,
      };
    }
    return {
      type: 'clash_rng', attackerId: idB, defenderId: idA, damage,
      tempoChange: { attacker: 0, defender: 0 },
      attackerMove: moveB, defenderMove: moveA, ...base,
    };
  }
}
