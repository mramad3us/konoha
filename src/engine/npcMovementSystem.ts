/**
 * NPC Movement System — handles idle wandering, despawning walk-off, and return-to-anchor.
 *
 * Runs once per advanceTurn() call. Each NPC with 'wander' behavior takes a random
 * step every few ticks, staying within their anchor radius. NPCs in 'despawning'
 * state walk away from the player until out of sight, then are destroyed.
 * NPCs in 'return_to_anchor' state step toward their anchor point.
 */

import type { World } from './world.ts';
import type { Direction, EntityId } from '../types/ecs.ts';

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

/** Tick idle wandering for all wandering NPCs */
export function tickNpcMovement(world: World): void {
  for (const [id, ai] of world.aiControlled) {
    if (id === world.playerEntityId) continue;

    const anchor = world.anchors.get(id);
    if (!anchor) continue;
    const pos = world.positions.get(id);
    if (!pos) continue;

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
