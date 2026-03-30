/**
 * Modular respawn system.
 * Different zones/contexts can define different respawn behaviors.
 */

import type { World } from './world.ts';
import { reviveEntity } from './entityState.ts';
import { clearEntityEngagements } from './combatSystem.ts';
import { stopCarrying } from './restraintCarry.ts';
import { computeFOV } from './fov.ts';
import { FOV_RADIUS, TRAINING_RESPAWN_TIME_S, RESPAWN_FADE_MS } from '../core/constants.ts';
import { getNightFovReduction } from './gameTime.ts';

export interface RespawnConfig {
  gameTimePassSeconds: number;
  restoreHp: boolean;
  restoreStamina: boolean;
  restoreChakra: boolean;
  restoreWillpower: boolean;
  spawnX: number;
  spawnY: number;
  message: string;
}

/** Hospital bed — Ward 1, bed 1 (17, 84) */
const HOSPITAL_BED_X = 17;
const HOSPITAL_BED_Y = 84;

export const TRAINING_GROUNDS_RESPAWN: RespawnConfig = {
  gameTimePassSeconds: TRAINING_RESPAWN_TIME_S,
  restoreHp: true,
  restoreStamina: true,
  restoreChakra: true,
  restoreWillpower: true,
  spawnX: HOSPITAL_BED_X,
  spawnY: HOSPITAL_BED_Y,
  message: 'You open your eyes... bandages, the sharp smell of antiseptic. You\'re lying in a hospital bed.',
};

/**
 * Execute a respawn: restore stats, advance time, move player.
 * The fade-to-black animation is handled by the caller (game.ts).
 */
export function executeRespawn(world: World, config: RespawnConfig): void {
  const playerId = world.playerEntityId;
  const resources = world.resources.get(playerId);
  const pos = world.positions.get(playerId);

  // Clear any combat engagements (player teleported away from the fight)
  clearEntityEngagements(playerId);

  // Drop anything being carried (can't keep carrying while unconscious)
  if (world.carrying.has(playerId)) {
    stopCarrying(world, playerId);
  }

  // Clear bleeding (hospital staff patched us up)
  world.bleeding.delete(playerId);

  // Revive via centralized state manager (restores HP, clears unconscious, restores sprite)
  reviveEntity(world, playerId, 1.0);

  // Additional resource restoration based on config
  const health = world.healths.get(playerId);
  if (health && config.restoreHp) {
    health.current = health.max; // full HP on respawn
  }

  if (resources) {
    if (config.restoreStamina) {
      resources.stamina = resources.maxStamina;
      resources.staminaCeiling = resources.maxStamina;
      resources.lastExertionTick = 0;
    }
    if (config.restoreChakra) {
      resources.chakra = resources.maxChakra;
      resources.chakraCeiling = resources.maxChakra;
      resources.lastChakraExertionTick = 0;
    }
    if (config.restoreWillpower) {
      resources.willpower = resources.maxWillpower;
    }
  }

  // Move player to spawn
  if (pos) {
    world.moveInGrid(playerId, pos.x, pos.y, config.spawnX, config.spawnY);
    pos.x = config.spawnX;
    pos.y = config.spawnY;
    pos.facing = 'n';
  }

  // Advance time
  world.gameTimeSeconds += config.gameTimePassSeconds;

  // Recompute FOV
  if (pos) {
    const nightReduction = getNightFovReduction(world.gameTimeSeconds);
    computeFOV(world, pos.x, pos.y, Math.max(3, FOV_RADIUS - nightReduction));
  }

  world.log(config.message, 'system');
}

/** Fade duration for UI */
export { RESPAWN_FADE_MS };
