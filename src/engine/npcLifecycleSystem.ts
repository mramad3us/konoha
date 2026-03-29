/**
 * NPC Lifecycle System — handles dusk despawning, dawn respawning, and door locking.
 *
 * At dusk (18:00):
 *   - Ninja NPCs: poof with smoke effect and vanish instantly
 *   - Civilian NPCs: start walking away (behavior → 'despawning')
 *   - Doors with lockedAtNight: close and lock
 *
 * At dawn (06:00):
 *   - Respawn all despawned NPCs at new random positions near their anchor
 *   - Unlock all night-locked doors
 */

import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import { getHour, getDayNumber } from './gameTime.ts';
import { DAWN_HOUR, DUSK_HOUR, NPC_WANDER_RADIUS } from '../core/constants.ts';
import { spawnSmokePuff } from '../systems/particleSystem.ts';

/** Track despawned NPC data for respawning */
export interface DespawnedNpcRecord {
  anchorX: number;
  anchorY: number;
  /** Index into a shared registry — we store full component snapshots instead */
  name: string;
  spritePrefix: string;
  lifecycle: { isNinja: boolean; despawnAtNight: boolean };
}

/**
 * Check and process dusk transitions.
 * Call every advanceTurn — internally gates on hour and day tracking.
 */
export function tickDuskTransition(world: World): void {
  const hour = getHour(world.gameTimeSeconds);
  const day = getDayNumber(world.gameTimeSeconds);

  if (hour < DUSK_HOUR || world.lastDuskDayProcessed >= day) return;
  world.lastDuskDayProcessed = day;

  // Collect NPCs to despawn
  const toDespawn: EntityId[] = [];

  for (const [id, lifecycle] of world.npcLifecycles) {
    if (!lifecycle.despawnAtNight) continue;
    if (id === world.playerEntityId) continue;
    toDespawn.push(id);
  }

  for (const id of toDespawn) {
    const lifecycle = world.npcLifecycles.get(id)!;
    const pos = world.positions.get(id);
    const anchor = world.anchors.get(id);
    const name = world.names.get(id)?.display ?? 'Someone';

    if (!pos || !anchor) {
      world.destroyEntity(id);
      continue;
    }

    // Store for respawn at dawn
    world.despawnedNpcDefs.push({
      anchorX: anchor.anchorX,
      anchorY: anchor.anchorY,
      npcIndex: -1, // Not used for named NPCs — they respawn via the full NPC system
    });

    if (lifecycle.isNinja) {
      // Ninja: instant poof with smoke
      if (world.isVisible(pos.x, pos.y)) {
        spawnSmokePuff(pos.x, pos.y, 10);
        world.log(`${name} vanishes in a puff of smoke.`, 'info');
      }
      world.destroyEntity(id);
    } else {
      // Civilian: walk away until out of sight
      const ai = world.aiControlled.get(id);
      if (ai) {
        ai.behavior = 'despawning';
      } else {
        // No AI component? Just destroy
        world.destroyEntity(id);
      }
    }
  }

  // Lock doors
  lockNightDoors(world, true);

  world.log('The village quiets as dusk settles over Konoha.', 'info');
}

/**
 * Check and process dawn transitions.
 * Respawns despawned NPCs at new random positions.
 */
export function tickDawnTransition(world: World): void {
  const hour = getHour(world.gameTimeSeconds);
  const day = getDayNumber(world.gameTimeSeconds);

  if (hour < DAWN_HOUR || hour >= DUSK_HOUR || world.lastDawnDayProcessed >= day) return;
  world.lastDawnDayProcessed = day;

  // Clear despawned list — NPCs will be respawned by the village generator's
  // spawnVillageNpcs on next village load. For time-skip (sleep/meditate),
  // despawnedNpcDefs is cleared and the existing NPC population is used.
  world.despawnedNpcDefs = [];

  // Unlock doors
  lockNightDoors(world, false);

  world.log('Dawn breaks over Konoha. The village stirs to life.', 'info');
}

/** Lock or unlock all doors marked lockedAtNight */
function lockNightDoors(world: World, lock: boolean): void {
  for (const [id, door] of world.doors) {
    if (!door.lockedAtNight) continue;

    door.isLocked = lock;

    if (lock && door.isOpen) {
      // Close and lock
      door.isOpen = false;
      const renderable = world.renderables.get(id);
      const blocking = world.blockings.get(id);
      if (renderable) renderable.spriteId = 'obj_door_closed';
      if (blocking) {
        blocking.blocksMovement = true;
        blocking.blocksSight = true;
      }
      const interactable = world.interactables.get(id);
      if (interactable) interactable.label = 'Open';
    }
  }
}

/**
 * Respawn wandering NPCs after a time skip (sleep, meditate).
 * Called from game.ts after advancing time past dawn.
 * This randomizes positions of all existing wandering NPCs.
 */
export function reshuffleWanderingNpcs(world: World): void {
  for (const [id, lifecycle] of world.npcLifecycles) {
    if (lifecycle.category !== 'wandering') continue;
    if (id === world.playerEntityId) continue;

    const anchor = world.anchors.get(id);
    const pos = world.positions.get(id);
    if (!anchor || !pos) continue;

    const radius = NPC_WANDER_RADIUS;
    let placed = false;

    for (let attempt = 0; attempt < 12; attempt++) {
      const ox = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const oy = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const tx = anchor.anchorX + ox;
      const ty = anchor.anchorY + oy;

      if (tx === pos.x && ty === pos.y) continue;
      if (!world.tileMap.isWalkable(tx, ty)) continue;
      if (world.isBlockedByEntity(tx, ty)) continue;

      world.moveInGrid(id, pos.x, pos.y, tx, ty);
      pos.x = tx;
      pos.y = ty;
      placed = true;
      break;
    }

    // If can't place randomly, move back to anchor
    if (!placed && !world.isBlockedByEntity(anchor.anchorX, anchor.anchorY)) {
      world.moveInGrid(id, pos.x, pos.y, anchor.anchorX, anchor.anchorY);
      pos.x = anchor.anchorX;
      pos.y = anchor.anchorY;
    }
  }
}
