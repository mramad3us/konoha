/**
 * Squad AI — controls allied squad members on mission maps.
 *
 * Behaviors:
 * - Follow: Stay within 2 tiles of the player (formation)
 * - Engage: Attack nearest enemy (aggressive ROE) or defend if attacked (defensive ROE)
 * - Always defend themselves when engaged regardless of ROE
 * - Same kill intent and stance as the player (team leader)
 *
 * Called from npcMovementSystem when the entity has a SquadMemberTag.
 */

import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import type { SquadROE } from '../types/squad.ts';
import { initiateNpcEngagement, isInCombat } from './combatSystem.ts';
import { spawnFloatingText } from '../systems/floatingTextSystem.ts';
import { SQUAD_COMBAT_LINES } from './squadSystem.ts';
import { hasTechnique } from '../data/techniques.ts';
import { WATER_WALK_CHAKRA_COST } from '../core/constants.ts';

/** Tag component — marks an entity as a squad member on the mission map */
export interface SquadMemberTag {
  /** Persistent roster member ID (for injury/death tracking back to roster) */
  rosterId: string;
  /** Personality for speech bubbles */
  personality: import('../types/squad.ts').SquadPersonality;
}

/** Chebyshev distance */
function chebyshev(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

/** Find the nearest enemy entity (has aggro component, not dead/unconscious/squad) */
function findNearestEnemy(world: World, fromX: number, fromY: number, maxRange: number): EntityId | null {
  let bestId: EntityId | null = null;
  let bestDist = maxRange + 1;

  for (const [id] of world.aggros) {
    if (world.squadMembers.has(id)) continue; // Skip allies
    if (id === world.playerEntityId) continue;
    if (world.unconscious.has(id) || world.dead.has(id)) continue;

    const pos = world.positions.get(id);
    if (!pos) continue;

    const dist = chebyshev(fromX, fromY, pos.x, pos.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }

  return bestId;
}

/** Step toward a target position (greedy single step) */
function stepToward(
  world: World,
  entityId: EntityId,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);

  // Try primary direction
  const candidates = [
    { x: fromX + dx, y: fromY + dy },
    { x: fromX + dx, y: fromY },
    { x: fromX, y: fromY + dy },
  ].filter(c => c.x !== fromX || c.y !== fromY);

  for (const c of candidates) {
    if (c.x < 0 || c.y < 0 || c.x >= world.tileMap.width || c.y >= world.tileMap.height) continue;
    // Allow walkable tiles and water (swim or water-walk)
    if (!world.tileMap.isWalkable(c.x, c.y) && !world.tileMap.isWater(c.x, c.y)) continue;
    if (world.isBlockedByEntity(c.x, c.y)) continue;

    const pos = world.positions.get(entityId);
    if (!pos) return false;

    // Update facing
    let facing = pos.facing;
    if (dx > 0 && dy === 0) facing = 'e';
    else if (dx < 0 && dy === 0) facing = 'w';
    else if (dy > 0 && dx === 0) facing = 's';
    else if (dy < 0 && dx === 0) facing = 'n';
    else if (dx > 0 && dy > 0) facing = 'se';
    else if (dx > 0 && dy < 0) facing = 'ne';
    else if (dx < 0 && dy > 0) facing = 'sw';
    else if (dx < 0 && dy < 0) facing = 'nw';

    const cardinalFacing = facing.length > 1 ? facing[1] as 'n' | 's' | 'e' | 'w' : facing as 'n' | 's' | 'e' | 'w';

    world.moveInGrid(entityId, fromX, fromY, c.x, c.y);
    world.positions.set(entityId, { x: c.x, y: c.y, facing: cardinalFacing });

    // Water-walk chakra cost (if they have the technique and chakra)
    if (world.tileMap.isWater(c.x, c.y)) {
      const sheet = world.characterSheets.get(entityId);
      const resources = world.resources.get(entityId);
      if (sheet && resources && hasTechnique(sheet.skills.ninjutsu, 'water_walk') && resources.chakra >= WATER_WALK_CHAKRA_COST) {
        resources.chakra = Math.max(0, resources.chakra - WATER_WALK_CHAKRA_COST);
        resources.lastChakraExertionTick = world.currentTick;
      }
      // Otherwise they swim — no chakra cost, just allowed through
    }

    // Update sprite
    const anchor = world.anchors.get(entityId);
    if (anchor) {
      const renderable = world.renderables.get(entityId);
      if (renderable) {
        renderable.spriteId = `${anchor.spritePrefix}_${cardinalFacing}`;
      }
    }

    return true;
  }

  return false;
}

/** Main squad AI tick — called once per turn for each squad member entity */
export function tickSquadMember(
  world: World,
  entityId: EntityId,
  roe: SquadROE,
): void {
  const pos = world.positions.get(entityId);
  if (!pos) return;
  if (world.unconscious.has(entityId) || world.dead.has(entityId)) return;

  // If already in combat, don't move (combat system handles attacks)
  if (isInCombat(entityId)) return;

  // Swimming penalty: 24s/step same as player (NPCs tick every 3s, so move once per 8 ticks)
  if (world.tileMap.isWater(pos.x, pos.y)) {
    const sheet = world.characterSheets.get(entityId);
    const resources = world.resources.get(entityId);
    const canWalk = sheet && resources
      && hasTechnique(sheet.skills.ninjutsu, 'water_walk')
      && resources.chakra >= WATER_WALK_CHAKRA_COST;
    if (!canWalk && world.currentTick % 8 !== 0) return;
  }

  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return;

  const distToPlayer = chebyshev(pos.x, pos.y, playerPos.x, playerPos.y);

  // ── Aggressive ROE: seek and engage enemies within 8 tiles ──
  if (roe === 'aggressive') {
    const nearestEnemy = findNearestEnemy(world, pos.x, pos.y, 8);
    if (nearestEnemy) {
      const enemyPos = world.positions.get(nearestEnemy);
      if (enemyPos) {
        const distToEnemy = chebyshev(pos.x, pos.y, enemyPos.x, enemyPos.y);

        // Adjacent — engage
        if (distToEnemy <= 1) {
          const isNew = initiateNpcEngagement(world, entityId, nearestEnemy);
          if (isNew) {
            const name = world.names.get(entityId)?.display ?? 'Your ally';
            const enemyName = world.names.get(nearestEnemy)?.display ?? 'an enemy';
            world.log(`${name} engages ${enemyName}!`, 'info');
            const tag = world.squadMembers.get(entityId);
            if (tag) {
              const lines = SQUAD_COMBAT_LINES[tag.personality].engage;
              spawnFloatingText(pos.x, pos.y, lines[Math.floor(Math.random() * lines.length)], '#66aaff');
            }
          }
          return;
        }

        // Close enough — chase (but don't stray too far from player)
        if (distToPlayer < 12) {
          stepToward(world, entityId, pos.x, pos.y, enemyPos.x, enemyPos.y);
          return;
        }
      }
    }
  }

  // ── Defensive ROE: only engage enemies that are adjacent (self-defense) ──
  if (roe === 'defensive') {
    // Check for adjacent enemies
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const entities = world.getEntitiesAt(pos.x + dx, pos.y + dy);
        for (const eid of entities) {
          if (world.squadMembers.has(eid)) continue;
          if (eid === world.playerEntityId) continue;
          if (world.unconscious.has(eid) || world.dead.has(eid)) continue;
          if (!world.aggros.has(eid)) continue;

          // Enemy is adjacent — defend!
          const aggro = world.aggros.get(eid);
          if (aggro && (aggro.state === 'aggro' || aggro.state === 'fleeing')) {
            const isNew = initiateNpcEngagement(world, entityId, eid);
            if (isNew) {
              const name = world.names.get(entityId)?.display ?? 'Your ally';
              const enemyName = world.names.get(eid)?.display ?? 'an enemy';
              world.log(`${name} defends against ${enemyName}!`, 'info');
              const tag = world.squadMembers.get(entityId);
              if (tag) {
                const lines = SQUAD_COMBAT_LINES[tag.personality].defend;
                spawnFloatingText(pos.x, pos.y, lines[Math.floor(Math.random() * lines.length)], '#66aaff');
              }
            }
            return;
          }
        }
      }
    }
  }

  // ── Follow player (formation) — maintain spread formation ──
  // Each squad member targets a formation offset from the player, not the player directly.
  // This prevents single-file following.
  if (distToPlayer > 3) {
    // Too far — just step toward the player (catch up mode)
    stepToward(world, entityId, pos.x, pos.y, playerPos.x, playerPos.y);
  } else if (distToPlayer > 1) {
    // In range — move toward formation position
    const formationPos = getFormationTarget(world, entityId, playerPos);
    if (formationPos) {
      const formDist = chebyshev(pos.x, pos.y, formationPos.x, formationPos.y);
      if (formDist > 0) {
        stepToward(world, entityId, pos.x, pos.y, formationPos.x, formationPos.y);
      }
    }
  }
  // If within 1 tile, hold position
}

/** Get a formation target offset from the player for this squad member */
function getFormationTarget(
  world: World,
  entityId: EntityId,
  playerPos: { x: number; y: number },
): { x: number; y: number } | null {
  // Assign each squad member a unique formation slot
  const squadIds = [...world.squadMembers.keys()];
  const myIndex = squadIds.indexOf(entityId);
  if (myIndex < 0) return null;

  // Formation: fan out behind and to the sides of the player
  // Offsets relative to player: spread laterally with slight rear offset
  const FORMATION_OFFSETS = [
    { dx: -2, dy: 1 },   // left-back
    { dx: 2, dy: 1 },    // right-back
    { dx: -1, dy: 2 },   // far left-back
    { dx: 1, dy: 2 },    // far right-back
  ];

  const offset = FORMATION_OFFSETS[myIndex % FORMATION_OFFSETS.length];
  const tx = playerPos.x + offset.dx;
  const ty = playerPos.y + offset.dy;

  // If target is valid, use it; otherwise just stay near player
  if (tx >= 0 && ty >= 0 && tx < world.tileMap.width && ty < world.tileMap.height) {
    return { x: tx, y: ty };
  }
  return { x: playerPos.x, y: playerPos.y };
}

/**
 * When enemies aggro, make them pick the closest party member (player or squad)
 * instead of always targeting the player.
 */
export function findClosestPartyMember(
  world: World,
  fromX: number,
  fromY: number,
): EntityId {
  let bestId = world.playerEntityId;
  let bestDist = Infinity;

  // Check player
  const playerPos = world.positions.get(world.playerEntityId);
  if (playerPos) {
    bestDist = chebyshev(fromX, fromY, playerPos.x, playerPos.y);
  }

  // Check squad members
  for (const [id] of world.squadMembers) {
    if (world.unconscious.has(id) || world.dead.has(id)) continue;
    const pos = world.positions.get(id);
    if (!pos) continue;
    const dist = chebyshev(fromX, fromY, pos.x, pos.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }

  return bestId;
}
