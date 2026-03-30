/**
 * NPC Movement System — handles idle wandering, despawning walk-off, and return-to-anchor.
 *
 * Runs once per advanceTurn() call. Each NPC with 'wander' behavior takes a random
 * step every few ticks, staying within their anchor radius. NPCs in 'despawning'
 * state walk away from the player until out of sight, then are destroyed.
 * NPCs in 'return_to_anchor' state step toward their anchor point.
 */

import type { World } from './world.ts';
import type { Direction, EntityId, AggroComponent } from '../types/ecs.ts';
import { npcFaceTowardPlayer } from './surpriseAttack.ts';
import { initiateNpcEngagement } from './combatSystem.ts';
import { spawnFloatingText } from '../systems/floatingTextSystem.ts';

const CARDINAL_DIRS: Array<{ dx: number; dy: number; dir: Direction }> = [
  { dx: 0, dy: -1, dir: 'n' },
  { dx: 0, dy: 1, dir: 's' },
  { dx: 1, dy: 0, dir: 'e' },
  { dx: -1, dy: 0, dir: 'w' },
];

/** Map direction to cardinal for sprite selection */
function dirToCardinal(dir: Direction): 'n' | 's' | 'e' | 'w' {
  switch (dir) {
    case 'n': case 'nw': case 'ne': return 'n';
    case 's': case 'sw': case 'se': return 's';
    case 'e': return 'e';
    case 'w': return 'w';
  }
}

/** Move an NPC one tile and update its sprite facing */
function moveNpc(world: World, id: EntityId, dx: number, dy: number, dir: Direction): void {
  const pos = world.positions.get(id)!;
  const newX = pos.x + dx;
  const newY = pos.y + dy;

  world.moveInGrid(id, pos.x, pos.y, newX, newY);
  pos.x = newX;
  pos.y = newY;
  pos.facing = dir;

  const anchor = world.anchors.get(id);
  const renderable = world.renderables.get(id);
  if (renderable && anchor) {
    renderable.spriteId = `${anchor.spritePrefix}_${dirToCardinal(dir)}`;
  }
}

/** Chebyshev distance */
function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Manhattan distance */
function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** Detection range for aggro (tiles) */
const AGGRO_DETECTION_RANGE = 8;
/** Distance at which a fleeing NPC considers itself safe */
const FLEE_SAFE_DISTANCE = 15;

/**
 * Bresenham line-of-sight check.
 * Returns true if no intermediate tile blocks sight between (x1,y1) and (x2,y2).
 * Start and end tiles are NOT checked for opacity — only intermediate tiles.
 */
export function hasLineOfSight(world: World, x1: number, y1: number, x2: number, y2: number): boolean {
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  let cx = x1;
  let cy = y1;

  while (cx !== x2 || cy !== y2) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
    // Skip the endpoint itself
    if (cx === x2 && cy === y2) break;
    // Check if this intermediate tile blocks sight
    if (!world.tileMap.isTransparent(cx, cy)) return false;
  }
  return true;
}

/**
 * Check flee conditions for an aggro'd NPC.
 * Returns true if the NPC should start fleeing.
 */
function shouldFlee(world: World, id: EntityId, aggro: AggroComponent): boolean {
  const health = world.healths.get(id);
  if (!health) return false;

  const hpFraction = health.current / health.max;

  // Big hit detection: HP dropped by 50%+ of max in a single tick
  if (aggro.lastKnownHp !== undefined) {
    const hpDrop = aggro.lastKnownHp - health.current;
    if (hpDrop >= health.max * 0.5) {
      if (Math.random() < 0.6) return true;
    }
  }

  // Low HP flee
  if (hpFraction < aggro.fleeHpThreshold) {
    if (Math.random() < 0.3) return true;
  }

  // Willpower exhaustion
  const resources = world.resources.get(id);
  if (resources && resources.maxWillpower > 0) {
    if (resources.willpower / resources.maxWillpower < 0.15) {
      if (Math.random() < 0.4) return true;
    }
  }

  return false;
}

/** Tick idle wandering for all wandering NPCs */
export function tickNpcMovement(world: World): void {
  for (const [id, ai] of world.aiControlled) {
    if (id === world.playerEntityId) continue;

    // Skip unconscious, dead, restrained, or carried NPCs
    if (world.unconscious.has(id) || world.dead.has(id) || world.restrained.has(id) || world.carried.has(id)) continue;

    const anchor = world.anchors.get(id);
    if (!anchor) continue;
    const pos = world.positions.get(id);
    if (!pos) continue;

    // NPCs turn to face the player when they perceive them within 2 tiles
    // This happens before movement so the NPC reacts to player proximity
    npcFaceTowardPlayer(world, id);

    // ── Aggro tick (mission maps only) ──
    if (world.awayMissionState) {
      const aggro = world.aggros.get(id);
      if (aggro) {
        tickAggro(world, id, pos, aggro, ai);
      }
    }

    switch (ai.behavior) {
      case 'wander':
        tickWander(world, id, pos, anchor);
        break;
      case 'despawning':
        tickDespawnWalk(world, id, pos);
        break;
      case 'return_to_anchor':
        tickReturnToAnchor(world, id, pos, anchor, ai);
        break;
      case 'chase':
        tickChase(world, id, pos);
        break;
      case 'flee':
        tickFlee(world, id, pos);
        break;
    }
  }
}

function tickWander(
  world: World,
  id: EntityId,
  pos: { x: number; y: number },
  anchor: { anchorX: number; anchorY: number; wanderRadius: number; lastMoveTick: number; moveIntervalTicks: number },
): void {
  if (world.currentTick - anchor.lastMoveTick < anchor.moveIntervalTicks) return;
  anchor.lastMoveTick = world.currentTick;

  // Pick a random cardinal direction
  const shuffled = [...CARDINAL_DIRS].sort(() => Math.random() - 0.5);

  for (const { dx, dy, dir } of shuffled) {
    const newX = pos.x + dx;
    const newY = pos.y + dy;

    // Stay within wander radius of anchor
    if (chebyshev(newX, newY, anchor.anchorX, anchor.anchorY) > anchor.wanderRadius) continue;

    // Check walkability and blocking
    if (!world.tileMap.isWalkable(newX, newY)) continue;
    if (world.isBlockedByEntity(newX, newY)) continue;

    moveNpc(world, id, dx, dy, dir);
    return;
  }
  // If no valid move found, just wait
}

/** Despawning walk: head away from player, destroy once out of FOV */
function tickDespawnWalk(world: World, id: EntityId, pos: { x: number; y: number }): void {
  // Check if already out of sight
  if (!world.isVisible(pos.x, pos.y)) {
    // Store despawn info before destroying
    const anchor = world.anchors.get(id);
    const lifecycle = world.npcLifecycles.get(id);
    if (anchor && lifecycle) {
      // Track for dawn respawn — store anchor info and an index
      // (Actual NpcDef-based respawn handled by lifecycle system)
    }
    world.destroyEntity(id);
    return;
  }

  // Move away from player
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return;

  const dx = Math.sign(pos.x - playerPos.x) || (Math.random() < 0.5 ? 1 : -1);
  const dy = Math.sign(pos.y - playerPos.y) || (Math.random() < 0.5 ? 1 : -1);

  // Try primary direction, then fallbacks
  const attempts = [
    { dx, dy: 0 },
    { dx: 0, dy },
    { dx, dy },
    { dx: -dx, dy: 0 },
    { dx: 0, dy: -dy },
  ];

  for (const a of attempts) {
    if (a.dx === 0 && a.dy === 0) continue;
    const newX = pos.x + a.dx;
    const newY = pos.y + a.dy;
    if (!world.tileMap.isWalkable(newX, newY)) continue;
    if (world.isBlockedByEntity(newX, newY)) continue;

    const dir: Direction = a.dx > 0 ? (a.dy < 0 ? 'ne' : a.dy > 0 ? 'se' : 'e')
      : a.dx < 0 ? (a.dy < 0 ? 'nw' : a.dy > 0 ? 'sw' : 'w')
      : (a.dy < 0 ? 'n' : 's');
    moveNpc(world, id, a.dx, a.dy, dir);
    return;
  }

  // Stuck — force despawn after a few ticks of being stuck
  world.destroyEntity(id);
}

/** Return to anchor: step toward anchor point, switch back to wander when arrived */
function tickReturnToAnchor(
  world: World,
  id: EntityId,
  pos: { x: number; y: number },
  anchor: { anchorX: number; anchorY: number; lastMoveTick: number; moveIntervalTicks: number },
  ai: { behavior: string },
): void {
  if (world.currentTick - anchor.lastMoveTick < 2) return; // move every 2 ticks (brisk walk)
  anchor.lastMoveTick = world.currentTick;

  const dist = chebyshev(pos.x, pos.y, anchor.anchorX, anchor.anchorY);
  if (dist <= 1) {
    (ai as { behavior: string }).behavior = 'wander';
    return;
  }

  const dx = Math.sign(anchor.anchorX - pos.x);
  const dy = Math.sign(anchor.anchorY - pos.y);

  // Try direct, then axis-only
  const attempts = [
    { dx, dy },
    { dx, dy: 0 },
    { dx: 0, dy },
  ];

  for (const a of attempts) {
    if (a.dx === 0 && a.dy === 0) continue;
    const newX = pos.x + a.dx;
    const newY = pos.y + a.dy;
    if (!world.tileMap.isWalkable(newX, newY)) continue;
    if (world.isBlockedByEntity(newX, newY)) continue;

    const dir: Direction = a.dx > 0 ? (a.dy < 0 ? 'ne' : a.dy > 0 ? 'se' : 'e')
      : a.dx < 0 ? (a.dy < 0 ? 'nw' : a.dy > 0 ? 'sw' : 'w')
      : (a.dy < 0 ? 'n' : 's');
    moveNpc(world, id, a.dx, a.dy, dir);
    return;
  }
}

// ── Aggro / Chase / Flee systems (mission maps only) ──

/** Pick the best cardinal direction (dx,dy) to step toward a target */
function pickDirectionToward(
  pos: { x: number; y: number },
  targetX: number,
  targetY: number,
): { dx: number; dy: number } {
  let bestDx = 0;
  let bestDy = 0;
  let bestDist = Infinity;
  for (const { dx, dy } of CARDINAL_DIRS) {
    const d = manhattan(pos.x + dx, pos.y + dy, targetX, targetY);
    if (d < bestDist) {
      bestDist = d;
      bestDx = dx;
      bestDy = dy;
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** Pick the best cardinal direction (dx,dy) to step away from a target */
function pickDirectionAway(
  pos: { x: number; y: number },
  targetX: number,
  targetY: number,
): { dx: number; dy: number } {
  let bestDx = 0;
  let bestDy = 0;
  let bestDist = -Infinity;
  for (const { dx, dy } of CARDINAL_DIRS) {
    const d = manhattan(pos.x + dx, pos.y + dy, targetX, targetY);
    if (d > bestDist) {
      bestDist = d;
      bestDx = dx;
      bestDy = dy;
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** Convert dx/dy to a Direction */
function deltaToDir(dx: number, dy: number): Direction {
  if (dx > 0) return dy < 0 ? 'ne' : dy > 0 ? 'se' : 'e';
  if (dx < 0) return dy < 0 ? 'nw' : dy > 0 ? 'sw' : 'w';
  return dy < 0 ? 'n' : 's';
}

/** Try to move NPC one step in a given direction, with cardinal fallbacks */
function tryStepToward(
  world: World,
  id: EntityId,
  pos: { x: number; y: number },
  dx: number,
  dy: number,
): boolean {
  const attempts = [
    { dx, dy: 0 },
    { dx: 0, dy },
    { dx: 0, dy: dy || 1 },
    { dx: dx || 1, dy: 0 },
  ];

  for (const a of attempts) {
    if (a.dx === 0 && a.dy === 0) continue;
    const newX = pos.x + a.dx;
    const newY = pos.y + a.dy;
    if (!world.tileMap.isWalkable(newX, newY)) continue;
    if (world.isBlockedByEntity(newX, newY)) continue;
    moveNpc(world, id, a.dx, a.dy, deltaToDir(a.dx, a.dy));
    return true;
  }
  return false;
}

/**
 * Aggro state machine tick. Runs BEFORE the behavior switch.
 * Transitions aggro state and updates ai.behavior accordingly.
 */
function tickAggro(
  world: World,
  id: EntityId,
  pos: { x: number; y: number },
  aggro: AggroComponent,
  ai: { behavior: string },
): void {
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return;

  const dist = chebyshev(pos.x, pos.y, playerPos.x, playerPos.y);
  const npcName = world.names.get(id)?.display ?? 'An enemy';

  switch (aggro.state) {
    case 'idle': {
      // Check if NPC can see the player within detection range
      if (dist <= AGGRO_DETECTION_RANGE && hasLineOfSight(world, pos.x, pos.y, playerPos.x, playerPos.y)) {
        aggro.state = 'aggro';
        aggro.targetId = world.playerEntityId;
        ai.behavior = 'chase';
        const health = world.healths.get(id);
        if (health) aggro.lastKnownHp = health.current;
        world.log(`${npcName} spots you!`, 'hit_incoming');
        spawnFloatingText(pos.x, pos.y, '!', '#ff4444', 1.5, 16);
      }
      break;
    }

    case 'aggro': {
      // Check flee conditions
      if (shouldFlee(world, id, aggro)) {
        aggro.state = 'fleeing';
        ai.behavior = 'flee';
        world.log(`${npcName} tries to flee!`, 'info');
        const FLEE_SHOUTS = ['Enough!', 'I\'m out of here!', 'Retreat!', 'Tch... too strong!', 'I won\'t die here!'];
        spawnFloatingText(pos.x, pos.y, FLEE_SHOUTS[Math.floor(Math.random() * FLEE_SHOUTS.length)], '#ffaa44', 2.0);
      }
      // Update HP tracking
      const health = world.healths.get(id);
      if (health) aggro.lastKnownHp = health.current;
      break;
    }

    case 'fleeing': {
      // Check if far enough away or out of sight to disengage
      if (dist > FLEE_SAFE_DISTANCE || !hasLineOfSight(world, pos.x, pos.y, playerPos.x, playerPos.y)) {
        aggro.state = 'returning';
        aggro.targetId = null;
        ai.behavior = 'return_to_anchor';
      }
      const health = world.healths.get(id);
      if (health) aggro.lastKnownHp = health.current;
      break;
    }

    case 'returning': {
      // tickReturnToAnchor sets behavior to 'wander' when the NPC arrives.
      // Detect that transition and reset aggro state.
      if (ai.behavior === 'wander') {
        aggro.state = 'idle';
        aggro.targetId = null;
        aggro.lastKnownHp = undefined;
      }
      break;
    }
  }
}

/** Chase behavior: step toward the player each tick, engage when adjacent */
function tickChase(
  world: World,
  id: EntityId,
  pos: { x: number; y: number },
): void {
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return;

  const dist = chebyshev(pos.x, pos.y, playerPos.x, playerPos.y);

  // Adjacent to player — initiate real combat engagement
  if (dist <= 1) {
    const npcName = world.names.get(id)?.display ?? 'An enemy';
    const isNew = initiateNpcEngagement(world, id, world.playerEntityId);
    if (isNew) {
      world.log(`${npcName} engages you in combat!`, 'hit_incoming');
      const ENGAGE_SHOUTS = ['You\'re mine!', 'Fight me!', 'Prepare yourself!', 'Here I come!', 'Don\'t move!'];
      spawnFloatingText(pos.x, pos.y, ENGAGE_SHOUTS[Math.floor(Math.random() * ENGAGE_SHOUTS.length)], '#ff6644', 1.8);
    }
    return;
  }

  // Step toward player (greedy cardinal)
  const { dx, dy } = pickDirectionToward(pos, playerPos.x, playerPos.y);
  tryStepToward(world, id, pos, dx, dy);
}

/** Flee behavior: step away from the player each tick */
function tickFlee(
  world: World,
  id: EntityId,
  pos: { x: number; y: number },
): void {
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return;

  const { dx, dy } = pickDirectionAway(pos, playerPos.x, playerPos.y);
  tryStepToward(world, id, pos, dx, dy);
}
