/**
 * Game time system — all time is action-driven, not real-time.
 * Every action advances gameTimeSeconds on the World.
 */

import {
  SECONDS_PER_DAY, DAWN_HOUR, DUSK_HOUR,
  NIGHT_MAX_DIM, NIGHT_FOV_REDUCTION,
} from '../core/constants.ts';

/** Get hour of day (0-23) from game time */
export function getHour(gameTimeSeconds: number): number {
  return Math.floor((gameTimeSeconds % SECONDS_PER_DAY) / 3600);
}

/** Get minute of hour (0-59) */
export function getMinute(gameTimeSeconds: number): number {
  return Math.floor((gameTimeSeconds % 3600) / 60);
}

/** Get day number (starting from 1) */
export function getDayNumber(gameTimeSeconds: number): number {
  return Math.floor(gameTimeSeconds / SECONDS_PER_DAY) + 1;
}

/** Format time as "Day X · HH:MM" */
export function formatGameTime(gameTimeSeconds: number): string {
  const day = getDayNumber(gameTimeSeconds);
  const hour = getHour(gameTimeSeconds);
  const minute = getMinute(gameTimeSeconds);
  const h = hour.toString().padStart(2, '0');
  const m = minute.toString().padStart(2, '0');
  return `Day ${day} · ${h}:${m}`;
}

/** Is it daytime? (DAWN_HOUR to DUSK_HOUR) */
export function isDaytime(gameTimeSeconds: number): boolean {
  const hour = getHour(gameTimeSeconds);
  return hour >= DAWN_HOUR && hour < DUSK_HOUR;
}

/**
 * Night dim factor: 0.0 (full daylight) to NIGHT_MAX_DIM (midnight).
 * Smooth sine curve: peaks at midnight (hour 0/24), zero during day.
 */
export function getNightDimFactor(gameTimeSeconds: number): number {
  const hour = getHour(gameTimeSeconds);
  const minute = getMinute(gameTimeSeconds);
  const hourFrac = hour + minute / 60;

  // During full daytime (7-17), no dimming
  if (hourFrac >= DAWN_HOUR + 1 && hourFrac <= DUSK_HOUR - 1) return 0;

  // Map hour to a 0-1 cycle: 0 at noon (12), 1 at midnight (0/24)
  // Use cosine for smooth transition
  const noon = 12;
  const distFromNoon = Math.abs(((hourFrac - noon + 24) % 24) - 12);
  // distFromNoon: 0 at noon, 12 at midnight
  const normalized = distFromNoon / 12; // 0 at noon, 1 at midnight

  // Smooth curve: only dim when normalized > 0.5 (after dusk / before dawn)
  if (normalized < 0.42) return 0; // ~5pm cutoff
  const dimCurve = (normalized - 0.42) / 0.58; // 0 to 1
  return NIGHT_MAX_DIM * dimCurve * dimCurve; // quadratic ease-in
}

/**
 * FOV reduction at night: 0 (day) to NIGHT_FOV_REDUCTION (midnight).
 */
export function getNightFovReduction(gameTimeSeconds: number): number {
  const dim = getNightDimFactor(gameTimeSeconds);
  return Math.round((dim / NIGHT_MAX_DIM) * NIGHT_FOV_REDUCTION);
}

/**
 * Get a time-of-day description for flavor text.
 */
export function getTimeOfDayLabel(gameTimeSeconds: number): string {
  const hour = getHour(gameTimeSeconds);
  if (hour >= 5 && hour < 7) return 'Dawn';
  if (hour >= 7 && hour < 12) return 'Morning';
  if (hour === 12) return 'Noon';
  if (hour >= 13 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 19) return 'Dusk';
  if (hour >= 19 && hour < 22) return 'Evening';
  return 'Night';
}
