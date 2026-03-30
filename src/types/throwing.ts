/**
 * Thrown weapons system — kunai and shuriken types, ammo, projectile state.
 */

import type { EntityId } from './ecs.ts';

export type ThrownWeaponType = 'kunai' | 'shuriken';

/** Ammo inventory for an entity capable of throwing */
export interface ThrownAmmoComponent {
  kunai: number;
  shuriken: number;
}

/** Active projectile in flight across the grid */
export interface ProjectileComponent {
  weaponType: ThrownWeaponType;
  sourceId: EntityId;
  targetTile: { x: number; y: number };
  /** Bresenham path tiles from source to target (excluding source) */
  path: Array<{ x: number; y: number }>;
  /** Index into path — current position */
  pathIndex: number;
  damage: number;
  evasionPenalty: number;
  lethal: boolean;
  /** Subtick when this projectile last moved (for speed gating) */
  lastMoveSubtick: number;
  /** Subticks per tile of travel */
  speed: number;
}

/** Throw cooldown — tracks when entity can throw again */
export interface ThrowCooldownComponent {
  readyAtSubtick: number;
}

/** Static data for each thrown weapon type */
export interface ThrownWeaponStats {
  damage: number;
  speed: number;          // subticks per tile (lower = faster)
  evasionPenalty: number; // % penalty to target's dodge chance
  maxRange: number;       // max tiles
}

export const THROWN_WEAPON_DATA: Record<ThrownWeaponType, ThrownWeaponStats> = {
  kunai: {
    damage: 8,
    speed: 1,       // 1 subtick per tile — fast
    evasionPenalty: 0,
    maxRange: 10,
  },
  shuriken: {
    damage: 5,
    speed: 2,       // 2 subticks per tile — slower but harder to dodge
    evasionPenalty: 20,
    maxRange: 10,
  },
};

/** Get throw cooldown in subticks based on bukijutsu skill level */
export function getThrowCooldown(bukijutsu: number): number {
  if (bukijutsu >= 46) return 1;   // 0.5s
  if (bukijutsu >= 31) return 2;   // 1s
  if (bukijutsu >= 16) return 4;   // 2s
  return 6;                         // 3s
}
