/**
 * Away mission types — state for C-rank+ missions that take the player outside the village.
 */

import type { EntityId } from './ecs.ts';
import type { OvermapTravelState } from './overmap.ts';

/** Mission rank tiers for XP scaling */
export type SkillRankTier = 'genin' | 'chuunin' | 'jonin' | 'elite';

/** C-rank mission subtypes */
export type CRankMissionType = 'bandit_capture' | 'gang_elimination' | 'escort';

/** B-rank mission subtypes */
export type BRankMissionType = 'encampment_assault' | 'asset_recovery' | 'infiltration';

/** A-rank mission subtypes */
export type ARankMissionType = 'rogue_nin_pursuit' | 'threat_response' | 'assassination_prevention';

/** All away mission subtypes */
export type AwayMissionType = CRankMissionType | BRankMissionType | ARankMissionType;

/** Enemy type determines spawn behavior and combat stats */
export type EnemyType = 'bandit' | 'rogue_nin' | 'missing_nin';

/** Data stored in mission.templateData for away missions (C/B/A rank) */
export interface CRankMissionData {
  missionType: AwayMissionType;
  /** Name of the target (bandit leader, rogue nin, etc.) */
  targetName: string;
  /** Overmap node ID where the mission takes place */
  targetLocation: string;
  /** Display name of the target location */
  targetLocationName: string;
  /** Client who posted the mission */
  clientName: string;
  /** What to search the target for as proof */
  trophyItem: string;
  /** Number of enemies in the camp/area */
  banditCount: number;
  /** Name of the enemy leader */
  banditLeaderName: string;
  /** Seed for procedural map generation */
  mapSeed: number;
  /** Terrain type for the procedural map */
  terrainType: 'forest' | 'plains' | 'rocky' | 'riverside' | 'desert';
  /** Whether there's a visible enemy camp */
  hasCamp: boolean;
  /** Enemy type — determines spawned NPC combat tier (defaults to 'bandit' for C-rank) */
  enemyType?: EnemyType;
}

/** Tracks the full state of an away mission in progress */
export interface AwayMissionState {
  /** Current phase of the away mission */
  phase: 'departing' | 'traveling_out' | 'on_mission' | 'traveling_back' | 'returning';
  /** ID of the active mission */
  missionId: string;
  /** Serialized village world (preserved while on mission) */
  villageWorldData: Record<string, unknown> | null;
  /** Overmap travel state (during travel phases) */
  overmapState: OvermapTravelState | null;
  /** Seed for the procedural mission map */
  missionMapSeed: number;
  /** Whether the primary objective is complete */
  objectiveComplete: boolean;
  /** Whether player has collected the trophy/proof */
  hasTrophy: boolean;
  /** Game time when the mission expires */
  expirationGameTime: number;
  /** Player entity ID in the mission world */
  missionPlayerEntityId: EntityId | null;
  /** Target entity ID in the mission world */
  targetEntityId: EntityId | null;
  /** IDs of bandit entities */
  banditEntityIds: EntityId[];
  /** IDs of squad member entities on the mission map */
  squadEntityIds: EntityId[];
  /** Rolling encounter state (escort missions) */
  encounterCount: number;
  /** Seed that advances with each encounter for deterministic spawning */
  encounterSeed: number;
  /** Tick of the last encounter spawn (cooldown) */
  lastEncounterTick: number;
}

/** Configuration for procedural mission map generation */
export interface MissionMapConfig {
  width: number;
  height: number;
  seed: number;
  missionType: AwayMissionType;
  banditCount: number;
  hasCamp: boolean;
  terrainType: 'forest' | 'plains' | 'rocky' | 'riverside' | 'desert';
  /** Player spawn edge: which edge of the map the player enters from */
  playerSpawnEdge: 'n' | 's' | 'e' | 'w';
  /** Enemy type — determines spawn tier (defaults to 'bandit') */
  enemyType?: EnemyType;
}

/** Reward configuration computed per-skill at mission end */
export interface MissionRewardEntry {
  skillOrStat: string;
  baseReward: number;
  /** Scaling factor based on skill level vs mission rank (0.1 to 1.5) */
  scalingFactor: number;
  /** Final reward amount after scaling */
  finalReward: number;
}

/** Complete reward package for a mission */
export interface MissionRewards {
  entries: MissionRewardEntry[];
  /** Action XP multiplier active during the mission (per-skill, min x2) */
  actionXpMultipliers: Record<string, number>;
}
