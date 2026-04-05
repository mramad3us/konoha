/**
 * Mission reward calculation — computes XP rewards and action multipliers
 * based on per-skill rank comparison with mission difficulty.
 *
 * Key rules:
 * - Each skill/stat is evaluated independently against the mission rank
 * - Skill below mission rank: 150% bulk, x10 action XP
 * - Skill at mission rank: 100% bulk, x5 action XP
 * - Skill one rank above: 50% bulk, x2 action XP
 * - Skill two+ ranks above: 10% bulk (floor), x2 action XP (floor)
 * - Always at least x2 action XP on any mission
 * - Bulk bottoms out at 10%
 */

import type { MissionRewards, MissionRewardEntry } from '../types/awayMission.ts';
import type { CharacterSheet } from '../types/character.ts';
import { getSkillRankTier, rankTierToNumber, missionRankToTier } from '../types/character.ts';
import {
  MISSION_XP_BELOW_RANK, MISSION_XP_AT_RANK, MISSION_XP_ABOVE_RANK, MISSION_XP_FAR_ABOVE,
  MISSION_ACTION_XP_BELOW_RANK, MISSION_ACTION_XP_AT_RANK, MISSION_ACTION_XP_ABOVE_RANK,
  C_RANK_BULK_REWARD, C_RANK_TYPE_BONUS,
  B_RANK_BULK_REWARD, B_RANK_TYPE_BONUS,
  A_RANK_BULK_REWARD, A_RANK_TYPE_BONUS,
} from '../core/constants.ts';

/**
 * Compute the bulk reward scaling factor for a single skill/stat
 * based on its current value vs the mission's rank.
 */
function computeBulkScaling(skillValue: number, missionRank: string): number {
  const skillTier = getSkillRankTier(skillValue);
  const missionTier = missionRankToTier(missionRank);
  const skillNum = rankTierToNumber(skillTier);
  const missionNum = rankTierToNumber(missionTier);

  const diff = skillNum - missionNum; // positive = skill above mission

  if (diff < 0) return MISSION_XP_BELOW_RANK;      // below mission rank: 150%
  if (diff === 0) return MISSION_XP_AT_RANK;         // at mission rank: 100%
  if (diff === 1) return MISSION_XP_ABOVE_RANK;      // one above: 50%
  return MISSION_XP_FAR_ABOVE;                        // two+ above: 10% (floor)
}

/**
 * Compute the action XP multiplier for a single skill/stat during the mission.
 */
function computeActionMultiplier(skillValue: number, missionRank: string): number {
  const skillTier = getSkillRankTier(skillValue);
  const missionTier = missionRankToTier(missionRank);
  const skillNum = rankTierToNumber(skillTier);
  const missionNum = rankTierToNumber(missionTier);

  const diff = skillNum - missionNum;

  if (diff < 0) return MISSION_ACTION_XP_BELOW_RANK;   // x10
  if (diff === 0) return MISSION_ACTION_XP_AT_RANK;      // x5
  return MISSION_ACTION_XP_ABOVE_RANK;                    // x2 (floor)
}

/**
 * Get the per-skill action XP multiplier during an active away mission.
 * This replaces the old flat getMissionXpMultiplier for away missions.
 */
export function getAwayMissionActionMultiplier(
  sheet: CharacterSheet,
  skillOrStat: string,
  missionRank: string,
): number {
  const value = getSkillOrStatValue(sheet, skillOrStat);
  return computeActionMultiplier(value, missionRank);
}

/**
 * Get the base reward table and type bonus table for a given mission rank.
 */
function getRewardTables(missionRank: string): { base: Record<string, number>; typeBonus: Record<string, Record<string, number>> } {
  switch (missionRank) {
    case 'B': return { base: B_RANK_BULK_REWARD, typeBonus: B_RANK_TYPE_BONUS };
    case 'A': return { base: A_RANK_BULK_REWARD, typeBonus: A_RANK_TYPE_BONUS };
    default:  return { base: C_RANK_BULK_REWARD, typeBonus: C_RANK_TYPE_BONUS };
  }
}

/**
 * Compute the full reward package for a completed away mission.
 * For escort missions, encounterCount scales the bonus rewards —
 * each encounter adds +15% to the type bonus (capped at +200%).
 */
export function computeCRankRewards(
  sheet: CharacterSheet,
  missionRank: string,
  missionType: string,
  encounterCount: number = 0,
): MissionRewards {
  // Build base rewards + type bonus
  const tables = getRewardTables(missionRank);
  const baseRewards = { ...tables.base };
  const typeBonus = tables.typeBonus[missionType];
  if (typeBonus) {
    // Encounter bonus: each encounter adds +15% to type bonus, capped at +200%
    const encounterMultiplier = Math.min(3.0, 1.0 + encounterCount * 0.15);
    for (const [key, bonus] of Object.entries(typeBonus)) {
      baseRewards[key] = (baseRewards[key] ?? 0) + bonus * encounterMultiplier;
    }
  }

  const entries: MissionRewardEntry[] = [];
  const actionXpMultipliers: Record<string, number> = {};

  for (const [skillOrStat, baseReward] of Object.entries(baseRewards)) {
    const value = getSkillOrStatValue(sheet, skillOrStat);
    const scalingFactor = computeBulkScaling(value, missionRank);
    const finalReward = baseReward * scalingFactor;

    entries.push({
      skillOrStat,
      baseReward,
      scalingFactor,
      finalReward,
    });

    actionXpMultipliers[skillOrStat] = computeActionMultiplier(value, missionRank);
  }

  return { entries, actionXpMultipliers };
}

/**
 * Apply bulk mission rewards to a character sheet.
 * Uses computeImprovement so the curve still applies.
 */
export function applyMissionRewards(
  sheet: CharacterSheet,
  rewards: MissionRewards,
): Record<string, { before: number; after: number }> {
  const changes: Record<string, { before: number; after: number }> = {};

  for (const entry of rewards.entries) {
    if (entry.finalReward <= 0) continue;
    const before = getSkillOrStatValue(sheet, entry.skillOrStat);
    const after = Math.min(100, before + entry.finalReward);
    setSkillOrStatValue(sheet, entry.skillOrStat, after);
    if (after > before) {
      changes[entry.skillOrStat] = { before, after };
    }
  }

  return changes;
}

/** Read a skill or stat value from the character sheet by name */
function getSkillOrStatValue(sheet: CharacterSheet, key: string): number {
  // Stats
  if (key in sheet.stats) return (sheet.stats as unknown as Record<string, number>)[key] ?? 0;
  // Skills
  if (key in sheet.skills) return (sheet.skills as unknown as Record<string, number>)[key] ?? 0;
  return 0;
}

/** Set a skill or stat value on the character sheet by name */
function setSkillOrStatValue(sheet: CharacterSheet, key: string, value: number): void {
  if (key in sheet.stats) {
    (sheet.stats as unknown as Record<string, number>)[key] = value;
  } else if (key in sheet.skills) {
    (sheet.skills as unknown as Record<string, number>)[key] = value;
  }
}
