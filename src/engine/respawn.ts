/**
 * Modular respawn system.
 * Different zones/contexts can define different respawn behaviors.
 */

import type { World } from './world.ts';
import { reviveEntity } from './entityState.ts';
import { computeFOV } from './fov.ts';
import { FOV_RADIUS, PLAYER_START_X, PLAYER_START_Y, TRAINING_RESPAWN_TIME_S, RESPAWN_FADE_MS } from '../core/constants.ts';
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

export const TRAINING_GROUNDS_RESPAWN: RespawnConfig = {
  gameTimePassSeconds: TRAINING_RESPAWN_TIME_S,
  restoreHp: true,
  restoreStamina: true,
  restoreChakra: true,
  restoreWillpower: true,
  spawnX: PLAYER_START_X,
  spawnY: PLAYER_START_Y,
  message: 'You awaken on the training grounds. An hour has passed.',
};

/**
 * Execute a respawn: restore stats, advance time, move player.
 * The fade-to-black animation is handled by the caller (game.ts).
 */
export function executeRespawn(world: World, config: RespawnConfig): void {
  const playerId = world.playerEntityId;
  const resources = world.resources.get(playerId);
  const pos = world.positions.get(playerId);

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
