/**
 * NPC Lifecycle System — handles dusk despawning, dawn respawning, and door locking.
 *
 * At dusk (18:00):
 *   - Ninja NPCs: poof with smoke effect and vanish instantly
 *   - Civilian NPCs: start walking away (behavior → 'despawning')
 *   - Doors with lockedAtNight: close and lock
 *
 * At dawn (06:00):
 *   - Respawn all despawned NPCs from stored snapshots
 *   - Randomize positions near their anchor
 *   - Unlock all night-locked doors
 */

import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import { getHour, getDayNumber } from './gameTime.ts';
import { DAWN_HOUR, DUSK_HOUR, NPC_WANDER_RADIUS, NPC_WANDER_INTERVAL_MIN, NPC_WANDER_INTERVAL_MAX } from '../core/constants.ts';
import { spawnSmokePuff } from '../systems/particleSystem.ts';
import { computeMaxHp } from './derivedStats.ts';

/** Full snapshot of an NPC's components for respawning at dawn */
export interface DespawnedNpcSnapshot {
  anchorX: number;
  anchorY: number;
  name: string;
  spritePrefix: string;
  // Character sheet
  charClass: string;
  rank: string;
  title: string;
  skills: Record<string, number>;
  stats: Record<string, number>;
  // Combat
  damage: number;
  accuracy: number;
  evasion: number;
  // Lifecycle
  category: string;
  isNinja: boolean;
  despawnAtNight: boolean;
  // Dialogue
  description: string;
  dialogueLines: Record<string, string[]>;
  cooldownTicks: number;
}

/**
 * Check and process dusk transitions.
 * Call from worldTick slow systems — internally gates on hour and day tracking.
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

    // Snapshot all components for dawn respawn
    const sheet = world.characterSheets.get(id);
    const combat = world.combatStats.get(id);
    const objSheet = world.objectSheets.get(id);
    const dialogue = world.proximityDialogue.get(id);

    const snapshot: DespawnedNpcSnapshot = {
      anchorX: anchor.anchorX,
      anchorY: anchor.anchorY,
      name,
      spritePrefix: anchor.spritePrefix,
      charClass: sheet?.class ?? 'civilian',
      rank: sheet?.rank ?? 'academy_student',
      title: sheet?.title ?? '',
      skills: { ...(sheet?.skills ?? { taijutsu: 1, bukijutsu: 0, ninjutsu: 0, genjutsu: 0, med: 0 }) },
      stats: { ...(sheet?.stats ?? { phy: 5, cha: 3, men: 3 }) },
      damage: combat?.damage ?? 0,
      accuracy: combat?.accuracy ?? 50,
      evasion: combat?.evasion ?? 0,
      category: lifecycle.category,
      isNinja: lifecycle.isNinja,
      despawnAtNight: lifecycle.despawnAtNight,
      description: objSheet?.description ?? '',
      dialogueLines: dialogue?.lines ? { ...dialogue.lines } : {},
      cooldownTicks: dialogue?.cooldownTicks ?? 25,
    };

    world.despawnedNpcDefs.push(snapshot);

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
 * Respawns despawned NPCs from stored snapshots at new random positions.
 */
export function tickDawnTransition(world: World): void {
  const hour = getHour(world.gameTimeSeconds);
  const day = getDayNumber(world.gameTimeSeconds);

  if (hour < DAWN_HOUR || hour >= DUSK_HOUR || world.lastDawnDayProcessed >= day) return;
  world.lastDawnDayProcessed = day;

  // Respawn all despawned NPCs from snapshots
  for (const snap of world.despawnedNpcDefs) {
    respawnNpcFromSnapshot(world, snap);
  }
  world.despawnedNpcDefs = [];

  // Also clean up any 'despawning' civilians that didn't get destroyed
  for (const [id, ai] of world.aiControlled) {
    if (ai.behavior === 'despawning') {
      world.destroyEntity(id);
    }
  }

  // Unlock doors
  lockNightDoors(world, false);

  world.log('Dawn breaks over Konoha. The village stirs to life.', 'info');
}

/** Recreate an NPC entity from a dusk snapshot */
function respawnNpcFromSnapshot(world: World, snap: DespawnedNpcSnapshot): void {
  const isWandering = snap.category === 'wandering';

  // Randomize spawn position for wandering NPCs
  let spawnX = snap.anchorX;
  let spawnY = snap.anchorY;
  if (isWandering) {
    const radius = NPC_WANDER_RADIUS;
    for (let attempt = 0; attempt < 12; attempt++) {
      const ox = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const oy = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const tx = snap.anchorX + ox;
      const ty = snap.anchorY + oy;
      if (world.tileMap.isWalkable(tx, ty) && !world.isBlockedByEntity(tx, ty)) {
        spawnX = tx;
        spawnY = ty;
        break;
      }
    }
  }

  const id = world.createEntity();
  const hp = computeMaxHp(snap.stats as any);

  world.setPosition(id, { x: spawnX, y: spawnY, facing: 's' });
  world.renderables.set(id, { spriteId: `${snap.spritePrefix}_s`, layer: 'character', offsetY: -16 });
  world.blockings.set(id, { blocksMovement: true, blocksSight: false });
  world.healths.set(id, { current: hp, max: hp });
  world.combatStats.set(id, {
    damage: snap.damage,
    accuracy: snap.accuracy,
    evasion: snap.evasion,
    attackVerb: 'strike',
  });
  world.characterSheets.set(id, {
    class: snap.charClass as any,
    rank: snap.rank as any,
    title: snap.title,
    skills: snap.skills as any,
    stats: snap.stats as any,
    learnedJutsus: [],
  });
  world.names.set(id, { display: snap.name, article: '' });
  world.aiControlled.set(id, { behavior: isWandering ? 'wander' : 'static' });
  world.objectSheets.set(id, { description: snap.description, category: 'npc' });
  world.proximityDialogue.set(id, {
    lines: snap.dialogueLines,
    lastSpokeTick: -100,
    cooldownTicks: snap.cooldownTicks,
  });

  // Anchor & lifecycle
  const wanderInterval = NPC_WANDER_INTERVAL_MIN + Math.floor(Math.random() * (NPC_WANDER_INTERVAL_MAX - NPC_WANDER_INTERVAL_MIN + 1));
  world.anchors.set(id, {
    anchorX: snap.anchorX,
    anchorY: snap.anchorY,
    wanderRadius: isWandering ? NPC_WANDER_RADIUS : 0,
    lastMoveTick: world.currentTick,
    moveIntervalTicks: wanderInterval,
    spritePrefix: snap.spritePrefix,
  });
  world.npcLifecycles.set(id, {
    category: snap.category as any,
    isNinja: snap.isNinja,
    despawnAtNight: snap.despawnAtNight,
  });
  world.aggros.set(id, {
    targetId: null,
    state: 'idle',
    fleeHpThreshold: snap.isNinja ? 0.20 : 0.40,
  });
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
