/**
 * Jutsu resolution — executes jutsu effects by type.
 * Scalable: each effect type has its own handler function.
 * Adding a new jutsu = add to registry + add handler if new effect type.
 */

import type { JutsuDefinition, JutsuCooldowns } from '../types/jutsu.ts';
import { JUTSU_REGISTRY, getJutsuByCombatKey } from '../data/jutsus.ts';
import { computeImprovement, SKILL_IMPROVEMENT_RATES, STAT_IMPROVEMENT_RATES } from '../types/character.ts';
import { checkSkillUp } from './skillFeedback.ts';
import { COMBAT_PASS_SUBTICKS, FOV_RADIUS, PASS_DURATION_SECONDS, CHAKRA_FATIGUE_DRAIN, CHAKRA_FATIGUE_FLOOR } from '../core/constants.ts';
import { getMissionXpMultiplier } from './missions.ts';
import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import { spawnSmokePuff } from '../systems/particleSystem.ts';
import { sfxSubstitution } from '../systems/audioSystem.ts';
import { clearStaleEngagements } from './combatSystem.ts';
import { computeFOV } from './fov.ts';
import { getNightFovReduction } from './gameTime.ts';

/** Per-entity cooldown tracking */
const cooldowns = new Map<EntityId, JutsuCooldowns>();

function getCooldowns(entityId: EntityId): JutsuCooldowns {
  let cd = cooldowns.get(entityId);
  if (!cd) {
    cd = {};
    cooldowns.set(entityId, cd);
  }
  return cd;
}

export type JutsuResult =
  | { success: true; message: string }
  | { success: false; reason: 'no_chakra' | 'cooldown' | 'not_learned' | 'no_target' | 'blocked' };

/**
 * Attempt to cast a jutsu by combat key.
 * Returns result indicating success or failure reason.
 */
export function tryCastJutsuByKey(
  world: World,
  casterId: EntityId,
  combatKey: string,
  targetId: EntityId | null,
): JutsuResult {
  const jutsu = getJutsuByCombatKey(combatKey);
  if (!jutsu) return { success: false, reason: 'not_learned' };

  return tryCastJutsu(world, casterId, jutsu.id, targetId);
}

/**
 * Attempt to cast a jutsu by ID.
 */
export function tryCastJutsu(
  world: World,
  casterId: EntityId,
  jutsuId: string,
  targetId: EntityId | null,
): JutsuResult {
  const jutsu = JUTSU_REGISTRY[jutsuId];
  if (!jutsu) return { success: false, reason: 'not_learned' };

  // Check if learned
  const sheet = world.characterSheets.get(casterId);
  if (!sheet || !sheet.learnedJutsus.includes(jutsuId)) {
    return { success: false, reason: 'not_learned' };
  }

  // Check chakra
  const resources = world.resources.get(casterId);
  if (!resources || resources.chakra < jutsu.chakraCost) {
    return { success: false, reason: 'no_chakra' };
  }

  // Check cooldown
  const cd = getCooldowns(casterId);
  if (cd[jutsuId] && cd[jutsuId] > world.currentTick) {
    return { success: false, reason: 'cooldown' };
  }

  // ── Execute by effect type ──
  const result = executeEffect(world, casterId, targetId, jutsu);
  if (!result.success) return result;

  // Consume chakra
  resources.chakra -= jutsu.chakraCost;
  resources.chakraCeiling = Math.max(resources.maxChakra * CHAKRA_FATIGUE_FLOOR, resources.chakraCeiling - CHAKRA_FATIGUE_DRAIN);
  resources.lastChakraExertionTick = world.currentTick;

  // Set cooldown
  cd[jutsuId] = world.currentTick + jutsu.cooldownPasses;

  // Improve ninjutsu + CHA
  if (sheet) {
    const mxp = getMissionXpMultiplier(world.missionLog);
    const oldNin = sheet.skills.ninjutsu;
    sheet.skills.ninjutsu = computeImprovement(oldNin, SKILL_IMPROVEMENT_RATES.ninjutsu, 2.0, mxp);
    checkSkillUp(world, 'ninjutsu', oldNin, sheet.skills.ninjutsu);
    const oldCha = sheet.stats.cha;
    sheet.stats.cha = computeImprovement(oldCha, STAT_IMPROVEMENT_RATES.cha_ninjutsu_use, 2.0, mxp);
    checkSkillUp(world, 'cha', oldCha, sheet.stats.cha);
  }

  // Advance time — jutsu cast = 1 combat pass (4 subticks, 2s)
  world.advanceTime(COMBAT_PASS_SUBTICKS, PASS_DURATION_SECONDS);

  // Pick a random cast message
  const casterName = world.names.get(casterId)?.display ?? 'Unknown';
  const targetName = targetId ? (world.names.get(targetId)?.display ?? 'the opponent') : '';
  const msg = jutsu.castMessages[Math.floor(Math.random() * jutsu.castMessages.length)]
    .replace(/\{caster\}/g, casterName)
    .replace(/\{target\}/g, targetName);

  return { success: true, message: msg };
}

/**
 * Get a failure message for a jutsu cast attempt.
 */
export function getJutsuFailMessage(jutsuId: string, reason: string): string {
  const jutsu = JUTSU_REGISTRY[jutsuId];
  if (!jutsu?.failMessages) return 'The jutsu fails.';
  const pool = jutsu.failMessages[reason];
  if (!pool || pool.length === 0) return 'The jutsu fails.';
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── EFFECT HANDLERS ──

function executeEffect(
  world: World,
  casterId: EntityId,
  targetId: EntityId | null,
  jutsu: JutsuDefinition,
): JutsuResult {
  switch (jutsu.effect.type) {
    case 'substitution':
      return executeSubstitution(world, casterId, targetId);
    default:
      return { success: false, reason: 'blocked' };
  }
}

/** Substitution (Kawarimi): teleport based on ninjutsu skill level.
 *  Basic (ninjutsu <= 40): body flicker — one tile away from opponent.
 *  Advanced (ninjutsu > 40): teleport to opposite side of opponent (behind them). */
function executeSubstitution(
  world: World,
  casterId: EntityId,
  targetId: EntityId | null,
): JutsuResult {
  if (!targetId) return { success: false, reason: 'no_target' };

  const casterPos = world.positions.get(casterId);
  const targetPos = world.positions.get(targetId);
  if (!casterPos || !targetPos) return { success: false, reason: 'no_target' };

  const ninjutsuSkill = world.characterSheets.get(casterId)?.skills.ninjutsu ?? 0;
  const dx = casterPos.x - targetPos.x;
  const dy = casterPos.y - targetPos.y;

  let newX: number;
  let newY: number;

  if (ninjutsuSkill <= 40) {
    // Basic body flicker: one tile AWAY from opponent (escape, not flanking)
    const awayDx = Math.sign(dx) || (Math.random() < 0.5 ? 1 : -1);
    const awayDy = Math.sign(dy) || (Math.random() < 0.5 ? 1 : -1);
    newX = casterPos.x + awayDx;
    newY = casterPos.y + awayDy;

    // If blocked, try cardinal directions away, then perpendicular
    if (!world.tileMap.isWalkable(newX, newY) || world.isBlockedByEntity(newX, newY)) {
      const alternatives = [
        { x: casterPos.x + awayDx, y: casterPos.y },           // horizontal away
        { x: casterPos.x, y: casterPos.y + awayDy },           // vertical away
        { x: casterPos.x + awayDy, y: casterPos.y - awayDx },  // perpendicular
        { x: casterPos.x - awayDy, y: casterPos.y + awayDx },  // perpendicular other side
      ];
      let found = false;
      for (const alt of alternatives) {
        if (world.tileMap.isWalkable(alt.x, alt.y) && !world.isBlockedByEntity(alt.x, alt.y)) {
          newX = alt.x;
          newY = alt.y;
          found = true;
          break;
        }
      }
      if (!found) return { success: false, reason: 'blocked' };
    }
  } else {
    // Advanced: teleport to opposite side of opponent (behind them)
    newX = targetPos.x - dx;
    newY = targetPos.y - dy;

    // If blocked, try adjacent tiles
    if (!world.tileMap.isWalkable(newX, newY) || world.isBlockedByEntity(newX, newY)) {
      const alternatives = [
        { x: targetPos.x + dy, y: targetPos.y - dx },
        { x: targetPos.x - dy, y: targetPos.y + dx },
        { x: casterPos.x + dx, y: casterPos.y + dy }, // further away same direction
      ];
      let found = false;
      for (const alt of alternatives) {
        if (world.tileMap.isWalkable(alt.x, alt.y) && !world.isBlockedByEntity(alt.x, alt.y)) {
          newX = alt.x;
          newY = alt.y;
          found = true;
          break;
        }
      }
      if (!found) return { success: false, reason: 'blocked' };
    }
  }

  // Smoke at origin
  spawnSmokePuff(casterPos.x, casterPos.y, 10);

  // Sound
  sfxSubstitution();

  // Teleport
  world.moveInGrid(casterId, casterPos.x, casterPos.y, newX, newY);
  casterPos.x = newX;
  casterPos.y = newY;

  // Smoke at destination
  spawnSmokePuff(newX, newY, 6);

  // Clear combat engagement
  clearStaleEngagements(world);

  // Recompute FOV
  const nightReduction = getNightFovReduction(world.gameTimeSeconds);
  computeFOV(world, newX, newY, Math.max(3, FOV_RADIUS - nightReduction));

  return { success: true, message: '' };
}
