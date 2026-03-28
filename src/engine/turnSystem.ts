import type { GameAction } from '../types/actions.ts';
import type { Direction } from '../types/ecs.ts';
import type { World } from './world.ts';
import { computeFOV } from './fov.ts';

import { FOV_RADIUS, STANCE_TICK_COST, STANCE_STAMINA_COST } from '../core/constants.ts';

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
        const hasHealth = world.healths.has(blockingEntity);
        if (hasHealth) {
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

        // Stamina regeneration when walking/creeping/crawling
        if (playerCtrl.movementStance !== 'sprint') {
          const resources = world.resources.get(playerId);
          if (resources && resources.stamina < resources.maxStamina) {
            resources.stamina = Math.min(resources.maxStamina, resources.stamina + 0.5);
          }
        }
      }

      // Advance ticks
      const tickCost = STANCE_TICK_COST[playerCtrl.movementStance];
      world.currentTick += tickCost;

      // Recompute FOV
      computeFOV(world, playerPos.x, playerPos.y, FOV_RADIUS);

      return true;
    }

    case 'wait': {
      world.log('You wait and observe your surroundings.', 'info');
      world.currentTick += STANCE_TICK_COST[playerCtrl.movementStance];

      // Small stamina regen on wait
      const resources = world.resources.get(playerId);
      if (resources && resources.stamina < resources.maxStamina) {
        resources.stamina = Math.min(resources.maxStamina, resources.stamina + 1);
      }

      computeFOV(world, playerPos.x, playerPos.y, FOV_RADIUS);
      return true;
    }

    case 'changeStance': {
      if (playerCtrl.movementStance === action.stance) return false;

      playerCtrl.movementStance = action.stance;
      const stanceNames = {
        sprint: 'Sprint',
        walk: 'Walk',
        creep: 'Creep',
        crawl: 'Crawl',
      };
      world.log(`Stance: ${stanceNames[action.stance]}.`, 'system');
      return false; // Stance change doesn't consume a turn
    }

    case 'toggleKeybindings':
    case 'toggleCharacterSheet': {
      return false; // Handled by UI, not turn system
    }
  }
}
