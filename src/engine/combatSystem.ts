/**
 * Combat system — manages melee engagements between entities.
 *
 * When the player presses a combat key while adjacent to an entity
 * that has health, a combat exchange happens:
 * 1. NPC picks its move (blind, simultaneous)
 * 2. Both moves resolve via combatResolver
 * 3. Damage applied, tempo updated, flavor text logged
 */

import type { CombatMove, CombatEngagement, TempoState } from '../types/combat.ts';
import { maxTempoSlots, startingTempo, DUMMY_DESTROY_THRESHOLD } from '../types/combat.ts';
import { resolveCombat } from './combatResolver.ts';
import { generateCombatFlavor } from './flavorText.ts';
import { pickNpcMove } from './combatAI.ts';
import { computeImprovement, SKILL_IMPROVEMENT_RATES } from '../types/character.ts';
import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';

/** Active engagements keyed by "smaller_id:larger_id" */
const engagements = new Map<string, CombatEngagement>();

function engagementKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Get or create a combat engagement between two entities.
 */
function getOrCreateEngagement(world: World, entityA: EntityId, entityB: EntityId): CombatEngagement {
  const key = engagementKey(entityA, entityB);
  let eng = engagements.get(key);
  if (eng) return eng;

  // Get combat skills
  const sheetA = world.characterSheets.get(entityA);
  const sheetB = world.characterSheets.get(entityB);
  const skillA = sheetA?.skills.taijutsu ?? 10;
  const skillB = sheetB?.skills.taijutsu ?? 10;

  eng = {
    entityA,
    entityB,
    tempoA: {
      current: startingTempo(skillA, skillB),
      max: maxTempoSlots(skillA),
    },
    tempoB: {
      current: startingTempo(skillB, skillA),
      max: maxTempoSlots(skillB),
    },
    round: 0,
    pendingNpcMove: null,
  };

  engagements.set(key, eng);
  return eng;
}

/**
 * Check if a given entity is adjacent to the player (within melee range).
 */
export function findAdjacentTarget(world: World): EntityId | null {
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return null;

  // Check all 8 neighbors
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const tx = playerPos.x + dx;
      const ty = playerPos.y + dy;
      const entities = world.getEntitiesAt(tx, ty);
      for (const eid of entities) {
        if (eid === world.playerEntityId) continue;
        // Must have combatStats or health to be a valid combat target
        if (world.combatStats.has(eid) || world.healths.has(eid)) return eid;
      }
    }
  }
  return null;
}

/**
 * Process a player combat move against an adjacent target.
 * Returns true if a turn was consumed.
 */
export function processCombatMove(
  world: World,
  playerMove: CombatMove,
): boolean {
  const playerId = world.playerEntityId;
  const targetId = findAdjacentTarget(world);
  if (targetId === null) {
    world.log('No one within striking distance.', 'info');
    return false;
  }

  const eng = getOrCreateEngagement(world, playerId, targetId);
  const isPlayerA = eng.entityA === playerId;

  // Get skills
  const playerSheet = world.characterSheets.get(playerId);
  const targetSheet = world.characterSheets.get(targetId);
  const playerTaijutsu = playerSheet?.skills.taijutsu ?? 10;
  const targetTaijutsu = targetSheet?.skills.taijutsu ?? 10;
  const playerPhy = playerSheet?.stats.phy ?? 10;
  const targetPhy = targetSheet?.stats.phy ?? 10;

  // NPC picks its move (blind, simultaneous)
  const isDummy = world.destructibles.has(targetId);
  const npcAiType = isDummy ? 'dummy' as const : 'basic' as const;
  const npcTempo = isPlayerA ? eng.tempoB : eng.tempoA;
  const playerTempo = isPlayerA ? eng.tempoA : eng.tempoB;

  const npcMove = pickNpcMove(npcAiType, targetTaijutsu, npcTempo.current, playerTempo.current);

  // Resolve combat
  const outcome = isPlayerA
    ? resolveCombat(playerMove, npcMove, playerId, targetId, eng.tempoA, eng.tempoB, playerTaijutsu, targetTaijutsu, playerPhy, targetPhy)
    : resolveCombat(npcMove, playerMove, targetId, playerId, eng.tempoB, eng.tempoA, targetTaijutsu, playerTaijutsu, targetPhy, playerPhy);

  // Apply tempo changes — map by entity ID, not A/B position
  // outcome.attackerId/defenderId tell us WHO is in each role
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
      // Real entities take HP damage
      const targetHealth = world.healths.get(outcome.defenderId);
      if (targetHealth) {
        targetHealth.current = Math.max(0, targetHealth.current - outcome.damage);
      }
    }
    // Dummies don't have HP — they absorb hits

    // Drain stamina on attack
    if (outcome.attackerId === playerId) {
      const res = world.resources.get(playerId);
      if (res) {
        res.stamina = Math.max(0, res.stamina - 1);
      }
    }
  }

  // Generate and log flavor text with directional categories
  const attackerName = world.names.get(outcome.attackerId)?.display ?? 'Unknown';
  const defenderName = world.names.get(outcome.defenderId)?.display ?? 'Unknown';
  const flavor = generateCombatFlavor(outcome, attackerName, defenderName, playerTaijutsu, targetTaijutsu);

  const playerIsAttacker = outcome.attackerId === playerId;
  const playerIsDefender = outcome.defenderId === playerId;

  let logCategory: import('../types/actions.ts').LogCategory;
  switch (outcome.type) {
    case 'perfect_parry':
      logCategory = playerIsDefender ? 'miss_incoming' : 'miss_outgoing';
      break;
    case 'tempo_save':
      logCategory = playerIsDefender ? 'combat_tempo' : 'combat_tempo';
      break;
    case 'imperfect_block':
    case 'clean_hit':
    case 'clash_tempo_win':
    case 'clash_rng':
      if (outcome.damage > 0) {
        logCategory = playerIsAttacker ? 'hit_outgoing' : 'hit_incoming';
      } else {
        logCategory = playerIsAttacker ? 'miss_outgoing' : 'miss_incoming';
      }
      break;
    case 'clash_stalemate':
    case 'circling':
      logCategory = 'combat_neutral';
      break;
    case 'missed':
      logCategory = playerIsAttacker ? 'miss_outgoing' : 'miss_incoming';
      break;
    default:
      logCategory = 'combat_neutral';
  }

  world.log(flavor, logCategory);

  // Improve taijutsu skill from combat practice
  if (playerSheet) {
    playerSheet.skills.taijutsu = computeImprovement(
      playerSheet.skills.taijutsu,
      SKILL_IMPROVEMENT_RATES.taijutsu,
    );
    // PHY improves from physical combat
    playerSheet.stats.phy = computeImprovement(
      playerSheet.stats.phy,
      0.05, // slow stat improvement
    );
  }

  // Check for destruction — dummies only break from massive single hits
  const destructible = world.destructibles.get(targetId);
  if (destructible) {
    if (outcome.damage >= DUMMY_DESTROY_THRESHOLD) {
      world.log(destructible.onDestroyMessage, 'system');
      world.destroyEntity(targetId);
      engagements.delete(engagementKey(playerId, targetId));
    }
  } else {
    // Real entities die when HP hits 0
    const targetHealth = world.healths.get(targetId);
    if (targetHealth && targetHealth.current <= 0) {
      world.log(`${world.names.get(targetId)?.display ?? 'The enemy'} is defeated!`, 'system');
      world.destroyEntity(targetId);
      engagements.delete(engagementKey(playerId, targetId));
    }
  }

  eng.round++;
  world.currentTick += 1; // Combat always costs 1 tick

  return true;
}

/**
 * Get the player's current tempo state if in an engagement.
 */
export function getPlayerTempo(world: World): TempoState | null {
  const playerId = world.playerEntityId;
  const targetId = findAdjacentTarget(world);
  if (targetId === null) return null;

  const key = engagementKey(playerId, targetId);
  const eng = engagements.get(key);
  if (!eng) return null;

  return eng.entityA === playerId ? eng.tempoA : eng.tempoB;
}

/**
 * Clear engagement when entities move apart.
 */
export function clearStaleEngagements(world: World): void {
  for (const [key, eng] of engagements) {
    const posA = world.positions.get(eng.entityA);
    const posB = world.positions.get(eng.entityB);
    if (!posA || !posB) {
      engagements.delete(key);
      continue;
    }
    const dist = Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y - posB.y));
    if (dist > 1) {
      engagements.delete(key);
    }
  }
}
