/**
 * Mission system — procedural generation, daily board refresh, tracking.
 *
 * Mission ranks: D (genin), C (experienced genin), B (chuunin), A (jonin/experienced chuunin)
 * Board refreshes daily — expired missions are replaced with new ones.
 * Active mission grants 2x skill XP for all skill improvements.
 */

import { cellHash } from '../sprites/pixelPatterns.ts';
import type { ShinobiRank } from '../types/character.ts';

// ── TYPES ──

export type MissionRank = 'D' | 'C' | 'B' | 'A';

export interface Mission {
  id: string;
  rank: MissionRank;
  title: string;
  client: string;
  description: string;
  objective: string;
  reward: { ryo: number; xpBonus: number };
  /** In-game day the mission was posted */
  postedDay: number;
  /** How many in-game days before it expires */
  durationDays: number;
  /** Mission template key for completion logic */
  templateKey: string;
  /** Template-specific data (target location, NPC name, item, etc.) */
  templateData: Record<string, unknown>;
}

export interface MissionBoard {
  /** Available missions on the board */
  missions: Mission[];
  /** Last day the board was refreshed */
  lastRefreshDay: number;
}

export interface ActiveMission {
  mission: Mission;
  /** Day the mission was accepted */
  acceptedDay: number;
  /** Progress tracking (template-specific) */
  progress: Record<string, unknown>;
  /** Whether this mission is complete */
  complete: boolean;
}

export interface MissionLog {
  /** Currently active mission (only one at a time for now) */
  active: ActiveMission | null;
  /** Completed mission count by rank */
  completed: Record<MissionRank, number>;
  /** Total missions completed */
  totalCompleted: number;
}

// ── CONSTANTS ──

const BOARD_SIZE = 8;  // missions on the board at once
const MISSION_EXPIRY_DAYS: Record<MissionRank, number> = { D: 3, C: 5, B: 7, A: 10 };

/** Rank distribution weights for board generation */
const RANK_WEIGHTS: Array<{ rank: MissionRank; weight: number }> = [
  { rank: 'D', weight: 40 },
  { rank: 'C', weight: 30 },
  { rank: 'B', weight: 20 },
  { rank: 'A', weight: 10 },
];

/** Minimum completed missions of the previous rank to unlock the next */
export const RANK_UNLOCK_REQUIREMENTS: Record<MissionRank, { minRank: ShinobiRank; minPrevCompleted: number; prevRank?: MissionRank }> = {
  D: { minRank: 'genin', minPrevCompleted: 0 },
  C: { minRank: 'genin', minPrevCompleted: 15, prevRank: 'D' },
  B: { minRank: 'chuunin', minPrevCompleted: 0 },
  A: { minRank: 'jounin', minPrevCompleted: 0 },
};

// Also allow experienced chuunin (30 B-rank) to take A-rank
export function canTakeMission(
  rank: MissionRank,
  playerRank: ShinobiRank,
  completedLog: Record<MissionRank, number>,
): { allowed: boolean; reason?: string } {
  const req = RANK_UNLOCK_REQUIREMENTS[rank];

  // Rank hierarchy check
  const rankOrder: ShinobiRank[] = ['civilian', 'academy_student', 'genin', 'chuunin', 'special_jounin', 'jounin', 'anbu', 'kage'];
  const playerIdx = rankOrder.indexOf(playerRank);
  const reqIdx = rankOrder.indexOf(req.minRank);

  // Special case: A-rank can be taken by experienced chuunin (30+ B-rank completed)
  if (rank === 'A' && playerIdx >= rankOrder.indexOf('chuunin') && completedLog.B >= 30) {
    return { allowed: true };
  }

  if (playerIdx < reqIdx) {
    return { allowed: false, reason: `Requires ${req.minRank} rank` };
  }

  if (req.prevRank && completedLog[req.prevRank] < req.minPrevCompleted) {
    return { allowed: false, reason: `Complete ${req.minPrevCompleted} ${req.prevRank}-rank missions first (${completedLog[req.prevRank]}/${req.minPrevCompleted})` };
  }

  return { allowed: true };
}

// ── MISSION TEMPLATES (D-rank for now) ──

interface MissionTemplate {
  rank: MissionRank;
  titles: string[];
  clients: string[];
  descriptions: string[];
  objectives: string[];
  baseRyo: number;
  xpBonus: number;
  templateKey: string;
  generateData: (seed: number) => Record<string, unknown>;
}

const DELIVERY_TARGETS = ['Mrs. Suzuki in the residential district', 'Old Masashi at Konoha Kitchen', 'the Hyuga compound gatekeeper', 'Grandpa Oda near the west houses', 'the supply shop in the market plaza'];
const LOST_ITEMS = ['a child\'s wooden kunai', 'a missing cat named Tora', 'a lost medicine pouch', 'a runaway chicken', 'a set of stolen laundry'];
const ERRAND_LOCATIONS = ['the academy yard', 'the market plaza', 'the hospital entrance', 'the main gate', 'the river bank'];

const D_RANK_TEMPLATES: MissionTemplate[] = [
  {
    rank: 'D',
    titles: ['Package Delivery', 'Urgent Delivery', 'Supply Run', 'Medicine Delivery', 'Scroll Courier'],
    clients: ['Postal Service', 'Konoha Hospital', 'Academy Admin', 'Market Association', 'Village Elder'],
    descriptions: [
      'A package needs to be delivered across the village before sundown.',
      'Medical supplies must reach their destination promptly.',
      'Important documents need to be hand-delivered for security.',
      'Fresh supplies are needed at their destination as soon as possible.',
      'A sealed scroll requires careful handling during transport.',
    ],
    objectives: ['Deliver the package to the specified location.'],
    baseRyo: 500,
    xpBonus: 5,
    templateKey: 'delivery',
    generateData: (seed) => ({
      target: DELIVERY_TARGETS[seed % DELIVERY_TARGETS.length],
      item: ['package', 'medicine box', 'sealed scroll', 'supply crate', 'document tube'][seed % 5],
    }),
  },
  {
    rank: 'D',
    titles: ['Lost & Found', 'Missing Pet', 'Item Recovery', 'The Runaway', 'Search & Retrieve'],
    clients: ['Worried Villager', 'Elderly Resident', 'Academy Student', 'Shop Owner', 'Farmer'],
    descriptions: [
      'Something precious has gone missing in the village.',
      'A beloved pet has escaped and needs to be found.',
      'An important item was lost somewhere in the village.',
      'Someone\'s property needs to be tracked down and returned.',
      'A search of the village grounds is needed to recover a lost possession.',
    ],
    objectives: ['Search the village and recover the lost item or creature.'],
    baseRyo: 600,
    xpBonus: 5,
    templateKey: 'search',
    generateData: (seed) => ({
      target: LOST_ITEMS[seed % LOST_ITEMS.length],
      searchArea: ERRAND_LOCATIONS[seed % ERRAND_LOCATIONS.length],
    }),
  },
  {
    rank: 'D',
    titles: ['Guard Duty', 'Patrol Assignment', 'Night Watch', 'Escort Mission', 'Perimeter Check'],
    clients: ['Gate Command', 'Village Security', 'Merchant Guild', 'Hokage Office', 'Hospital Admin'],
    descriptions: [
      'A routine patrol of the village perimeter is needed.',
      'A merchant needs a guard for their market stall.',
      'The night watch is short-staffed and needs an extra set of eyes.',
      'An elderly villager needs an escort through the village.',
      'A security sweep of a district has been requested.',
    ],
    objectives: ['Complete the assigned patrol or guard shift.'],
    baseRyo: 450,
    xpBonus: 4,
    templateKey: 'patrol',
    generateData: (seed) => ({
      area: ERRAND_LOCATIONS[seed % ERRAND_LOCATIONS.length],
      duration: 2 + (seed % 3),
    }),
  },
];

const C_RANK_TEMPLATES: MissionTemplate[] = [
  {
    rank: 'C',
    titles: ['Bandit Deterrence', 'Road Security', 'Trade Route Patrol', 'Outskirts Sweep', 'Threat Assessment'],
    clients: ['Trade Council', 'Border Patrol', 'Merchant Caravan', 'Village Defense', 'Intelligence Division'],
    descriptions: [
      'Bandits have been spotted near the trade routes. A show of force is needed.',
      'The roads outside the village need to be secured for merchant traffic.',
      'A trade caravan requests shinobi escort through contested territory.',
      'Reports of suspicious activity near the village outskirts require investigation.',
      'An intelligence report needs field verification in the surrounding area.',
    ],
    objectives: ['Investigate and neutralize any threats in the assigned area.'],
    baseRyo: 1500,
    xpBonus: 10,
    templateKey: 'combat_patrol',
    generateData: (seed) => ({
      threatLevel: 1 + (seed % 3),
      enemies: 2 + (seed % 4),
    }),
  },
];

const B_RANK_TEMPLATES: MissionTemplate[] = [
  {
    rank: 'B',
    titles: ['Infiltration Op', 'Asset Recovery', 'High-Value Escort', 'Enemy Encampment', 'Sabotage Mission'],
    clients: ['ANBU Liaison', 'Hokage Office', 'Intelligence Division', 'Defense Council', 'Allied Village'],
    descriptions: [
      'A covert operation requiring skill and discretion.',
      'A stolen village asset must be recovered from hostile territory.',
      'A VIP requires protection during transit through dangerous territory.',
      'An enemy encampment has been located and must be dealt with.',
      'Critical enemy infrastructure needs to be neutralized.',
    ],
    objectives: ['Complete the high-risk objective assigned by command.'],
    baseRyo: 5000,
    xpBonus: 20,
    templateKey: 'combat_mission',
    generateData: (seed) => ({
      threatLevel: 3 + (seed % 3),
      enemies: 4 + (seed % 6),
    }),
  },
];

const A_RANK_TEMPLATES: MissionTemplate[] = [
  {
    rank: 'A',
    titles: ['S-Class Threat Response', 'Border Crisis', 'Assassination Prevention', 'Village Defense Op', 'Allied Reinforcement'],
    clients: ['Hokage', 'ANBU Commander', 'Defense Council', 'Allied Kage', 'Intelligence Chief'],
    descriptions: [
      'A grave threat to the village requires the strongest shinobi available.',
      'A border crisis demands immediate intervention by elite forces.',
      'Intelligence suggests an assassination plot that must be stopped.',
      'The village faces a direct threat requiring organized defense.',
      'An allied village has requested urgent military assistance.',
    ],
    objectives: ['Resolve the critical threat by any means necessary.'],
    baseRyo: 15000,
    xpBonus: 40,
    templateKey: 'elite_mission',
    generateData: (seed) => ({
      threatLevel: 6 + (seed % 4),
      enemies: 6 + (seed % 8),
    }),
  },
];

const ALL_TEMPLATES: MissionTemplate[] = [
  ...D_RANK_TEMPLATES,
  ...C_RANK_TEMPLATES,
  ...B_RANK_TEMPLATES,
  ...A_RANK_TEMPLATES,
];

// ── GENERATION ──

let missionIdCounter = 0;

function pickWeightedRank(seed: number): MissionRank {
  const totalWeight = RANK_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let roll = seed % totalWeight;
  for (const { rank, weight } of RANK_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return rank;
  }
  return 'D';
}

function generateMission(seed: number, day: number): Mission {
  const rank = pickWeightedRank(seed);
  const templates = ALL_TEMPLATES.filter(t => t.rank === rank);
  const template = templates[seed % templates.length];
  const titleIdx = (seed >> 4) % template.titles.length;
  const clientIdx = (seed >> 8) % template.clients.length;
  const descIdx = (seed >> 12) % template.descriptions.length;

  // Add ±20% ryo variance
  const ryoVariance = 0.8 + ((seed % 41) / 100); // 0.80 to 1.20
  const ryo = Math.round(template.baseRyo * ryoVariance);

  return {
    id: `mission_${++missionIdCounter}_${day}`,
    rank,
    title: template.titles[titleIdx],
    client: template.clients[clientIdx],
    description: template.descriptions[descIdx],
    objective: template.objectives[0],
    reward: { ryo, xpBonus: template.xpBonus },
    postedDay: day,
    durationDays: MISSION_EXPIRY_DAYS[rank],
    templateKey: template.templateKey,
    templateData: template.generateData(seed),
  };
}

/** Create a fresh mission board */
export function createMissionBoard(day: number): MissionBoard {
  const missions: Mission[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const seed = cellHash(day * 1000 + i, day * 7 + i * 31);
    missions.push(generateMission(seed, day));
  }
  return { missions, lastRefreshDay: day };
}

/** Refresh the board: remove expired, fill with new missions */
export function refreshMissionBoard(board: MissionBoard, currentDay: number): void {
  if (currentDay <= board.lastRefreshDay) return; // already refreshed today

  // Remove expired missions
  board.missions = board.missions.filter(m => {
    const expiryDay = m.postedDay + m.durationDays;
    return currentDay <= expiryDay;
  });

  // Fill empty slots with new missions
  let slotIdx = board.missions.length;
  while (board.missions.length < BOARD_SIZE) {
    const seed = cellHash(currentDay * 1000 + slotIdx, currentDay * 13 + slotIdx * 37);
    board.missions.push(generateMission(seed, currentDay));
    slotIdx++;
  }

  board.lastRefreshDay = currentDay;
}

/** Create a fresh mission log */
export function createMissionLog(): MissionLog {
  return {
    active: null,
    completed: { D: 0, C: 0, B: 0, A: 0 },
    totalCompleted: 0,
  };
}

/** Accept a mission from the board */
export function acceptMission(log: MissionLog, board: MissionBoard, missionId: string): Mission | null {
  const idx = board.missions.findIndex(m => m.id === missionId);
  if (idx < 0) return null;

  const mission = board.missions[idx];
  // Remove from board
  board.missions.splice(idx, 1);

  log.active = {
    mission,
    acceptedDay: mission.postedDay,
    progress: {},
    complete: false,
  };

  return mission;
}

/** Complete the active mission */
export function completeMission(log: MissionLog): Mission | null {
  if (!log.active || !log.active.complete) return null;

  const mission = log.active.mission;
  log.completed[mission.rank]++;
  log.totalCompleted++;
  log.active = null;

  return mission;
}

/** Abandon the active mission (no penalty for now) */
export function abandonMission(log: MissionLog): void {
  log.active = null;
}

/** Get the current in-game day from gameTimeSeconds */
export function getGameDay(gameTimeSeconds: number): number {
  return Math.floor(gameTimeSeconds / 86400) + 1;
}

/** Returns the XP multiplier (2 if on active mission, 1 otherwise) */
export function getMissionXpMultiplier(log: MissionLog): number {
  return log.active && !log.active.complete ? 2 : 1;
}

// ── RANK DISPLAY ──

export const RANK_COLORS: Record<MissionRank, string> = {
  D: '#5b8c5a',  // leaf green — easy, safe
  C: '#4a7fb5',  // steel blue — moderate
  B: '#c9a84c',  // gold — significant
  A: '#b22234',  // blood red — dangerous
};

export const RANK_LABELS: Record<MissionRank, string> = {
  D: 'D-Rank',
  C: 'C-Rank',
  B: 'B-Rank',
  A: 'A-Rank',
};
