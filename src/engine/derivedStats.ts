/**
 * Derived stats — compute max HP, chakra, willpower, stamina from base + scaling.
 * Called whenever stats change or on world generation.
 */

import {
  BASE_PLAYER_HP, HP_PHY_SCALING,
  BASE_PLAYER_CHAKRA, CHAKRA_CHA_SCALING,
  BASE_PLAYER_WILLPOWER, WILLPOWER_MEN_SCALING,
  BASE_PLAYER_STAMINA, STAMINA_PHY_SCALING,
} from '../core/constants.ts';
import type { CharacterStats } from '../types/character.ts';

export function computeMaxHp(stats: CharacterStats): number {
  return Math.floor(BASE_PLAYER_HP + stats.phy * HP_PHY_SCALING);
}

export function computeMaxChakra(stats: CharacterStats): number {
  return Math.floor(BASE_PLAYER_CHAKRA + stats.cha * CHAKRA_CHA_SCALING);
}

export function computeMaxWillpower(stats: CharacterStats): number {
  return Math.floor(BASE_PLAYER_WILLPOWER + stats.men * WILLPOWER_MEN_SCALING);
}

export function computeMaxStamina(stats: CharacterStats): number {
  return Math.floor(BASE_PLAYER_STAMINA + stats.phy * STAMINA_PHY_SCALING);
}

/** Recalculate all max resource values from character sheet stats */
export function recalcResources(
  stats: CharacterStats,
  resources: { maxStamina: number; maxChakra: number; maxWillpower: number; staminaCeiling: number },
  health: { max: number },
): void {
  health.max = computeMaxHp(stats);
  resources.maxChakra = computeMaxChakra(stats);
  resources.maxWillpower = computeMaxWillpower(stats);
  const newMaxStamina = computeMaxStamina(stats);
  // Adjust ceiling proportionally if max changed
  if (resources.maxStamina > 0) {
    resources.staminaCeiling = Math.floor(resources.staminaCeiling * (newMaxStamina / resources.maxStamina));
  } else {
    resources.staminaCeiling = newMaxStamina;
  }
  resources.maxStamina = newMaxStamina;
}
