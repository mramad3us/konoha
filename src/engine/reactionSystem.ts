/**
 * Reaction Time System — governs how fast entities can respond to threats.
 *
 * Every entity (player AND NPCs) has a reaction delay when:
 * - First detecting a new threat (fresh aggro)
 * - A threat teleports/repositions 2+ tiles in one action (substitution, shadow step)
 * - Recovering after teleporting (post-teleport recovery)
 *
 * During reaction delay, the entity CANNOT:
 * - Attack or initiate combat
 * - Turn to face a new threat
 * - Take opportunity attacks
 *
 * The entity CAN still:
 * - Be attacked (they're vulnerable)
 * - Move (flee, chase — if not also stunned)
 *
 * Reaction speed scales with taijutsu skill.
 * Throw-mode entry speed scales with bukijutsu skill.
 */

import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import {
  REACTION_DELAY_FRESH,
  REACTION_DELAY_REPOSITION,
  THROW_ENTRY_TICKS,
  THROW_REENTRY_TICKS,
  SUBDUE_ASSASSINATE_TICKS,
} from '../core/constants.ts';

// ── Bracket Lookups ──

/** Taijutsu bracket: 0=<10, 1=10-19, 2=20-39, 3=40-59, 4=60+ */
function getTaijutsuBracket(taijutsu: number): number {
  if (taijutsu >= 60) return 4;
  if (taijutsu >= 40) return 3;
  if (taijutsu >= 20) return 2;
  if (taijutsu >= 10) return 1;
  return 0;
}

/** Bukijutsu bracket: 0=<10, 1=10-15, 2=16-30, 3=31-45, 4=46+ */
function getBukijutsuBracket(bukijutsu: number): number {
  if (bukijutsu >= 46) return 4;
  if (bukijutsu >= 31) return 3;
  if (bukijutsu >= 16) return 2;
  if (bukijutsu >= 10) return 1;
  return 0;
}

// ── Delay Lookups ──

/** Get fresh detection reaction delay in ticks for an entity */
export function getFreshReactionDelay(world: World, entityId: EntityId): number {
  const sheet = world.characterSheets.get(entityId);
  const taijutsu = sheet?.skills.taijutsu ?? 5;
  return REACTION_DELAY_FRESH[getTaijutsuBracket(taijutsu)];
}

/** Get mid-combat reposition reaction delay in ticks (halved values) */
export function getRepositionReactionDelay(world: World, entityId: EntityId): number {
  const sheet = world.characterSheets.get(entityId);
  const taijutsu = sheet?.skills.taijutsu ?? 5;
  return REACTION_DELAY_REPOSITION[getTaijutsuBracket(taijutsu)];
}

/** Get throw mode entry delay in ticks */
export function getThrowEntryDelay(world: World, entityId: EntityId): number {
  const sheet = world.characterSheets.get(entityId);
  const buki = sheet?.skills.bukijutsu ?? 5;
  return THROW_ENTRY_TICKS[getBukijutsuBracket(buki)];
}

/** Get subdue/assassinate execution time in ticks (taijutsu-scaled) */
export function getSubdueTime(world: World, entityId: EntityId): number {
  const sheet = world.characterSheets.get(entityId);
  const taijutsu = sheet?.skills.taijutsu ?? 5;
  return SUBDUE_ASSASSINATE_TICKS[getTaijutsuBracket(taijutsu)];
}

/** Get throw-to-throw reentry delay in ticks */
export function getThrowReentryDelay(world: World, entityId: EntityId): number {
  const sheet = world.characterSheets.get(entityId);
  const buki = sheet?.skills.bukijutsu ?? 5;
  return THROW_REENTRY_TICKS[getBukijutsuBracket(buki)];
}

// ── Reaction Delay Management ──

export type ReactionSource = 'fresh_aggro' | 'reposition' | 'teleport_recovery';

/**
 * Apply a reaction delay to an entity.
 * Won't stack — if the entity already has an active delay, the new one is ignored
 * UNLESS it's longer than the remaining delay (upgrade to the longer one).
 */
export function applyReactionDelay(
  world: World,
  entityId: EntityId,
  delayTicks: number,
  source: ReactionSource,
): void {
  const canActAtTick = world.currentTick + delayTicks;
  const existing = world.reactionDelays.get(entityId);

  // Don't downgrade an existing longer delay
  if (existing && existing.canActAtTick >= canActAtTick) return;

  world.reactionDelays.set(entityId, { canActAtTick, source });
}

/** Check if entity is currently in reaction delay (cannot act) */
export function isInReactionDelay(world: World, entityId: EntityId): boolean {
  const rd = world.reactionDelays.get(entityId);
  if (!rd) return false;
  return world.currentTick < rd.canActAtTick;
}

/** Clean up expired reaction delays. Called every tick from worldTick. */
export function tickReactionDelays(world: World): void {
  for (const [id, rd] of world.reactionDelays) {
    if (world.currentTick >= rd.canActAtTick) {
      world.reactionDelays.delete(id);
    }
  }
}

/**
 * Apply reposition reaction delays to all enemies near a position.
 * Called after substitution/shadow step lands.
 * Applies mid-combat reposition delay to NPCs at the destination,
 * and fresh detection delay to NPCs that weren't previously engaged.
 */
export function applyRepositionDelaysNearby(
  world: World,
  casterId: EntityId,
  x: number,
  y: number,
): void {
  // Check all entities within 2 tiles of destination
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const entities = world.getEntitiesAt(x + dx, y + dy);
      for (const eid of entities) {
        if (eid === casterId) continue;
        if (world.unconscious.has(eid) || world.dead.has(eid)) continue;
        if (world.squadMembers.has(eid) && world.squadMembers.has(casterId)) continue;

        // Only affect hostile entities (aggros) or entities the caster is hostile to
        const aggro = world.aggros.get(eid);
        if (!aggro) continue;

        // Were they already in combat (aggro state)? Halved delay.
        // Were they idle? Full fresh detection delay.
        if (aggro.state === 'aggro' || aggro.state === 'fleeing') {
          const delay = getRepositionReactionDelay(world, eid);
          applyReactionDelay(world, eid, delay, 'reposition');
        } else {
          const delay = getFreshReactionDelay(world, eid);
          applyReactionDelay(world, eid, delay, 'fresh_aggro');
        }
      }
    }
  }
}

/**
 * Get how many ticks the "wait" action should pass for this entity.
 * Uses the same taijutsu scaling as fresh detection delay.
 * A skilled fighter's "wait" is a brief, sharp interval.
 * An unskilled character waits longer (slower reactions = slower pace).
 */
export function getWaitDuration(world: World, entityId: EntityId): number {
  return getFreshReactionDelay(world, entityId);
}
