/**
 * Mission system — procedural generation, daily board refresh, tracking.
 *
 * Mission ranks: D (genin), C (experienced genin), B (chuunin), A (jonin/experienced chuunin)
 * Board refreshes daily — expired missions are replaced with new ones.
 * Active mission grants 2x skill XP for all skill improvements.
 *
 * Shinobi work on behalf of the village — no monetary rewards.
 * Track record of completed missions determines career progression.
 */

import { cellHash } from '../sprites/pixelPatterns.ts';
import type { ShinobiRank } from '../types/character.ts';
import type { World } from './world.ts';

// ── TYPES ──

export type MissionRank = 'D' | 'C' | 'B' | 'A';

export interface Mission {
  id: string;
  rank: MissionRank;
  title: string;
  client: string;
  description: string;
  objective: string;
  /** In-game day the mission was posted */
  postedDay: number;
  /** How many in-game days before it expires */
  durationDays: number;
  /** Mission template key for completion logic */
  templateKey: string;
  /** Template-specific data (target NPC, location, etc.) */
  templateData: Record<string, unknown>;
}

export interface MissionBoard {
  missions: Mission[];
  lastRefreshDay: number;
}

export interface ActiveMission {
  mission: Mission;
  acceptedDay: number;
  /** Progress tracking — keys depend on template */
  progress: Record<string, unknown>;
  /** Objective completed (still need to report back) */
  objectiveComplete: boolean;
  /** Fully reported and done */
  reported: boolean;
}

export interface MissionLog {
  active: ActiveMission | null;
  completed: Record<MissionRank, number>;
  totalCompleted: number;
}

// ── MISSION EVENT SYSTEM ──

export type MissionEvent =
  | { type: 'interact_npc'; npcName: string }
  | { type: 'reach_area'; x: number; y: number }
  | { type: 'collect_entity'; entityId: number };

// ── CONSTANTS ──

const BOARD_SIZE = 8;
const MISSION_EXPIRY_DAYS: Record<MissionRank, number> = { D: 3, C: 5, B: 7, A: 10 };

const RANK_WEIGHTS: Array<{ rank: MissionRank; weight: number }> = [
  { rank: 'D', weight: 40 },
  { rank: 'C', weight: 30 },
  { rank: 'B', weight: 20 },
  { rank: 'A', weight: 10 },
];

export const RANK_UNLOCK_REQUIREMENTS: Record<MissionRank, { minRank: ShinobiRank; minPrevCompleted: number; prevRank?: MissionRank }> = {
  D: { minRank: 'genin', minPrevCompleted: 0 },
  C: { minRank: 'genin', minPrevCompleted: 15, prevRank: 'D' },
  B: { minRank: 'chuunin', minPrevCompleted: 0 },
  A: { minRank: 'jounin', minPrevCompleted: 0 },
};

export function canTakeMission(
  rank: MissionRank,
  playerRank: ShinobiRank,
  completedLog: Record<MissionRank, number>,
): { allowed: boolean; reason?: string } {
  const req = RANK_UNLOCK_REQUIREMENTS[rank];
  const rankOrder: ShinobiRank[] = ['civilian', 'academy_student', 'genin', 'chuunin', 'special_jounin', 'jounin', 'anbu', 'kage'];
  const playerIdx = rankOrder.indexOf(playerRank);
  const reqIdx = rankOrder.indexOf(req.minRank);

  // A-rank: experienced chuunin (30+ B-rank) can also take
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

// ══════════════════════════════════════
//  D-RANK TEMPLATES — Village-local missions
// ══════════════════════════════════════

/** Actual NPCs in the village that can be delivery targets */
const DELIVERY_NPCS = [
  { name: 'Mrs. Suzuki', location: 'the main avenue', hint: 'She walks the main road near the commercial strip.' },
  { name: 'Old Masashi', location: 'Konoha Kitchen', hint: 'The ramen chef is always at his post.' },
  { name: 'Grandpa Oda', location: 'the west residential area', hint: 'He sits outside his home, watching the clouds.' },
  { name: 'Tenten', location: 'the weapons shop', hint: 'She runs the weapons shop in the market plaza.' },
  { name: 'Dr. Nono', location: 'the hospital', hint: 'The head medic is inside the hospital building.' },
  { name: 'Daikichi-sensei', location: 'the academy', hint: 'He teaches inside the academy building.' },
  { name: 'Kotetsu', location: 'the main gate', hint: 'One of the gate guards — he\'s always on duty.' },
  { name: 'Genma', location: 'the supply shop', hint: 'He runs the supply shop in the market.' },
  { name: 'Hiashi', location: 'the Hyuga compound', hint: 'The Hyuga clan leader — inside the main hall.' },
];

/** Locations for search missions — spawn area for lost items/creatures */
const SEARCH_AREAS: Array<{ label: string; x: number; y: number; radius: number }> = [
  { label: 'the academy yard', x: 66, y: 24, radius: 6 },
  { label: 'the market plaza', x: 115, y: 79, radius: 8 },
  { label: 'the main gate area', x: 77, y: 144, radius: 6 },
  { label: 'the river bank', x: 50, y: 62, radius: 8 },
  { label: 'the south park', x: 65, y: 134, radius: 5 },
  { label: 'the residential west', x: 30, y: 110, radius: 10 },
  { label: 'the residential east', x: 115, y: 112, radius: 10 },
];

/** Patrol waypoints — player must visit all of them */
const PATROL_ROUTES: Array<{ name: string; waypoints: Array<{ x: number; y: number; label: string }> }> = [
  {
    name: 'Main Avenue Patrol',
    waypoints: [
      { x: 77, y: 145, label: 'Main gate' },
      { x: 77, y: 110, label: 'Commercial district' },
      { x: 77, y: 80, label: 'Market road crossing' },
      { x: 77, y: 50, label: 'North village' },
    ],
  },
  {
    name: 'Perimeter Sweep',
    waypoints: [
      { x: 77, y: 145, label: 'Main gate' },
      { x: 30, y: 110, label: 'West residential' },
      { x: 30, y: 63, label: 'West river bank' },
      { x: 120, y: 63, label: 'East river bank' },
      { x: 120, y: 110, label: 'East residential' },
    ],
  },
  {
    name: 'Market District Watch',
    waypoints: [
      { x: 100, y: 74, label: 'Weapons shop' },
      { x: 120, y: 74, label: 'Scroll shop' },
      { x: 110, y: 86, label: 'South market' },
      { x: 76, y: 79, label: 'Village well' },
    ],
  },
];

interface MissionTemplate {
  rank: MissionRank;
  titles: string[];
  clients: string[];
  descriptions: string[];
  templateKey: string;
  generateData: (seed: number) => { objective: string; templateData: Record<string, unknown> };
}

const D_RANK_DELIVERY: MissionTemplate = {
  rank: 'D',
  titles: ['Package Delivery', 'Urgent Delivery', 'Supply Run', 'Medicine Delivery', 'Scroll Courier'],
  clients: ['Mrs. Tanaka, a villager', 'Konoha Hospital clerk', 'Academy errand office', 'A market stall owner', 'Old man from the east district'],
  descriptions: [
    'A package needs to be delivered across the village.',
    'Medical supplies must reach their destination promptly.',
    'Important documents need to be hand-delivered for security.',
    'Fresh supplies are needed at their destination.',
    'A sealed scroll requires careful handling during transport.',
  ],
  templateKey: 'delivery',
  generateData: (seed) => {
    const target = DELIVERY_NPCS[seed % DELIVERY_NPCS.length];
    const items = ['package', 'medicine box', 'sealed scroll', 'supply crate', 'document tube'];
    return {
      objective: `Deliver the ${items[seed % items.length]} to ${target.name} at ${target.location}, then report back.`,
      templateData: {
        targetNpc: target.name,
        targetLocation: target.location,
        hint: target.hint,
        item: items[seed % items.length],
      },
    };
  },
};

const D_RANK_SEARCH: MissionTemplate = {
  rank: 'D',
  titles: ['Lost & Found', 'Missing Pet', 'Item Recovery', 'The Runaway', 'Search & Retrieve'],
  clients: ['A worried mother', 'Grandpa from the riverside', 'An academy student\'s parent', 'A shop owner on Market Road', 'A farmer near the west gate'],
  descriptions: [
    'Something precious has gone missing in the village.',
    'A beloved pet has escaped and needs to be found.',
    'An important item was lost somewhere in the village.',
    'Someone\'s property needs to be tracked down and returned.',
    'A thorough search of the village grounds is needed.',
  ],
  templateKey: 'search',
  generateData: (seed) => {
    const area = SEARCH_AREAS[seed % SEARCH_AREAS.length];
    const targets = [
      { name: 'a missing cat named Tora', sprite: 'obj_bush_small' },
      { name: 'a lost medicine pouch', sprite: 'obj_barrel' },
      { name: 'a child\'s wooden kunai', sprite: 'obj_rock_small' },
      { name: 'a runaway chicken', sprite: 'obj_bush_flower' },
      { name: 'a dropped scroll case', sprite: 'obj_rock_small' },
    ];
    const target = targets[seed % targets.length];
    // Actual spawn position is computed when mission is accepted (needs World)
    const angle = (seed * 137) % 360;
    const dist = 1 + (seed % area.radius);
    const spawnX = Math.round(area.x + Math.cos(angle * Math.PI / 180) * dist);
    const spawnY = Math.round(area.y + Math.sin(angle * Math.PI / 180) * dist);
    return {
      objective: `Find ${target.name} near ${area.label}, then report back.`,
      templateData: {
        searchTarget: target.name,
        searchSprite: target.sprite,
        searchArea: area.label,
        spawnX,
        spawnY,
      },
    };
  },
};

const D_RANK_PATROL: MissionTemplate = {
  rank: 'D',
  titles: ['Guard Duty', 'Patrol Assignment', 'Night Watch', 'Village Patrol', 'Perimeter Check'],
  clients: ['Gate duty roster', 'Village watch office', 'A merchant guild clerk', 'Hokage Tower admin desk', 'Hospital security'],
  descriptions: [
    'A routine patrol of a village district is needed.',
    'The night watch is short-staffed and needs an extra set of eyes.',
    'A security sweep of multiple checkpoints has been requested.',
    'An important area needs regular patrols today.',
    'The village perimeter needs checking for unusual activity.',
  ],
  templateKey: 'patrol',
  generateData: (seed) => {
    const route = PATROL_ROUTES[seed % PATROL_ROUTES.length];
    const waypointLabels = route.waypoints.map(w => w.label).join(' → ');
    return {
      objective: `Complete the ${route.name}: visit all checkpoints (${waypointLabels}), then report back.`,
      templateData: {
        routeName: route.name,
        waypoints: route.waypoints,
        visited: route.waypoints.map(() => false),
      },
    };
  },
};

// C/B/A templates — placeholder until we build maps for them
const C_RANK_PLACEHOLDER: MissionTemplate = {
  rank: 'C',
  titles: ['Bandit Deterrence', 'Road Security', 'Trade Route Patrol', 'Outskirts Sweep', 'Threat Assessment'],
  clients: ['A trade official from the capital', 'Village border patrol office', 'A merchant caravan leader', 'Lord Matsuda, a minor provincial lord', 'A tax collector from the eastern towns'],
  descriptions: [
    'Bandits have been spotted near the trade routes.',
    'The roads outside the village need to be secured.',
    'Reports of suspicious activity near the outskirts.',
  ],
  templateKey: 'not_implemented',
  generateData: () => ({
    objective: 'This mission type is not yet available.',
    templateData: { notImplemented: true },
  }),
};

const B_RANK_PLACEHOLDER: MissionTemplate = {
  rank: 'B',
  titles: ['Infiltration Op', 'Asset Recovery', 'High-Value Escort', 'Enemy Encampment', 'Sabotage Mission'],
  clients: ['Classified', 'Lord Nobunaga, governor of the northern province', 'Classified', 'The Fire Daimyo\'s trade minister', 'An allied village liaison'],
  descriptions: [
    'A covert operation requiring skill and discretion.',
    'An enemy encampment has been located.',
  ],
  templateKey: 'not_implemented',
  generateData: () => ({
    objective: 'This mission type is not yet available.',
    templateData: { notImplemented: true },
  }),
};

const A_RANK_PLACEHOLDER: MissionTemplate = {
  rank: 'A',
  titles: ['Threat Response', 'Border Crisis', 'Assassination Prevention', 'Village Defense Op', 'Allied Reinforcement'],
  clients: ['Classified', 'Classified', 'Classified', 'The Fire Daimyo himself', 'Classified'],
  descriptions: [
    'A grave threat to the village requires the strongest shinobi.',
    'The village faces a direct threat requiring organized defense.',
  ],
  templateKey: 'not_implemented',
  generateData: () => ({
    objective: 'This mission type is not yet available.',
    templateData: { notImplemented: true },
  }),
};

const ALL_TEMPLATES: MissionTemplate[] = [
  D_RANK_DELIVERY, D_RANK_SEARCH, D_RANK_PATROL,
  C_RANK_PLACEHOLDER,
  B_RANK_PLACEHOLDER,
  A_RANK_PLACEHOLDER,
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

/** Get the highest mission rank the player can currently take */
function getHighestAccessibleRank(
  playerRank: ShinobiRank,
  completedLog: Record<MissionRank, number>,
): MissionRank {
  const ranks: MissionRank[] = ['A', 'B', 'C', 'D'];
  for (const r of ranks) {
    if (canTakeMission(r, playerRank, completedLog).allowed) return r;
  }
  return 'D';
}

function generateMissionOfRank(seed: number, day: number, rank: MissionRank): Mission {
  const templates = ALL_TEMPLATES.filter(t => t.rank === rank);
  const template = templates[seed % templates.length];
  const titleIdx = (seed >> 4) % template.titles.length;
  const clientIdx = (seed >> 8) % template.clients.length;
  const descIdx = (seed >> 12) % template.descriptions.length;
  const { objective, templateData } = template.generateData(seed);

  return {
    id: `mission_${++missionIdCounter}_${day}`,
    rank,
    title: template.titles[titleIdx],
    client: template.clients[clientIdx],
    description: template.descriptions[descIdx],
    objective,
    postedDay: day,
    durationDays: MISSION_EXPIRY_DAYS[rank],
    templateKey: template.templateKey,
    templateData,
  };
}

function generateMission(seed: number, day: number): Mission {
  const rank = pickWeightedRank(seed);
  const templates = ALL_TEMPLATES.filter(t => t.rank === rank);
  const template = templates[seed % templates.length];
  const titleIdx = (seed >> 4) % template.titles.length;
  const clientIdx = (seed >> 8) % template.clients.length;
  const descIdx = (seed >> 12) % template.descriptions.length;

  const { objective, templateData } = template.generateData(seed);

  return {
    id: `mission_${++missionIdCounter}_${day}`,
    rank,
    title: template.titles[titleIdx],
    client: template.clients[clientIdx],
    description: template.descriptions[descIdx],
    objective,
    postedDay: day,
    durationDays: MISSION_EXPIRY_DAYS[rank],
    templateKey: template.templateKey,
    templateData,
  };
}

export function createMissionBoard(day: number, playerRank: ShinobiRank = 'genin', completedLog: Record<MissionRank, number> = { D: 0, C: 0, B: 0, A: 0 }): MissionBoard {
  const missions: Mission[] = [];
  const bestRank = getHighestAccessibleRank(playerRank, completedLog);

  // Guarantee at least 2 missions at the player's best accessible rank
  const GUARANTEED = 2;
  for (let i = 0; i < GUARANTEED; i++) {
    const seed = cellHash(day * 1000 + i, day * 7 + i * 31);
    missions.push(generateMissionOfRank(seed, day, bestRank));
  }

  // Fill remaining slots with weighted random ranks
  for (let i = GUARANTEED; i < BOARD_SIZE; i++) {
    const seed = cellHash(day * 1000 + i, day * 7 + i * 31);
    missions.push(generateMission(seed, day));
  }

  return { missions, lastRefreshDay: day };
}

export function refreshMissionBoard(board: MissionBoard, currentDay: number, playerRank: ShinobiRank = 'genin', completedLog: Record<MissionRank, number> = { D: 0, C: 0, B: 0, A: 0 }): void {
  if (currentDay <= board.lastRefreshDay) return;

  board.missions = board.missions.filter(m => {
    const expiryDay = m.postedDay + m.durationDays;
    return currentDay <= expiryDay;
  });

  // Ensure at least 2 of the player's best accessible rank on the board
  const bestRank = getHighestAccessibleRank(playerRank, completedLog);
  const accessibleCount = board.missions.filter(m => m.rank === bestRank).length;
  let slotIdx = board.missions.length;
  let needed = Math.max(0, 2 - accessibleCount);

  while (board.missions.length < BOARD_SIZE) {
    const seed = cellHash(currentDay * 1000 + slotIdx, currentDay * 13 + slotIdx * 37);
    if (needed > 0) {
      board.missions.push(generateMissionOfRank(seed, currentDay, bestRank));
      needed--;
    } else {
      board.missions.push(generateMission(seed, currentDay));
    }
    slotIdx++;
  }

  board.lastRefreshDay = currentDay;
}

export function createMissionLog(): MissionLog {
  return { active: null, completed: { D: 0, C: 0, B: 0, A: 0 }, totalCompleted: 0 };
}

// ── MISSION LIFECYCLE ──

/** Accept a mission. For search missions, spawns the search target entity. */
export function acceptMission(log: MissionLog, board: MissionBoard, missionId: string, world?: World): Mission | null {
  const idx = board.missions.findIndex(m => m.id === missionId);
  if (idx < 0) return null;

  const mission = board.missions[idx];
  board.missions.splice(idx, 1);

  const progress: Record<string, unknown> = {};

  // Search missions: spawn the target entity in the village
  if (mission.templateKey === 'search' && world) {
    const sx = mission.templateData.spawnX as number;
    const sy = mission.templateData.spawnY as number;
    const sprite = mission.templateData.searchSprite as string;
    const targetName = mission.templateData.searchTarget as string;

    const eid = world.createEntity();
    world.setPosition(eid, { x: sx, y: sy, facing: 's' });
    world.renderables.set(eid, { spriteId: sprite, layer: 'object', offsetY: -14 });
    world.blockings.set(eid, { blocksMovement: false, blocksSight: false });
    world.names.set(eid, { display: targetName, article: '' });
    world.objectSheets.set(eid, {
      description: `This is ${targetName}! Collect it to complete your mission.`,
      category: 'object',
    });
    world.interactables.set(eid, { interactionType: 'examine', label: 'Collect' });

    progress.searchEntityId = eid;
  }

  // Patrol missions: initialize visited array
  if (mission.templateKey === 'patrol') {
    const waypoints = mission.templateData.waypoints as Array<{ x: number; y: number; label: string }>;
    progress.visited = waypoints.map(() => false);
    progress.visitedCount = 0;
    progress.totalWaypoints = waypoints.length;
  }

  log.active = {
    mission,
    acceptedDay: mission.postedDay,
    progress,
    objectiveComplete: false,
    reported: false,
  };

  return mission;
}

/** Report mission completion at the mission desk */
export function reportMission(log: MissionLog): Mission | null {
  if (!log.active || !log.active.objectiveComplete) return null;

  const mission = log.active.mission;
  log.completed[mission.rank]++;
  log.totalCompleted++;
  log.active = null;

  return mission;
}

/** Abandon the active mission */
export function abandonMission(log: MissionLog, world?: World): void {
  if (!log.active) return;

  // Clean up search entity if it exists
  if (log.active.progress.searchEntityId && world) {
    const eid = log.active.progress.searchEntityId as number;
    world.removeEntity(eid);
  }

  log.active = null;
}

// ── MISSION PROGRESS ──

/** Proximity threshold for patrol waypoints and area checks */
const WAYPOINT_RADIUS = 3;

/**
 * Process a mission event. Returns a log message if progress was made, or null.
 * Call this from interaction handlers and the turn system.
 */
export function processMissionEvent(log: MissionLog, event: MissionEvent, world?: World): string | null {
  if (!log.active || log.active.objectiveComplete) return null;

  const active = log.active;
  const mission = active.mission;

  switch (mission.templateKey) {
    case 'delivery': {
      if (event.type === 'interact_npc') {
        const targetNpc = mission.templateData.targetNpc as string;
        if (event.npcName === targetNpc) {
          active.objectiveComplete = true;
          return `Package delivered to ${targetNpc}! Return to the Mission Desk to report.`;
        }
      }
      break;
    }

    case 'search': {
      if (event.type === 'collect_entity') {
        const searchEntityId = active.progress.searchEntityId as number | undefined;
        if (searchEntityId !== undefined && event.entityId === searchEntityId) {
          // Remove the entity from the world
          if (world) world.removeEntity(searchEntityId);
          active.progress.searchEntityId = null;
          active.objectiveComplete = true;
          const targetName = mission.templateData.searchTarget as string;
          return `Found ${targetName}! Return to the Mission Desk to report.`;
        }
      }
      break;
    }

    case 'patrol': {
      if (event.type === 'reach_area') {
        const waypoints = mission.templateData.waypoints as Array<{ x: number; y: number; label: string }>;
        const visited = active.progress.visited as boolean[];

        for (let i = 0; i < waypoints.length; i++) {
          if (visited[i]) continue;
          const wp = waypoints[i];
          const dx = event.x - wp.x;
          const dy = event.y - wp.y;
          if (dx * dx + dy * dy <= WAYPOINT_RADIUS * WAYPOINT_RADIUS) {
            visited[i] = true;
            active.progress.visitedCount = (active.progress.visitedCount as number) + 1;

            if (active.progress.visitedCount === waypoints.length) {
              active.objectiveComplete = true;
              return `All checkpoints visited! Return to the Mission Desk to report.`;
            }
            return `Checkpoint reached: ${wp.label} (${active.progress.visitedCount}/${waypoints.length})`;
          }
        }
      }
      break;
    }
  }

  return null;
}

/** Check patrol progress on player movement (call each turn) */
export function checkPatrolProgress(log: MissionLog, playerX: number, playerY: number): string | null {
  if (!log.active || log.active.objectiveComplete) return null;
  if (log.active.mission.templateKey !== 'patrol') return null;

  return processMissionEvent(log, { type: 'reach_area', x: playerX, y: playerY });
}

// ── HELPERS ──

export function getGameDay(gameTimeSeconds: number): number {
  return Math.floor(gameTimeSeconds / 86400) + 1;
}

export function getMissionXpMultiplier(log: MissionLog): number {
  return log.active && !log.active.objectiveComplete ? 2 : 1;
}

/** Get a human-readable status for the active mission */
export function getActiveMissionStatus(log: MissionLog): string | null {
  if (!log.active) return null;
  const m = log.active.mission;

  if (log.active.objectiveComplete) {
    return `${m.title} — COMPLETE — Report to Mission Desk`;
  }

  if (m.templateKey === 'patrol') {
    const count = log.active.progress.visitedCount as number ?? 0;
    const total = log.active.progress.totalWaypoints as number ?? 0;
    return `${m.title} — ${count}/${total} checkpoints`;
  }

  return `${m.title} — ${m.objective}`;
}

// ── RANK DISPLAY ──

export const RANK_COLORS: Record<MissionRank, string> = {
  D: '#5b8c5a',
  C: '#4a7fb5',
  B: '#c9a84c',
  A: '#b22234',
};

export const RANK_LABELS: Record<MissionRank, string> = {
  D: 'D-Rank',
  C: 'C-Rank',
  B: 'B-Rank',
  A: 'A-Rank',
};
