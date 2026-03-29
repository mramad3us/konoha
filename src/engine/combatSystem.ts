/**
 * Combat system — manages melee engagements between entities.
 *
 * 1. NPC picks its move (blind, simultaneous)
 * 2. Both moves resolve via combatResolver (including conditions)
 * 3. Damage applied, tempo updated, conditions applied, flavor text logged
 * 4. Critical hits: screen shake + condition on defender
 */

import type { CombatMove, CombatEngagement, TempoState, ConditionState } from '../types/combat.ts';
import { maxTempoSlots, startingTempo, DUMMY_DESTROY_THRESHOLD, critChance } from '../types/combat.ts';
import { resolveCombat } from './combatResolver.ts';
import { generateCombatFlavor, generateCritFlavor, generateConditionFlavor, generateNpcObservation } from './flavorText.ts';
import { pickNpcMove } from './combatAI.ts';
import { computeImprovement, SKILL_IMPROVEMENT_RATES } from '../types/character.ts';
import { STAMINA_REST_TICKS, STAMINA_RESTORE_RATE } from '../core/constants.ts';
import { STAT_IMPROVEMENT_RATES } from '../types/character.ts';
import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';

/** Active engagements keyed by "smaller_id:larger_id" */
const engagements = new Map<string, CombatEngagement>();

function engagementKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

const NO_CONDITION: ConditionState = { condition: null, turnsRemaining: 0 };

function getOrCreateEngagement(world: World, entityA: EntityId, entityB: EntityId): CombatEngagement {
  const key = engagementKey(entityA, entityB);
  let eng = engagements.get(key);
  if (eng) return eng;

  const sheetA = world.characterSheets.get(entityA);
  const sheetB = world.characterSheets.get(entityB);
  const skillA = sheetA?.skills.taijutsu ?? 10;
  const skillB = sheetB?.skills.taijutsu ?? 10;

  eng = {
    entityA, entityB,
    tempoA: { current: startingTempo(skillA, skillB), max: maxTempoSlots(skillA) },
    tempoB: { current: startingTempo(skillB, skillA), max: maxTempoSlots(skillB) },
    conditionA: { ...NO_CONDITION },
    conditionB: { ...NO_CONDITION },
    round: 0,
    pendingNpcMove: null,
  };

  engagements.set(key, eng);
  return eng;
}

/** Check if a given entity is adjacent to the player */
export function findAdjacentTarget(world: World): EntityId | null {
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return null;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const entities = world.getEntitiesAt(playerPos.x + dx, playerPos.y + dy);
      for (const eid of entities) {
        if (eid === world.playerEntityId) continue;
        if (world.combatStats.has(eid) || world.healths.has(eid)) return eid;
      }
    }
  }
  return null;
}

/** Callback for screen shake — set by game.ts */
let screenShakeCallback: (() => void) | null = null;
export function setScreenShakeCallback(cb: () => void): void {
  screenShakeCallback = cb;
}

/**
 * Process a player combat move against an adjacent target.
 * Returns true if a turn was consumed.
 */
export function processCombatMove(world: World, playerMove: CombatMove): boolean {
  const playerId = world.playerEntityId;
  const targetId = findAdjacentTarget(world);
  if (targetId === null) {
    world.log('No one within striking distance.', 'info');
    return false;
  }

  const eng = getOrCreateEngagement(world, playerId, targetId);
  const isPlayerA = eng.entityA === playerId;

  // Get skills & stats
  const playerSheet = world.characterSheets.get(playerId);
  const targetSheet = world.characterSheets.get(targetId);
  const playerTaijutsu = playerSheet?.skills.taijutsu ?? 10;
  const targetTaijutsu = targetSheet?.skills.taijutsu ?? 10;
  const playerPhy = playerSheet?.stats.phy ?? 10;
  const targetPhy = targetSheet?.stats.phy ?? 10;

  // Conditions for this round
  const playerCond = isPlayerA ? eng.conditionA : eng.conditionB;
  const targetCond = isPlayerA ? eng.conditionB : eng.conditionA;

  // If player is stunned, they can't act — NPC gets a free hit
  if (playerCond.condition === 'stunned') {
    world.log('You\'re stunned and can\'t respond!', 'hit_incoming');
  }

  // If player is downed, log it
  if (playerCond.condition === 'down') {
    world.log('You struggle to recover your footing...', 'combat_neutral');
  }

  // NPC picks its move
  const isDummy = world.destructibles.has(targetId);
  const npcAiType = isDummy ? 'dummy' as const : 'basic' as const;
  const npcTempo = isPlayerA ? eng.tempoB : eng.tempoA;
  const playerTempo = isPlayerA ? eng.tempoA : eng.tempoB;

  // Override moves for stunned entities (stunned = can't act, their move is irrelevant)
  const effectivePlayerMove = playerCond.condition === 'stunned' ? 'q' as CombatMove : playerMove;
  const npcMove = targetCond.condition === 'stunned'
    ? 'q' as CombatMove
    : pickNpcMove(npcAiType, targetTaijutsu, npcTempo.current, playerTempo.current);

  // Resolve combat
  const outcome = isPlayerA
    ? resolveCombat(effectivePlayerMove, npcMove, playerId, targetId, eng.tempoA, eng.tempoB, eng.conditionA, eng.conditionB, playerTaijutsu, targetTaijutsu, playerPhy, targetPhy)
    : resolveCombat(npcMove, effectivePlayerMove, targetId, playerId, eng.tempoB, eng.tempoA, eng.conditionB, eng.conditionA, targetTaijutsu, playerTaijutsu, targetPhy, playerPhy);

  // Apply tempo changes by entity ID
  const tempoForAttacker = outcome.tempoChange.attacker;
  const tempoForDefender = outcome.tempoChange.defender;

  if (outcome.attackerId === eng.entityA) {
    eng.tempoA.current = Math.max(0, Math.min(eng.tempoA.max, eng.tempoA.current + tempoForAttacker));
    eng.tempoB.current = Math.max(0, Math.min(eng.tempoB.max, eng.tempoB.current + tempoForDefender));
  } else {
    eng.tempoB.current = Math.max(0, Math.min(eng.tempoB.max, eng.tempoB.current + tempoForAttacker));
    eng.tempoA.current = Math.max(0, Math.min(eng.tempoA.max, eng.tempoA.current + tempoForDefender));
  }

  // Apply damage
  if (outcome.damage > 0) {
    const defenderIsDummy = world.destructibles.has(outcome.defenderId);
    if (!defenderIsDummy) {
      const targetHealth = world.healths.get(outcome.defenderId);
      if (targetHealth) {
        targetHealth.current = Math.max(0, targetHealth.current - outcome.damage);
      }
    }
    if (outcome.attackerId === playerId) {
      const res = world.resources.get(playerId);
      if (res) res.stamina = Math.max(0, res.stamina - 1);
    }
  }

  // ── Critical hit check ──
  const defenderIsDummy = world.destructibles.has(outcome.defenderId);
  if (outcome.damage > 0 && !defenderIsDummy) {
    const attackerSkill = outcome.attackerId === playerId ? playerTaijutsu : targetTaijutsu;
    const defenderSkill = outcome.defenderId === playerId ? playerTaijutsu : targetTaijutsu;
    const crit = critChance(attackerSkill, defenderSkill);

    if (Math.random() < crit) {
      outcome.isCritical = true;
      const condition = Math.random() < 0.5 ? 'down' as const : 'stunned' as const;
      outcome.conditionApplied = condition;

      // Apply condition to defender
      const defCond = outcome.defenderId === eng.entityA ? eng.conditionA : eng.conditionB;
      defCond.condition = condition;
      defCond.turnsRemaining = 1;

      // Screen shake
      if (screenShakeCallback) screenShakeCallback();
    }
  }

  // ── Log flavor text ──
  const attackerName = world.names.get(outcome.attackerId)?.display ?? 'Unknown';
  const defenderName = world.names.get(outcome.defenderId)?.display ?? 'Unknown';
  const flavor = generateCombatFlavor(outcome, attackerName, defenderName, playerTaijutsu, targetTaijutsu);

  const playerIsAttacker = outcome.attackerId === playerId;
  const playerIsDefender = outcome.defenderId === playerId;

  let logCategory: import('../types/actions.ts').LogCategory;
  switch (outcome.type) {
    case 'perfect_parry':
      logCategory = playerIsDefender ? 'miss_incoming' : 'miss_outgoing'; break;
    case 'tempo_save':
      logCategory = 'combat_tempo'; break;
    case 'imperfect_block': case 'clean_hit': case 'clash_tempo_win': case 'clash_rng':
      logCategory = outcome.damage > 0
        ? (playerIsAttacker ? 'hit_outgoing' : 'hit_incoming')
        : (playerIsAttacker ? 'miss_outgoing' : 'miss_incoming');
      break;
    case 'clash_stalemate': case 'circling':
      logCategory = 'combat_neutral'; break;
    case 'missed':
      logCategory = playerIsAttacker ? 'miss_outgoing' : 'miss_incoming'; break;
    default:
      logCategory = 'combat_neutral';
  }

  world.log(flavor, logCategory);

  // Log crit and condition separately
  if (outcome.isCritical) {
    const critFlavor = generateCritFlavor(attackerName, defenderName, playerTaijutsu, targetTaijutsu);
    world.log(critFlavor, 'hit_outgoing');

    if (outcome.conditionApplied) {
      const condFlavor = generateConditionFlavor(defenderName, outcome.conditionApplied);
      world.log(condFlavor, outcome.defenderId === playerId ? 'hit_incoming' : 'hit_outgoing');
    }
  }

  // ── Skill improvement ──
  if (playerSheet) {
    const rate = isDummy
      ? SKILL_IMPROVEMENT_RATES.taijutsu_dummy
      : (targetTaijutsu >= playerTaijutsu
        ? SKILL_IMPROVEMENT_RATES.taijutsu_spar
        : SKILL_IMPROVEMENT_RATES.taijutsu_dummy);

    playerSheet.skills.taijutsu = computeImprovement(playerSheet.skills.taijutsu, rate);
    playerSheet.stats.phy = computeImprovement(playerSheet.stats.phy, STAT_IMPROVEMENT_RATES.phy_combat);
  }

  // ── Tick conditions down ──
  if (playerCond.turnsRemaining > 0) {
    playerCond.turnsRemaining--;
    if (playerCond.turnsRemaining <= 0) playerCond.condition = null;
  }
  if (targetCond.turnsRemaining > 0) {
    targetCond.turnsRemaining--;
    if (targetCond.turnsRemaining <= 0) targetCond.condition = null;
  }

  // ── Destruction check ──
  const destructible = world.destructibles.get(targetId);
  if (destructible) {
    if (outcome.damage >= DUMMY_DESTROY_THRESHOLD) {
      world.log(destructible.onDestroyMessage, 'system');
      world.destroyEntity(targetId);
      engagements.delete(engagementKey(playerId, targetId));
    }
  } else {
    const targetHealth = world.healths.get(targetId);
    if (targetHealth && targetHealth.current <= 0) {
      world.log(`${world.names.get(targetId)?.display ?? 'The enemy'} is defeated!`, 'system');
      world.destroyEntity(targetId);
      engagements.delete(engagementKey(playerId, targetId));
    }
  }

  // ── Stamina restoration ──
  // If player didn't attack (defended/parried), check rest-based regen
  const res = world.resources.get(playerId);
  if (res) {
    const ticksSinceExertion = world.currentTick - res.lastExertionTick;
    if (ticksSinceExertion >= STAMINA_REST_TICKS && res.stamina < res.staminaCeiling) {
      const regenAmount = res.maxStamina * STAMINA_RESTORE_RATE;
      res.stamina = Math.min(res.staminaCeiling, res.stamina + regenAmount);
    }
  }

  eng.round++;

  // Every 3 passes (1 tick / 6s), log NPC condition observation
  if (eng.round % 3 === 0 && !isDummy) {
    const targetHp = world.healths.get(targetId);
    const targetName = world.names.get(targetId)?.display ?? 'Your opponent';
    if (targetHp) {
      const obs = generateNpcObservation(targetName, targetHp.current, targetHp.max);
      world.log(obs, 'info');
    }
  }

  world.currentTick += 1;
  world.gameTimeSeconds += 2; // 1 combat pass = 2s in-game
  return true;
}

/** Get the player's current condition if in an engagement */
export function getPlayerCondition(world: World): import('../types/combat.ts').CombatCondition | null {
  const targetId = findAdjacentTarget(world);
  if (targetId === null) return null;
  const key = engagementKey(world.playerEntityId, targetId);
  const eng = engagements.get(key);
  if (!eng) return null;
  const cond = eng.entityA === world.playerEntityId ? eng.conditionA : eng.conditionB;
  return cond.condition;
}

/** Get the player's current tempo state if in an engagement */
export function getPlayerTempo(world: World): TempoState | null {
  const targetId = findAdjacentTarget(world);
  if (targetId === null) return null;
  const key = engagementKey(world.playerEntityId, targetId);
  const eng = engagements.get(key);
  if (!eng) return null;
  return eng.entityA === world.playerEntityId ? eng.tempoA : eng.tempoB;
}

/** Get all active engagement data for rendering overlays */
export function getActiveEngagements(): Map<string, CombatEngagement> {
  return engagements;
}

/** Clear engagements when entities move apart */
export function clearStaleEngagements(world: World): void {
  for (const [key, eng] of engagements) {
    const posA = world.positions.get(eng.entityA);
    const posB = world.positions.get(eng.entityB);
    if (!posA || !posB) { engagements.delete(key); continue; }
    if (Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y - posB.y)) > 1) {
      engagements.delete(key);
    }
  }
}
