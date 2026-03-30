/**
 * Away mission flow orchestrator — manages the full lifecycle of an away mission.
 *
 * Flow:
 * 1. Player accepts C-rank mission at mission desk
 * 2. Player walks to village gate and interacts → "Depart on Mission"
 * 3. Village world is serialized and cached
 * 4. Overmap shows travel to destination (time passes, camping at night)
 * 5. On arrival, procedural mission map is generated
 * 6. Player completes objective (or retreats)
 * 7. Player reaches map edge → "Extract" / "Abandon Mission"
 * 8. Overmap shows travel back to Konoha
 * 9. Player arrives, village world is restored
 * 10. Player reports mission at desk → rewards applied
 */

import type { AwayMissionState } from '../types/awayMission.ts';
import type { CRankMissionData } from '../types/awayMission.ts';
import type { World } from './world.ts';
import type { ActiveMission } from './missions.ts';
import { getCRankData } from './missions.ts';
import { beginTravel } from '../overmap/overmapTravel.ts';
import { generateMissionMap } from '../map/missionMapGenerator.ts';
import { OVERMAP_WALK_SPEED_KMH, MISSION_MAP_WIDTH, MISSION_MAP_HEIGHT, SECONDS_PER_DAY } from '../core/constants.ts';
import type { MissionMapResult } from '../map/missionMapGenerator.ts';
import type { SquadMember } from '../types/squad.ts';

/**
 * Initiate departure for an away mission.
 * Serializes the village world and creates the travel state.
 */
export function beginAwayMission(
  villageWorld: World,
  activeMission: ActiveMission,
): AwayMissionState | null {
  const data = getCRankData(activeMission.mission);
  if (!data) return null;

  // Serialize village world
  const villageWorldData = villageWorld.serialize();

  // Create travel state from Konoha to destination
  const travelState = beginTravel(
    'konoha',
    data.targetLocation,
    villageWorld.gameTimeSeconds,
    OVERMAP_WALK_SPEED_KMH,
  );

  if (!travelState) {
    // No path found — shouldn't happen with valid data
    return null;
  }

  return {
    phase: 'traveling_out',
    missionId: activeMission.mission.id,
    villageWorldData,
    overmapState: travelState,
    missionMapSeed: data.mapSeed,
    objectiveComplete: false,
    hasTrophy: false,
    expirationGameTime: villageWorld.gameTimeSeconds + activeMission.mission.durationDays * SECONDS_PER_DAY,
    missionPlayerEntityId: null,
    targetEntityId: null,
    banditEntityIds: [],
    squadEntityIds: [],
  };
}

/**
 * Generate the mission map world when the player arrives at the destination.
 * Returns the new world to swap into.
 */
export function createMissionWorld(
  awayState: AwayMissionState,
  missionData: CRankMissionData,
  playerName: string,
  playerGender: 'shinobi' | 'kunoichi',
  playerSheet: import('../types/character.ts').CharacterSheet,
  gameTimeSeconds: number,
  squadMembers: SquadMember[] = [],
): MissionMapResult {
  const config = {
    width: MISSION_MAP_WIDTH,
    height: MISSION_MAP_HEIGHT,
    seed: awayState.missionMapSeed,
    missionType: missionData.missionType,
    banditCount: missionData.banditCount,
    hasCamp: missionData.hasCamp,
    terrainType: missionData.terrainType,
    playerSpawnEdge: 's' as const, // Always enter from the south
  };

  const result = generateMissionMap(config, missionData, playerName, playerGender, playerSheet, gameTimeSeconds, squadMembers);

  // Update away state with entity references
  awayState.phase = 'on_mission';
  awayState.missionPlayerEntityId = result.playerEntityId;
  awayState.targetEntityId = result.targetEntityId;
  awayState.banditEntityIds = result.banditEntityIds;
  awayState.squadEntityIds = result.squadEntityIds;
  awayState.overmapState = null;

  return result;
}

/**
 * Begin the return trip from the mission map.
 */
export function beginReturnTrip(
  awayState: AwayMissionState,
  missionData: CRankMissionData,
  gameTimeSeconds: number,
): void {
  const travelState = beginTravel(
    missionData.targetLocation,
    'konoha',
    gameTimeSeconds,
    OVERMAP_WALK_SPEED_KMH,
  );

  awayState.phase = 'traveling_back';
  awayState.overmapState = travelState;
}

/**
 * Check if the player is in the extraction zone (edge of mission map).
 */
export function isInExtractionZone(
  x: number, y: number,
  mapWidth: number, mapHeight: number,
  edgeZone: number,
): boolean {
  return x < edgeZone || x >= mapWidth - edgeZone ||
         y < edgeZone || y >= mapHeight - edgeZone;
}

/**
 * Check if the away mission has expired.
 */
export function isMissionExpired(awayState: AwayMissionState, gameTimeSeconds: number): boolean {
  return gameTimeSeconds >= awayState.expirationGameTime;
}
