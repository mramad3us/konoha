/**
 * Overmap travel state machine — manages travel between nodes.
 *
 * Handles:
 * - Initiating travel (pathfinding + state creation)
 * - Advancing travel (distance per frame, camp at night)
 * - Arrival detection
 * - Time passage (world.gameTimeSeconds advancement)
 */

import type { OvermapTravelState } from '../types/overmap.ts';
import { findOvermapPath, getEdge } from './overmapData.ts';
import {
  OVERMAP_WALK_SPEED_KMH,
  OVERMAP_CAMP_START_HOUR,
  OVERMAP_CAMP_END_HOUR,
  SECONDS_PER_DAY,
} from '../core/constants.ts';

/** Result of a travel tick */
export type TravelTickResult =
  | { type: 'traveling' }
  | { type: 'arrived' }
  | { type: 'camping' }
  | { type: 'breaking_camp' }
  | { type: 'no_path' };

/**
 * Create a new travel state for a journey from origin to destination.
 */
export function beginTravel(
  originId: string,
  destinationId: string,
  gameTimeSeconds: number,
  speedKmPerHour: number = OVERMAP_WALK_SPEED_KMH,
): OvermapTravelState | null {
  const result = findOvermapPath(originId, destinationId);
  if (!result) return null;

  return {
    origin: originId,
    destination: destinationId,
    path: result.path,
    currentEdgeIndex: 0,
    progressOnEdge: 0,
    gameTimeAtDeparture: gameTimeSeconds,
    travelSpeedKmPerHour: speedKmPerHour,
    isCamped: false,
    campStartTime: 0,
    totalDistanceKm: result.totalKm,
    distanceCoveredKm: 0,
  };
}

/**
 * Advance travel by a real-time delta.
 * The "speed" on the overmap is aesthetic — we accelerate travel
 * so the player isn't watching for minutes. The actual game time
 * advancement is based on real distance and walk speed.
 *
 * @param state - Current travel state (mutated in place)
 * @param gameTimeSeconds - Current world game time
 * @param animSpeedMultiplier - How fast the overmap animation plays (default 60x = 1 min real = 1 hour game)
 * @returns tick result indicating what happened
 */
export function tickTravel(
  state: OvermapTravelState,
  gameTimeSeconds: number,
  animSpeedMultiplier: number = 60,
): { result: TravelTickResult; gameSecondsElapsed: number } {
  if (state.distanceCoveredKm >= state.totalDistanceKm) {
    return { result: { type: 'arrived' }, gameSecondsElapsed: 0 };
  }

  // Check time of day for camping
  const hour = getHourFromSeconds(gameTimeSeconds);
  const shouldCamp = hour >= OVERMAP_CAMP_START_HOUR || hour < OVERMAP_CAMP_END_HOUR;

  if (shouldCamp && !state.isCamped) {
    // Make camp
    state.isCamped = true;
    state.campStartTime = gameTimeSeconds;
    return { result: { type: 'camping' }, gameSecondsElapsed: 0 };
  }

  if (state.isCamped) {
    // Check if it's time to break camp
    if (!shouldCamp) {
      state.isCamped = false;
      return { result: { type: 'breaking_camp' }, gameSecondsElapsed: 0 };
    }
    // Still camping — advance time to dawn
    const secondsUntilDawn = getSecondsUntilHour(gameTimeSeconds, OVERMAP_CAMP_END_HOUR);
    return { result: { type: 'camping' }, gameSecondsElapsed: Math.min(secondsUntilDawn, 300) };
  }

  // Traveling — advance distance
  // Game seconds per real second at given multiplier
  const gameSecondsPerRealSec = animSpeedMultiplier;
  const kmPerGameSecond = state.travelSpeedKmPerHour / 3600;
  const kmAdvanced = kmPerGameSecond * gameSecondsPerRealSec * (1 / 60); // per frame at 60fps

  state.distanceCoveredKm = Math.min(state.totalDistanceKm, state.distanceCoveredKm + kmAdvanced);

  // Update current edge + progress
  updateEdgeProgress(state);

  // Game time elapsed for this frame
  const gameSecondsElapsed = gameSecondsPerRealSec * (1 / 60);

  if (state.distanceCoveredKm >= state.totalDistanceKm) {
    return { result: { type: 'arrived' }, gameSecondsElapsed };
  }

  return { result: { type: 'traveling' }, gameSecondsElapsed };
}

/**
 * Skip travel entirely — advance directly to arrival.
 * Returns total game seconds that should have elapsed.
 */
export function skipTravel(state: OvermapTravelState): number {
  const remainingKm = state.totalDistanceKm - state.distanceCoveredKm;
  const travelHours = remainingKm / state.travelSpeedKmPerHour;
  // Add ~8 hours per day for camping (rough estimate: 14h travel + 10h camp per day)
  const travelDays = travelHours / 14;
  const campHours = travelDays * 10;
  const totalGameSeconds = (travelHours + campHours) * 3600;

  state.distanceCoveredKm = state.totalDistanceKm;
  state.currentEdgeIndex = state.path.length - 2;
  state.progressOnEdge = 1;
  state.isCamped = false;

  return totalGameSeconds;
}

/**
 * Get total estimated travel time in game hours (including camp stops).
 */
export function estimateTravelHours(totalKm: number, speedKmH: number = OVERMAP_WALK_SPEED_KMH): number {
  const travelHours = totalKm / speedKmH;
  const travelDays = travelHours / 14; // 14 hours of walking per day
  const campHours = travelDays * 10;   // 10 hours of camping per night
  return travelHours + campHours;
}

// ── Helpers ──

function updateEdgeProgress(state: OvermapTravelState): void {
  const path = state.path;
  if (path.length < 2) return;

  // Calculate cumulative distances per edge
  let cumulative = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = getEdge(path[i], path[i + 1]);
    const edgeKm = edge?.distanceKm ?? 10;
    cumulative += edgeKm;

    if (state.distanceCoveredKm <= cumulative) {
      state.currentEdgeIndex = i;
      const edgeStart = cumulative - edgeKm;
      state.progressOnEdge = edgeKm > 0
        ? (state.distanceCoveredKm - edgeStart) / edgeKm
        : 1;
      return;
    }
  }

  // Past the end
  state.currentEdgeIndex = path.length - 2;
  state.progressOnEdge = 1;
}

function getHourFromSeconds(gameTimeSeconds: number): number {
  const secondsInDay = gameTimeSeconds % SECONDS_PER_DAY;
  return Math.floor(secondsInDay / 3600);
}

function getSecondsUntilHour(gameTimeSeconds: number, targetHour: number): number {
  const currentSecondInDay = gameTimeSeconds % SECONDS_PER_DAY;
  const targetSecondInDay = targetHour * 3600;
  if (targetSecondInDay > currentSecondInDay) {
    return targetSecondInDay - currentSecondInDay;
  }
  return (SECONDS_PER_DAY - currentSecondInDay) + targetSecondInDay;
}
