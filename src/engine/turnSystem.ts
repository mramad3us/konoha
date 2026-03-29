import type { GameAction } from '../types/actions.ts';
import type { Direction } from '../types/ecs.ts';
import type { World } from './world.ts';
import { computeFOV } from './fov.ts';

import { FOV_RADIUS, STANCE_TICK_COST, STANCE_STAMINA_COST, TICK_DURATION_SECONDS, STAMINA_RESTORE_RATE, STAMINA_REST_TICKS } from '../core/constants.ts';
import { getNightFovReduction } from './gameTime.ts';
import { sfxStep } from '../systems/audioSystem.ts';

/** Advance game time and recompute FOV with night reduction */
function advanceTurn(world: World, ticks: number, gameSeconds: number): void {
  world.currentTick += ticks;
  world.gameTimeSeconds += gameSeconds;
  const playerPos = world.positions.get(world.playerEntityId);
  if (playerPos) {
    const nightReduction = getNightFovReduction(world.gameTimeSeconds);
    const effectiveFov = Math.max(3, FOV_RADIUS - nightReduction);
    computeFOV(world, playerPos.x, playerPos.y, effectiveFov);
  }
}

/** Stance to game seconds per step */
const STANCE_SECONDS: Record<string, number> = {
  sprint: 3,
  walk: 6,
  creep: 9,
  crawl: 12,
};

/** Map dx,dy to a facing direction */
function vectorToDirection(dx: number, dy: number): Direction {
  if (dx === 0 && dy === -1) return 'n';
  if (dx === 0 && dy === 1) return 's';
  if (dx === 1 && dy === 0) return 'e';
  if (dx === -1 && dy === 0) return 'w';
  if (dx === 1 && dy === -1) return 'ne';
  if (dx === -1 && dy === -1) return 'nw';
  if (dx === 1 && dy === 1) return 'se';
  if (dx === -1 && dy === 1) return 'sw';
  return 's';
}

/** Map direction to the nearest cardinal for sprite selection */
function directionToCardinal(dir: Direction): 'n' | 's' | 'e' | 'w' {
  switch (dir) {
    case 'n': case 'nw': case 'ne': return 'n';
    case 's': case 'sw': case 'se': return 's';
    case 'e': return 'e';
    case 'w': return 'w';
  }
}

/**
 * Execute a game action, advancing the world state.
 * Returns true if the action consumed a turn (ticks advanced).
 */
export function executeTurn(action: GameAction, world: World): boolean {
  const playerId = world.playerEntityId;
  const playerPos = world.positions.get(playerId);
  const playerCtrl = world.playerControlled.get(playerId);

  if (!playerPos || !playerCtrl) return false;

  switch (action.type) {
    case 'move': {
      const newX = playerPos.x + action.dx;
      const newY = playerPos.y + action.dy;
      const facing = vectorToDirection(action.dx, action.dy);

      // Update facing regardless
      playerPos.facing = facing;

      // Update sprite to match facing
      const renderable = world.renderables.get(playerId);
      if (renderable) {
        const gender = renderable.spriteId.includes('kunoichi') ? 'kunoichi' : 'shinobi';
        renderable.spriteId = `char_${gender}_${directionToCardinal(facing)}`;
      }

      // Check for blocking entity — no bump-to-attack, use combat keys instead
      const blockingEntity = world.getBlockingEntityAt(newX, newY);
      if (blockingEntity !== null && blockingEntity !== playerId) {
        const name = world.names.get(blockingEntity);
        const desc = name ? `${name.article ? name.article + ' ' : ''}${name.display}` : 'something';
        const isCombatTarget = world.combatStats.has(blockingEntity) || world.healths.has(blockingEntity);
        if (isCombatTarget) {
          world.log(`You face ${desc}. Use attack keys (a/z/e) to engage.`, 'info');
        } else {
          world.log(`Blocked by ${desc}.`, 'info');
        }
      } else if (!world.tileMap.isWalkable(newX, newY)) {
        // Terrain blocks
        world.log('The way is blocked.', 'info');
      } else {
        // Move!
        playerPos.x = newX;
        playerPos.y = newY;
        sfxStep();

        // Stamina cost for sprinting
        const staminaCost = STANCE_STAMINA_COST[playerCtrl.movementStance];
        if (staminaCost > 0) {
          const resources = world.resources.get(playerId);
          if (resources) {
            if (resources.stamina < staminaCost) {
              world.log('Too exhausted to sprint. Switching to walk.', 'system');
              playerCtrl.movementStance = 'walk';
            } else {
              resources.stamina = Math.max(0, resources.stamina - staminaCost);
            }
          }
        }

        // Stamina regeneration when not sprinting and resting long enough
        if (playerCtrl.movementStance !== 'sprint') {
          const resources = world.resources.get(playerId);
          if (resources) {
            const ticksSinceExertion = world.currentTick - resources.lastExertionTick;
            if (ticksSinceExertion >= STAMINA_REST_TICKS && resources.stamina < resources.staminaCeiling) {
              const regenAmount = resources.maxStamina * STAMINA_RESTORE_RATE;
              resources.stamina = Math.min(resources.staminaCeiling, resources.stamina + regenAmount);
            }
          }
        } else {
          // Sprint marks exertion
          const resources = world.resources.get(playerId);
          if (resources) {
            resources.lastExertionTick = world.currentTick;
          }
        }
      }

      // Advance time
      const tickCost = STANCE_TICK_COST[playerCtrl.movementStance];
      advanceTurn(world, tickCost, STANCE_SECONDS[playerCtrl.movementStance] ?? TICK_DURATION_SECONDS);

      return true;
    }

    case 'wait': {
      world.log('You wait and observe your surroundings.', 'info');

      // Stamina regen on wait (not exerting)
      const resources = world.resources.get(playerId);
      if (resources) {
        const ticksSinceExertion = world.currentTick - resources.lastExertionTick;
        if (ticksSinceExertion >= STAMINA_REST_TICKS && resources.stamina < resources.staminaCeiling) {
          const regenAmount = resources.maxStamina * STAMINA_RESTORE_RATE;
          resources.stamina = Math.min(resources.staminaCeiling, resources.stamina + regenAmount);
        }
      }

      advanceTurn(world, STANCE_TICK_COST[playerCtrl.movementStance], STANCE_SECONDS[playerCtrl.movementStance] ?? TICK_DURATION_SECONDS);
      return true;
    }

    case 'cycleStance': {
      const cycle: Array<import('../types/ecs.ts').MovementStance> = ['walk', 'sprint', 'creep', 'crawl'];
      const stanceNames: Record<string, string> = {
        sprint: 'Sprint', walk: 'Walk', creep: 'Creep', crawl: 'Crawl',
      };
      const idx = cycle.indexOf(playerCtrl.movementStance);
      const next = cycle[(idx + 1) % cycle.length];
      playerCtrl.movementStance = next;
      world.log(`Stance: ${stanceNames[next]}.`, 'system');
      return false;
    }

    case 'toggleKeybindings':
    case 'toggleCharacterSheet': {
      return false; // Handled by UI, not turn system
    }

    case 'interact': {
      // Find adjacent interactable
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const entities = world.getEntitiesAt(playerPos.x + dx, playerPos.y + dy);
          for (const eid of entities) {
            const interactable = world.interactables.get(eid);
            if (interactable) {
              const name = world.names.get(eid)?.display ?? 'something';
              // Dispatch by type — return value handled by caller
              world.log(`You interact with ${name}.`, 'info');
              // Store pending interaction for the game screen to handle
              world._pendingInteraction = { entityId: eid, type: interactable.interactionType };
              advanceTurn(world, 1, 2);
              return true;
            }
          }
        }
      }
      world.log('Nothing to interact with nearby.', 'info');
      return false;
    }
  }
}
