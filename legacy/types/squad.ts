/**
 * Squad system types — persistent shinobi roster, mission assignment, injury tracking.
 *
 * Squad members are persistent characters that live between missions.
 * They can be assigned to away missions, get injured or die, and are
 * replaced from the village roster when lost.
 */

import type { CharacterSkills, CharacterStats, ShinobiRank } from './character.ts';
import type { CharacterAccents } from '../sprites/characters.ts';

/** Rules of engagement for squad members */
export type SquadROE = 'aggressive' | 'defensive';

/** Status of a squad member between missions */
export type SquadMemberStatus = 'available' | 'injured' | 'dead' | 'on_mission';

/** A persistent shinobi in the village roster */
export interface SquadMember {
  /** Unique ID for this roster member (not an EntityId — persists across worlds) */
  id: string;
  name: string;
  female: boolean;
  rank: ShinobiRank;
  title: string;
  skills: CharacterSkills;
  stats: CharacterStats;
  accents: CharacterAccents;
  /** Current status */
  status: SquadMemberStatus;
  /** Game time (seconds) when injury recovery completes (0 if not injured) */
  recoveryTime: number;
  /** Number of missions completed */
  missionsCompleted: number;
  /** Personality flavor — affects speech bubbles in combat */
  personality: SquadPersonality;
}

/** Personality archetypes — determines combat speech patterns */
export type SquadPersonality = 'stoic' | 'eager' | 'cautious' | 'fierce' | 'calm';

/** Squad assignment for a specific mission */
export interface MissionSquad {
  /** IDs of SquadMembers assigned to this mission */
  memberIds: string[];
  /** Current ROE setting */
  roe: SquadROE;
}

/** The full squad roster persisted in world state */
export interface SquadRoster {
  /** All known shinobi in the roster (alive, injured, or dead) */
  members: SquadMember[];
  /** Current mission assignment (null when not on mission) */
  activeSquad: MissionSquad | null;
  /** Counter for generating unique member IDs */
  nextMemberId: number;
}
