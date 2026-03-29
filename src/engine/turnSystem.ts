import type { GameAction } from '../types/actions.ts';
import type { Direction } from '../types/ecs.ts';
import type { World } from './world.ts';
import { computeFOV } from './fov.ts';

import { FOV_RADIUS, STANCE_TICK_COST, STANCE_STAMINA_COST, TICK_DURATION_SECONDS, STAMINA_RESTORE_RATE, STAMINA_REST_TICKS } from '../core/constants.ts';
import { getNightFovReduction } from './gameTime.ts';
import { tickUnconsciousRecovery, tickBleeding } from './entityState.ts';
import { tickProximityDialogue } from './proximityDialogue.ts';
import { sfxStep } from '../systems/audioSystem.ts';
import { checkPatrolProgress } from './missions.ts';
import { tickNpcMovement } from './npcMovementSystem.ts';
import { tickDuskTransition, tickDawnTransition } from './npcLifecycleSystem.ts';
import { getActiveEngagements, clearStaleEngagements } from './combatSystem.ts';
import { calculateDamage } from '../types/combat.ts';
import { DISENGAGE_STAMINA_COST, DISENGAGE_CHAKRA_COST, PASS_DURATION_SECONDS } from '../core/constants.ts';
import type { EntityId } from '../types/ecs.ts';

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
  // Check auto-recovery for unconscious entities + tick bleeding + NPC dialogue
  tickUnconsciousRecovery(world);
  tickBleeding(world);
  tickProximityDialogue(world);
  // NPC movement (wandering, despawn walk-off, return-to-anchor)
  tickNpcMovement(world);
  // Day/night lifecycle transitions
  tickDuskTransition(world);
  tickDawnTransition(world);
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

      // ── Check combat disengagement ──
      const engagedTarget = findEngagedTarget(world, playerId);
      if (engagedTarget !== null) {
        const res = world.resources.get(playerId);
        if (!res || res.stamina < DISENGAGE_STAMINA_COST) {
          world.log('Too exhausted to disengage — you can\'t pull away.', 'info');
          advanceTurn(world, 1, PASS_DURATION_SECONDS);
          return true;
        }

        // Check terrain
        if (!world.tileMap.isWalkable(newX, newY) || (world.isBlockedByEntity(newX, newY))) {
          world.log('No room to disengage in that direction.', 'info');
          return false;
        }

        // Pay costs
        res.stamina = Math.max(0, res.stamina - DISENGAGE_STAMINA_COST);
        res.chakra = Math.max(0, res.chakra - DISENGAGE_CHAKRA_COST);
        res.lastExertionTick = world.currentTick;

        // Check if player has tempo to dodge the opportunity attack
        const engagements = getActiveEngagements();
        const key = playerId < engagedTarget ? `${playerId}:${engagedTarget}` : `${engagedTarget}:${playerId}`;
        const eng = engagements.get(key);
        const playerTempo = eng ? (eng.entityA === playerId ? eng.tempoA : eng.tempoB) : null;
        const targetName = world.names.get(engagedTarget)?.display ?? 'your opponent';

        if (playerTempo && playerTempo.current > 0) {
          // Spend tempo to dodge cleanly
          playerTempo.current--;
          world.log(`You use your momentum to slip past ${targetName}'s guard and disengage!`, 'combat_tempo');
        } else {
          // Take a free hit
          const targetSheet = world.characterSheets.get(engagedTarget);
          const targetTaijutsu = targetSheet?.skills.taijutsu ?? 10;
          const targetPhy = targetSheet?.stats.phy ?? 10;
          const damage = calculateDamage(targetTaijutsu, targetPhy);
          const health = world.healths.get(playerId);
          if (health) health.current = Math.max(0, health.current - damage);

          const DISENGAGE_HIT_FLAVORS = [
            `${targetName} strikes as you pull away — you take the hit but create distance.`,
            `A blow catches you mid-retreat. ${targetName}'s fist connects, but you manage to break free.`,
            `You feel ${targetName}'s strike land as you leap back. Painful, but you're free.`,
            `${targetName} doesn't let you go cleanly — a parting blow rocks you as you disengage.`,
            `The price of retreat: ${targetName} lands a solid hit as you pull away.`,
          ];
          world.log(DISENGAGE_HIT_FLAVORS[Math.floor(Math.random() * DISENGAGE_HIT_FLAVORS.length)], 'hit_incoming');
        }

        // Move
        world.moveInGrid(playerId, playerPos.x, playerPos.y, newX, newY);
        playerPos.x = newX;
        playerPos.y = newY;
        sfxStep();

        // Break engagement
        clearStaleEngagements(world);

        advanceTurn(world, 1, PASS_DURATION_SECONDS);
        return true;
      }

      // ── Normal movement (no combat) ──
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
        world.moveInGrid(playerId, playerPos.x, playerPos.y, newX, newY);
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

      // Check patrol mission waypoints after move
      const patrolMsg = checkPatrolProgress(world.missionLog, playerPos.x, playerPos.y);
      if (patrolMsg) world.log(patrolMsg, 'system');

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
      // Collect ALL interactable adjacent entities
      const candidates: number[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const entities = world.getEntitiesAt(playerPos.x + dx, playerPos.y + dy);
          for (const eid of entities) {
            if (eid === playerId) continue;
            const isDoor = world.doors.has(eid);
            const hasObjectSheet = world.objectSheets.has(eid);
            const hasCharSheet = world.characterSheets.has(eid);
            const hasSpecialInteract = world.interactables.has(eid);
            if (isDoor || hasObjectSheet || hasCharSheet || hasSpecialInteract) {
              candidates.push(eid);
            }
          }
        }
      }

      if (candidates.length === 0) {
        world.log('Nothing to interact with nearby.', 'info');
        return false;
      }

      // Multiple candidates — show target selector first
      if (candidates.length > 1) {
        world._pendingInteraction = { entityId: candidates[0], type: 'target_select', candidates };
        return false;
      }

      // Single candidate — interact directly
      return interactWithEntity(world, candidates[0], playerId);
    }
  }
}

/**
 * Interact with a specific entity. Handles doors, simple examine, and complex context menus.
 * Exported so the target selector can call this after the player picks a target.
 */
export function interactWithEntity(world: World, eid: number, _playerId?: number): boolean {
  // Doors toggle immediately (but check for locks)
  const door = world.doors.get(eid);
  if (door) {
    if (door.isLocked) {
      world.log('The door is locked.', 'info');
      return false;
    }
    door.isOpen = !door.isOpen;
    const renderable = world.renderables.get(eid);
    const blocking = world.blockings.get(eid);
    if (renderable) renderable.spriteId = door.isOpen ? 'obj_door_open' : 'obj_door_closed';
    if (blocking) {
      blocking.blocksMovement = !door.isOpen;
      blocking.blocksSight = !door.isOpen;
    }
    const interactable = world.interactables.get(eid);
    if (interactable) interactable.label = door.isOpen ? 'Close' : 'Open';
    world.log(door.isOpen ? 'You open the door.' : 'You close the door.', 'info');
    advanceTurn(world, 1, 2);
    return true;
  }

  // Examine-only objects: skip menu, log description directly
  const hasObjectSheet = world.objectSheets.has(eid);
  const hasCharSheet = world.characterSheets.has(eid);
  const hasSpecialInteract = world.interactables.has(eid);
  const isNpc = hasCharSheet;

  if (hasObjectSheet && !isNpc && !hasSpecialInteract) {
    const sheet = world.objectSheets.get(eid)!;
    const name = world.names.get(eid)?.display ?? 'something';
    world.log(`${name}: ${sheet.description}`, 'info');
    return false;
  }

  if (hasObjectSheet || hasCharSheet || hasSpecialInteract) {
    world._pendingInteraction = { entityId: eid, type: 'context_menu' };
    return false;
  }

  return false;
}

/** Check if the player is currently in an active combat engagement. Returns target ID or null. */
function findEngagedTarget(_world: World, playerId: EntityId): EntityId | null {
  const engagements = getActiveEngagements();
  for (const [, eng] of engagements) {
    if (eng.entityA === playerId) return eng.entityB;
    if (eng.entityB === playerId) return eng.entityA;
  }
  return null;
}
