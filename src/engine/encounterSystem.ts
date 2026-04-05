/**
 * Encounter System — rolling random encounters for escort missions.
 *
 * Every tick, there's a small chance of spawning an ambush group near the player.
 * Encounter probability, group size, and enemy type depend on the mission rank.
 * Encounter count is tracked on AwayMissionState for bonus reward scaling.
 *
 * Design:
 *   - ~0.3% chance per tick ≈ 1 encounter per 30s of game time
 *   - Minimum cooldown between encounters: 200 ticks (20s)
 *   - Group size: 1-3 enemies per encounter
 *   - Enemies spawn 8-12 tiles from the player
 */

import type { World } from './world.ts';
import type { CRankMissionData } from '../types/awayMission.ts';
import { spawnEncounterGroup } from '../map/missionMapGenerator.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import { spawnFloatingText } from '../systems/floatingTextSystem.ts';

/** Minimum ticks between encounters (20 seconds) */
const ENCOUNTER_COOLDOWN_TICKS = 200;

/** Base chance per tick (0.3% = ~1 encounter per 33s) */
const ENCOUNTER_CHANCE_PER_TICK = 0.003;

/**
 * Tick the encounter system. Called once per worldTick on escort missions.
 * Returns true if an encounter was spawned.
 */
export function tickEncounters(world: World): boolean {
  const away = world.awayMissionState;
  if (!away || away.phase !== 'on_mission') return false;

  // Only escort missions use rolling encounters
  const missionLog = world.missionLog?.active;
  if (!missionLog) return false;
  const data = missionLog.mission.templateData as unknown as CRankMissionData;
  if (data.missionType !== 'escort') return false;

  // Cooldown check
  if (world.currentTick - away.lastEncounterTick < ENCOUNTER_COOLDOWN_TICKS) return false;

  // Roll for encounter (deterministic based on tick + seed)
  const roll = (cellHash(world.currentTick, away.encounterSeed) & 0xFFFF) / 0xFFFF;
  if (roll > ENCOUNTER_CHANCE_PER_TICK) return false;

  // Get player position for spawn placement
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return false;

  // Determine group size: 1-3 enemies
  const sizeSeed = cellHash(away.encounterSeed, away.encounterCount);
  const groupSize = 1 + (sizeSeed % 3); // 1, 2, or 3

  // Determine enemy type from mission data
  const enemyType = data.enemyType ?? 'bandit';

  // Spawn the encounter group
  const spawnSeed = cellHash(away.encounterSeed, world.currentTick);
  const newIds = spawnEncounterGroup(
    world,
    spawnSeed,
    playerPos.x,
    playerPos.y,
    enemyType,
    groupSize,
  );

  // Track on away state
  away.banditEntityIds.push(...newIds);
  away.encounterCount++;
  away.encounterSeed = cellHash(away.encounterSeed, away.encounterCount + world.currentTick);
  away.lastEncounterTick = world.currentTick;

  // Alert the player
  world.log(`Ambush! ${groupSize === 1 ? 'An enemy appears' : `${groupSize} enemies appear`} from the treeline!`, 'hit_incoming');
  spawnFloatingText(playerPos.x, playerPos.y - 2, 'Ambush!', '#ff4444', 2.0, 14);

  return true;
}
