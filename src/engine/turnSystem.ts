import type { GameAction } from '../types/actions.ts';
import type { Direction } from '../types/ecs.ts';
import type { World } from './world.ts';
import { computeFOV } from './fov.ts';

import { FOV_RADIUS, STANCE_SUBTICK_COST, STANCE_STAMINA_COST, TICK_DURATION_SECONDS, STAMINA_RESTORE_RATE, STAMINA_REST_TICKS, CHAKRA_RESTORE_RATE, CHAKRA_REST_TICKS, CHAKRA_FATIGUE_DRAIN, CHAKRA_FATIGUE_FLOOR, CHAKRA_SPRINT_COST, WATER_WALK_CHAKRA_COST, DISENGAGE_STAMINA_COST, DISENGAGE_CHAKRA_COST, PASS_DURATION_SECONDS, SUBTICKS_PER_TICK, COMBAT_PASS_SUBTICKS, SUBTICK_DURATION } from '../core/constants.ts';
import { getNightFovReduction } from './gameTime.ts';
import { hasTechnique, getChakraSprintSpeed, getChakraSprintTier } from '../data/techniques.ts';
import { tickUnconsciousRecovery, tickBleeding, checkEntityState } from './entityState.ts';
import { tickProximityDialogue } from './proximityDialogue.ts';
import { sfxStep } from '../systems/audioSystem.ts';
import { checkPatrolProgress, getMissionXpMultiplier } from './missions.ts';
import { tickNpcMovement } from './npcMovementSystem.ts';
import { tickDuskTransition, tickDawnTransition } from './npcLifecycleSystem.ts';
import { getActiveEngagements, clearStaleEngagements, resolveNpcCombatRounds } from './combatSystem.ts';
import { computeImprovement, STAT_IMPROVEMENT_RATES } from '../types/character.ts';
import { checkSkillUp } from './skillFeedback.ts';
import { calculateDamage } from '../types/combat.ts';
import type { EntityId } from '../types/ecs.ts';
import { updateCarriedPosition } from './restraintCarry.ts';
import { tickProjectiles, cleanupBloodDecals } from '../systems/projectileSystem.ts';

/**
 * Advance game time by subticks and recompute FOV.
 * Slow systems (NPC movement, dialogue, day/night) only fire when a
 * coarse tick boundary (6 subticks = 3s) is crossed.
 * Fast actions (combat, chakra sprint) don't cross boundaries → world stays frozen.
 */
function advanceTurn(world: World, subticks: number, gameSeconds: number, skipCombatStrikes = false): void {
  const oldTick = world.currentTick;
  const startSubtick = world.currentSubtick;
  world.gameTimeSeconds += gameSeconds;

  // ── Engaged NPC free strikes — if player spends time in combat without fighting ──
  // Number of combat passes elapsed = subticks / COMBAT_PASS_SUBTICKS
  // skipCombatStrikes is true for move (handles disengagement separately) and combat actions
  if (!skipCombatStrikes) {
    const playerId = world.playerEntityId;
    const engagedTarget = findEngagedTarget(world, playerId);
    if (engagedTarget !== null) {
      const passes = Math.floor(subticks / COMBAT_PASS_SUBTICKS);
      if (passes > 0) {
        const targetName = world.names.get(engagedTarget)?.display ?? 'your opponent';
        for (let i = 0; i < passes; i++) {
          const hp = world.healths.get(playerId);
          if (!hp || hp.current <= 0) break;
          applyFreeHit(world, engagedTarget, playerId, targetName);
          checkEntityState(world, playerId);
        }
      }
    }
  }

  // ── Projectiles advance every subtick (fast system) ──
  // Increment currentSubtick one at a time so speed-gating works correctly
  for (let s = 0; s < subticks; s++) {
    world.currentSubtick = startSubtick + s + 1;
    tickProjectiles(world);
  }
  world.currentSubtick = startSubtick + subticks;
  world.currentTick = Math.floor(world.currentSubtick / SUBTICKS_PER_TICK);

  // Always recompute FOV
  const playerPos = world.positions.get(world.playerEntityId);
  if (playerPos) {
    const nightReduction = getNightFovReduction(world.gameTimeSeconds);
    const effectiveFov = Math.max(3, FOV_RADIUS - nightReduction);
    computeFOV(world, playerPos.x, playerPos.y, effectiveFov);
  }

  // Slow systems — only when coarse ticks actually advance
  const ticksElapsed = world.currentTick - oldTick;
  for (let t = 0; t < ticksElapsed; t++) {
    tickUnconsciousRecovery(world);
    tickBleeding(world);
    tickProximityDialogue(world);
    tickNpcMovement(world);
    resolveNpcCombatRounds(world);
    tickDuskTransition(world);
    tickDawnTransition(world);
    cleanupBloodDecals(world);
  }
}

/**
 * Advance world by one combat pass (4 subticks / 2s).
 * Unlike a full turn, this always ticks world systems so NPC movement
 * and NPC-vs-NPC fights progress during player combat.
 * Called by inputSystem after processCombatMove resolves.
 */
export function advanceCombatPass(world: World): void {
  const oldTick = world.currentTick;
  const startSubtick = world.currentSubtick;
  world.gameTimeSeconds += PASS_DURATION_SECONDS;

  // Always recompute FOV
  const playerPos = world.positions.get(world.playerEntityId);
  if (playerPos) {
    const nightReduction = getNightFovReduction(world.gameTimeSeconds);
    const effectiveFov = Math.max(3, FOV_RADIUS - nightReduction);
    computeFOV(world, playerPos.x, playerPos.y, effectiveFov);
  }

  // Projectiles advance every subtick during combat too
  // Increment currentSubtick one at a time so speed-gating works correctly
  for (let s = 0; s < COMBAT_PASS_SUBTICKS; s++) {
    world.currentSubtick = startSubtick + s + 1;
    tickProjectiles(world);
  }
  world.currentSubtick = startSubtick + COMBAT_PASS_SUBTICKS;
  world.currentTick = Math.floor(world.currentSubtick / SUBTICKS_PER_TICK);

  // Always tick world systems during combat (not gated by coarse tick boundary)
  // This ensures NPCs move and NPC-vs-NPC fights progress while player fights
  tickBleeding(world);
  resolveNpcCombatRounds(world);

  // Coarse tick systems — NPC movement, dialogue, etc.
  const ticksElapsed = world.currentTick - oldTick;
  for (let t = 0; t < ticksElapsed; t++) {
    tickUnconsciousRecovery(world);
    tickProximityDialogue(world);
    tickNpcMovement(world);
    tickDuskTransition(world);
    tickDawnTransition(world);
    cleanupBloodDecals(world);
  }
}

/**
 * Advance world by exactly 1 subtick (0.5s).
 * Used for throwing — the throw action itself is fast; cooldown handles pacing.
 */
export function advanceThrowSubtick(world: World): void {
  const oldTick = world.currentTick;
  world.gameTimeSeconds += SUBTICK_DURATION;
  world.currentSubtick += 1;
  world.currentTick = Math.floor(world.currentSubtick / SUBTICKS_PER_TICK);

  tickProjectiles(world);

  // Recompute FOV
  const playerPos = world.positions.get(world.playerEntityId);
  if (playerPos) {
    const nightReduction = getNightFovReduction(world.gameTimeSeconds);
    const effectiveFov = Math.max(3, FOV_RADIUS - nightReduction);
    computeFOV(world, playerPos.x, playerPos.y, effectiveFov);
  }

  // Coarse tick systems if we crossed a tick boundary
  if (world.currentTick > oldTick) {
    tickBleeding(world);
    resolveNpcCombatRounds(world);
    tickUnconsciousRecovery(world);
    tickProximityDialogue(world);
    tickNpcMovement(world);
    tickDuskTransition(world);
    tickDawnTransition(world);
    cleanupBloodDecals(world);
  }
}

/** Stance to game seconds per step (chakra_sprint is dynamic, handled separately) */
const STANCE_SECONDS: Record<string, number> = {
  sprint: 3,
  walk: 6,
  creep: 9,
  crawl: 12,
  chakra_sprint: 2, // fallback; actual value computed from ninjutsu tier
};

/** Swimming speed (no water walk) — very slow */
const SWIM_SECONDS = 24;

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
        // Check terrain first
        if (!world.tileMap.isWalkable(newX, newY) || (world.isBlockedByEntity(newX, newY))) {
          world.log('No room to disengage in that direction.', 'info');
          return false;
        }

        // Destructibles (training dummies) don't fight back — free disengage
        if (world.destructibles.has(engagedTarget)) {
          world.moveInGrid(playerId, playerPos.x, playerPos.y, newX, newY);
          playerPos.x = newX;
          playerPos.y = newY;
          sfxStep();
          clearStaleEngagements(world);
          world.log('You step away from the training dummy.', 'info');
          advanceTurn(world, COMBAT_PASS_SUBTICKS, PASS_DURATION_SECONDS, true);
          return true;
        }

        // Real opponents: need stamina to disengage at all
        const res = world.resources.get(playerId);
        if (!res || res.stamina < DISENGAGE_STAMINA_COST) {
          world.log('Too exhausted to disengage — you can\'t pull away.', 'info');
          advanceTurn(world, COMBAT_PASS_SUBTICKS, PASS_DURATION_SECONDS, true);
          return true;
        }

        const targetName = world.names.get(engagedTarget)?.display ?? 'your opponent';
        const playerNin = world.characterSheets.get(playerId)?.skills.ninjutsu ?? 0;
        const canFastDisengage = playerNin >= 10 && res.chakra >= DISENGAGE_CHAKRA_COST;

        // Pay stamina (always required)
        res.stamina = Math.max(0, res.stamina - DISENGAGE_STAMINA_COST);
        res.lastExertionTick = world.currentTick;

        if (canFastDisengage) {
          // ── Fast disengage (1 pass = 2s) — pay chakra, check tempo for opportunity attack ──
          res.chakra = Math.max(0, res.chakra - DISENGAGE_CHAKRA_COST);
          res.chakraCeiling = Math.max(res.maxChakra * CHAKRA_FATIGUE_FLOOR, res.chakraCeiling - CHAKRA_FATIGUE_DRAIN);
          res.lastChakraExertionTick = world.currentTick;

          // Take 1 free hit (tempo is checked inside applyFreeHit — dodges if available)
          applyFreeHit(world, engagedTarget, playerId, targetName);

          // Check if player was KO'd by the opportunity attack
          checkEntityState(world, playerId);
          const hp = world.healths.get(playerId);
          if (hp && hp.current > 0) {
            world.moveInGrid(playerId, playerPos.x, playerPos.y, newX, newY);
            playerPos.x = newX;
            playerPos.y = newY;
            sfxStep();
            clearStaleEngagements(world);
          } else {
            world.log('You collapse before you can get away.', 'hit_incoming');
          }

          advanceTurn(world, COMBAT_PASS_SUBTICKS, PASS_DURATION_SECONDS, true);
        } else {
          // ── Slow disengage (low ninjutsu or no chakra) — stamina-only, 3 passes (6s), 3 free hits ──
          if (playerNin < 10) {
            world.log(`Without the skill to channel chakra, you scramble to pull away from ${targetName}...`, 'combat_neutral');
          } else {
            world.log(`Without chakra to boost your retreat, you scramble to pull away from ${targetName}...`, 'combat_neutral');
          }

          for (let i = 0; i < 3; i++) {
            applyFreeHit(world, engagedTarget, playerId, targetName);
            checkEntityState(world, playerId);
            const hp = world.healths.get(playerId);
            if (hp && hp.current <= 0) break;
          }

          // Move (if still conscious)
          const hp = world.healths.get(playerId);
          if (hp && hp.current > 0) {
            world.moveInGrid(playerId, playerPos.x, playerPos.y, newX, newY);
            playerPos.x = newX;
            playerPos.y = newY;
            sfxStep();
            clearStaleEngagements(world);
            world.log('You finally break free, battered but clear.', 'combat_neutral');
          } else {
            world.log('You collapse before you can get away.', 'hit_incoming');
          }

          // 3 passes = 3 × 4 subticks = 12 subticks (6s)
          advanceTurn(world, COMBAT_PASS_SUBTICKS * 3, PASS_DURATION_SECONDS * 3, true);
        }

        return true;
      }

      // ── Normal movement (no combat) ──
      // Check for blocking entity — skip invisible ones, no bump-to-attack
      const blockingEntity = world.getBlockingEntityAt(newX, newY);
      const isBlockedByVisible = blockingEntity !== null && blockingEntity !== playerId && !world.isInvisibleToPlayer(blockingEntity);
      if (isBlockedByVisible) {
        const name = world.names.get(blockingEntity!);
        const desc = name ? `${name.article ? name.article + ' ' : ''}${name.display}` : 'something';
        const isCombatTarget = world.combatStats.has(blockingEntity!) || world.healths.has(blockingEntity!);
        if (isCombatTarget) {
          world.log(`You face ${desc}. Use attack keys (a/z/e) to engage.`, 'info');
        } else {
          world.log(`Blocked by ${desc}.`, 'info');
        }
      } else if (!world.tileMap.isWalkable(newX, newY) && !world.tileMap.isWater(newX, newY)) {
        // Solid terrain blocks
        world.log('The way is blocked.', 'info');
      } else {
        // Move!
        world.moveInGrid(playerId, playerPos.x, playerPos.y, newX, newY);
        playerPos.x = newX;
        playerPos.y = newY;
        sfxStep();

        // ── Update carried entity position ──
        updateCarriedPosition(world, playerId);

        // ── Chakra sprint cost (3 chakra + 3 stamina per step) ──
        if (playerCtrl.movementStance === 'chakra_sprint') {
          const resources = world.resources.get(playerId);
          if (resources) {
            if (resources.stamina < CHAKRA_SPRINT_COST) {
              world.log('Too exhausted to maintain chakra sprint. Switching to walk.', 'system');
              playerCtrl.movementStance = 'walk';
            } else if (resources.chakra < CHAKRA_SPRINT_COST) {
              world.log('Not enough chakra to maintain chakra sprint. Switching to walk.', 'system');
              playerCtrl.movementStance = 'walk';
            } else {
              resources.chakra = Math.max(0, resources.chakra - CHAKRA_SPRINT_COST);
              resources.stamina = Math.max(0, resources.stamina - CHAKRA_SPRINT_COST);
              resources.lastExertionTick = world.currentTick;
              resources.lastChakraExertionTick = world.currentTick;
              resources.chakraCeiling = Math.max(resources.maxChakra * CHAKRA_FATIGUE_FLOOR, resources.chakraCeiling - CHAKRA_FATIGUE_DRAIN);
              // Chakra sprint trains both PHY and CHA
              const sheet = world.characterSheets.get(playerId);
              if (sheet) {
                const mxp = getMissionXpMultiplier(world.missionLog);
                const oldPhy = sheet.stats.phy;
                const oldCha = sheet.stats.cha;
                sheet.stats.phy = computeImprovement(oldPhy, STAT_IMPROVEMENT_RATES.phy_combat, 2.0, mxp);
                sheet.stats.cha = computeImprovement(oldCha, STAT_IMPROVEMENT_RATES.cha_ninjutsu_use, 2.0, mxp);
                checkSkillUp(world, 'phy', oldPhy, sheet.stats.phy);
                checkSkillUp(world, 'cha', oldCha, sheet.stats.cha);
              }
            }
          }
        }

        // ── Water walk chakra cost (only if actually water-walking, not swimming) ──
        if (world.tileMap.isWater(newX, newY) && canWaterWalk(world, playerId, newX, newY)) {
          const resources = world.resources.get(playerId);
          if (resources) {
            resources.chakra = Math.max(0, resources.chakra - WATER_WALK_CHAKRA_COST);
            resources.chakraCeiling = Math.max(resources.maxChakra * CHAKRA_FATIGUE_FLOOR, resources.chakraCeiling - CHAKRA_FATIGUE_DRAIN);
            resources.lastChakraExertionTick = world.currentTick;
            // Water walking trains CHA
            const wwSheet = world.characterSheets.get(playerId);
            if (wwSheet) {
              const mxp = getMissionXpMultiplier(world.missionLog);
              const oldCha = wwSheet.stats.cha;
              wwSheet.stats.cha = computeImprovement(oldCha, STAT_IMPROVEMENT_RATES.cha_ninjutsu_use, 2.0, mxp);
              checkSkillUp(world, 'cha', oldCha, wwSheet.stats.cha);
            }
            if (resources.chakra <= 0) {
              world.log('Your chakra falters — you can barely keep your footing on the water!', 'system');
            }
          }
        }

        // ── Stamina cost for regular sprint (chakra sprint handles its own above) ──
        const staminaCost = playerCtrl.movementStance === 'chakra_sprint' ? 0 : (STANCE_STAMINA_COST[playerCtrl.movementStance] ?? 0);
        if (staminaCost > 0) {
          const resources = world.resources.get(playerId);
          if (resources) {
            if (resources.stamina < staminaCost) {
              world.log('Too exhausted to sprint. Switching to walk.', 'system');
              playerCtrl.movementStance = 'walk';
            } else {
              resources.stamina = Math.max(0, resources.stamina - staminaCost);
              // Sprinting trains PHY
              const sprintSheet = world.characterSheets.get(playerId);
              if (sprintSheet) {
                const mxp = getMissionXpMultiplier(world.missionLog);
                const oldPhy = sprintSheet.stats.phy;
                sprintSheet.stats.phy = computeImprovement(oldPhy, STAT_IMPROVEMENT_RATES.phy_combat, 2.0, mxp);
                checkSkillUp(world, 'phy', oldPhy, sprintSheet.stats.phy);
              }
            }
          }
        }

        // Stamina regeneration when not sprinting and resting long enough
        if (playerCtrl.movementStance !== 'sprint' && playerCtrl.movementStance !== 'chakra_sprint') {
          const resources = world.resources.get(playerId);
          if (resources) {
            const ticksSinceExertion = world.currentTick - resources.lastExertionTick;
            if (ticksSinceExertion >= STAMINA_REST_TICKS && resources.stamina < resources.staminaCeiling) {
              const regenAmount = resources.maxStamina * STAMINA_RESTORE_RATE;
              resources.stamina = Math.min(resources.staminaCeiling, resources.stamina + regenAmount);
            }
          }
        } else if (playerCtrl.movementStance === 'sprint') {
          // Sprint marks exertion
          const resources = world.resources.get(playerId);
          if (resources) {
            resources.lastExertionTick = world.currentTick;
          }
        }

        // Chakra regeneration when not using chakra-consuming stances and resting long enough
        if (playerCtrl.movementStance !== 'chakra_sprint') {
          const resources = world.resources.get(playerId);
          if (resources) {
            const ticksSinceChakraUse = world.currentTick - resources.lastChakraExertionTick;
            if (ticksSinceChakraUse >= CHAKRA_REST_TICKS && resources.chakra < resources.chakraCeiling) {
              const regenAmount = resources.maxChakra * CHAKRA_RESTORE_RATE;
              resources.chakra = Math.min(resources.chakraCeiling, resources.chakra + regenAmount);
            }
          }
        }
      }

      // Advance time — subtick cost + game seconds
      let subtickCost: number;
      let moveGameSeconds: number;

      // Swimming overrides stance speed (24s/step) when on water without water walk
      const isSwimming = world.tileMap.isWater(playerPos.x, playerPos.y)
        && !canWaterWalk(world, playerId, playerPos.x, playerPos.y);

      if (isSwimming) {
        moveGameSeconds = SWIM_SECONDS;
        subtickCost = Math.max(1, Math.round(SWIM_SECONDS / 0.5));
        // Swimming trains PHY
        const swimSheet = world.characterSheets.get(playerId);
        if (swimSheet) {
          const mxp = getMissionXpMultiplier(world.missionLog);
          const oldPhy = swimSheet.stats.phy;
          swimSheet.stats.phy = computeImprovement(oldPhy, STAT_IMPROVEMENT_RATES.phy_training, 2.0, mxp);
          checkSkillUp(world, 'phy', oldPhy, swimSheet.stats.phy);
        }
      } else if (playerCtrl.movementStance === 'chakra_sprint') {
        const nin = world.characterSheets.get(playerId)?.skills.ninjutsu ?? 10;
        moveGameSeconds = getChakraSprintSpeed(nin);
        subtickCost = Math.max(1, Math.round(moveGameSeconds / 0.5)); // 0.5s per subtick
      } else {
        subtickCost = STANCE_SUBTICK_COST[playerCtrl.movementStance] ?? 12;
        moveGameSeconds = STANCE_SECONDS[playerCtrl.movementStance] ?? TICK_DURATION_SECONDS;
      }
      // Carrying a body doubles movement time
      if (world.carrying.has(playerId)) {
        subtickCost *= 2;
        moveGameSeconds *= 2;
        // Carrying trains PHY
        const carrySheet = world.characterSheets.get(playerId);
        if (carrySheet) {
          const mxp = getMissionXpMultiplier(world.missionLog);
          const oldPhy = carrySheet.stats.phy;
          carrySheet.stats.phy = computeImprovement(oldPhy, STAT_IMPROVEMENT_RATES.phy_training, 2.0, mxp);
          checkSkillUp(world, 'phy', oldPhy, carrySheet.stats.phy);
        }
      }
      advanceTurn(world, subtickCost, moveGameSeconds);

      // Check patrol mission waypoints after move
      const patrolMsg = checkPatrolProgress(world.missionLog, playerPos.x, playerPos.y);
      if (patrolMsg) world.log(patrolMsg, 'system');

      return true;
    }

    case 'wait': {
      // Can't wait during combat — must fight or disengage
      if (findEngagedTarget(world, playerId) !== null) {
        world.log('You\'re in combat! Fight or move away!', 'combat_tempo');
        return false;
      }
      world.log('You wait and observe your surroundings.', 'info');

      // Stamina regen on wait (not exerting)
      const resources = world.resources.get(playerId);
      if (resources) {
        const ticksSinceExertion = world.currentTick - resources.lastExertionTick;
        if (ticksSinceExertion >= STAMINA_REST_TICKS && resources.stamina < resources.staminaCeiling) {
          const regenAmount = resources.maxStamina * STAMINA_RESTORE_RATE;
          resources.stamina = Math.min(resources.staminaCeiling, resources.stamina + regenAmount);
        }
        // Chakra regen on wait (not exerting chakra)
        const ticksSinceChakraUse = world.currentTick - resources.lastChakraExertionTick;
        if (ticksSinceChakraUse >= CHAKRA_REST_TICKS && resources.chakra < resources.chakraCeiling) {
          const chakraRegen = resources.maxChakra * CHAKRA_RESTORE_RATE;
          resources.chakra = Math.min(resources.chakraCeiling, resources.chakra + chakraRegen);
        }
      }

      // Wait passes 1 subtick (0.5s)
      advanceTurn(world, 1, SUBTICK_DURATION);
      return true;
    }

    case 'stanceFaster':
    case 'stanceSlower': {
      // Stances ordered fastest → slowest
      const playerNin = world.characterSheets.get(playerId)?.skills.ninjutsu ?? 0;
      const ordered: Array<import('../types/ecs.ts').MovementStance> = [];
      if (hasTechnique(playerNin, 'chakra_sprint')) {
        ordered.push('chakra_sprint');
      }
      ordered.push('sprint', 'walk', 'creep', 'crawl');

      const stanceNames: Record<string, string> = {
        chakra_sprint: 'Chakra Sprint',
        sprint: 'Sprint', walk: 'Walk', creep: 'Creep', crawl: 'Crawl',
      };

      const idx = ordered.indexOf(playerCtrl.movementStance);
      let nextIdx: number;
      if (action.type === 'stanceFaster') {
        nextIdx = idx - 1;
        if (nextIdx < 0) {
          world.log('Already at fastest stance.', 'system');
          return false;
        }
      } else {
        nextIdx = idx + 1;
        if (nextIdx >= ordered.length) {
          world.log('Already at slowest stance.', 'system');
          return false;
        }
      }

      const next = ordered[nextIdx];
      playerCtrl.movementStance = next;

      if (next === 'chakra_sprint') {
        const speed = getChakraSprintSpeed(playerNin);
        const tier = getChakraSprintTier(playerNin);
        world.log(`Stance: Chakra Sprint — ${tier} (${speed}s/step, ${CHAKRA_SPRINT_COST} chakra + ${CHAKRA_SPRINT_COST} stamina/step).`, 'system');
      } else {
        world.log(`Stance: ${stanceNames[next]}.`, 'system');
      }
      return false;
    }

    case 'toggleKeybindings':
    case 'toggleCharacterSheet': {
      return false; // Handled by UI, not turn system
    }

    case 'interact': {
      // Interacting dispels player's own invisibility
      if (world.invisible.has(playerId)) {
        world.invisible.delete(playerId);
        world.log('Your invisibility fades as you interact.', 'info');
      }

      // Collect ALL interactable adjacent entities
      const candidates: number[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const entities = world.getEntitiesAt(playerPos.x + dx, playerPos.y + dy);
          for (const eid of entities) {
            if (eid === playerId) continue;
            // Skip entities invisible to player
            if (world.isInvisibleToPlayer(eid)) continue;
            // Skip conscious squad members — their info is in the character sheet
            // Allow interaction with downed/unconscious squad members for revive/heal
            if (world.squadMembers.has(eid) && !world.unconscious.has(eid)) continue;
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
        // Check if player is on mission map edge (extraction zone)
        if (world.awayMissionState?.phase === 'on_mission') {
          const edgeZone = 3; // MISSION_MAP_EDGE_ZONE
          const px = playerPos.x;
          const py = playerPos.y;
          const mw = world.tileMap.width;
          const mh = world.tileMap.height;
          if (px < edgeZone || px >= mw - edgeZone || py < edgeZone || py >= mh - edgeZone) {
            // Show extraction context menu
            world._pendingInteraction = { entityId: playerId, type: 'edge_extraction' };
            return false;
          }
        }

        // If carrying a body, pressing interact shows drop option
        if (world.carrying.has(playerId)) {
          world._pendingInteraction = { entityId: playerId, type: 'context_menu' };
          return false;
        }
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
    advanceTurn(world, COMBAT_PASS_SUBTICKS, 2); // ~2 seconds to open a door
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

/** Apply a single free hit from attacker to target during disengagement */
function applyFreeHit(world: World, attackerId: EntityId, targetId: EntityId, attackerName: string): void {
  // Check if target has tempo to dodge
  const engagements = getActiveEngagements();
  const key = attackerId < targetId ? `${attackerId}:${targetId}` : `${targetId}:${attackerId}`;
  const eng = engagements.get(key);
  if (eng) {
    const targetTempo = eng.entityA === targetId ? eng.tempoA : eng.tempoB;
    if (targetTempo && targetTempo.current > 0) {
      targetTempo.current--;
      const DODGE_FLAVORS = [
        `You read ${attackerName}'s strike and dodge just in time!`,
        `Your reflexes save you — ${attackerName}'s blow misses by inches.`,
        `You twist aside, spending tempo to avoid ${attackerName}'s attack.`,
      ];
      world.log(DODGE_FLAVORS[Math.floor(Math.random() * DODGE_FLAVORS.length)], 'combat_tempo');
      return;
    }
  }

  const attackerSheet = world.characterSheets.get(attackerId);
  const attackerTaijutsu = attackerSheet?.skills.taijutsu ?? 10;
  const attackerPhy = attackerSheet?.stats.phy ?? 10;
  const damage = calculateDamage(attackerTaijutsu, attackerPhy);
  const health = world.healths.get(targetId);
  if (health) health.current = Math.max(0, health.current - damage);

  const DISENGAGE_HIT_FLAVORS = [
    `${attackerName} strikes as you pull away — you take the hit but keep moving.`,
    `A blow catches you mid-retreat. ${attackerName}'s fist connects.`,
    `You feel ${attackerName}'s strike land as you try to escape.`,
    `${attackerName} doesn't let you go cleanly — a parting blow rocks you.`,
    `The price of retreat: ${attackerName} lands a solid hit.`,
  ];
  world.log(DISENGAGE_HIT_FLAVORS[Math.floor(Math.random() * DISENGAGE_HIT_FLAVORS.length)], 'hit_incoming');
}

/** Check if an entity can water-walk onto a tile (has technique + enough chakra) */
function canWaterWalk(world: World, entityId: EntityId, x: number, y: number): boolean {
  if (!world.tileMap.isWater(x, y)) return false;
  const sheet = world.characterSheets.get(entityId);
  if (!sheet || !hasTechnique(sheet.skills.ninjutsu, 'water_walk')) return false;
  const resources = world.resources.get(entityId);
  if (!resources || resources.chakra < WATER_WALK_CHAKRA_COST) return false;
  return true;
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
