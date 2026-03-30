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
  | { type: 'collect_entity'; entityId: number }
  | { type: 'target_killed'; entityId: number }
  | { type: 'target_captured'; entityId: number }
  | { type: 'trophy_collected' }
  | { type: 'reached_extraction'; x: number; y: number };

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
  B: { minRank: 'chuunin', minPrevCompleted: 10, prevRank: 'C' },
  A: { minRank: 'jounin', minPrevCompleted: 15, prevRank: 'B' },
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

  // Previous mission requirements only apply at the minimum rank tier
  // Higher-ranked shinobi bypass the grind (e.g., chuunin+ skip the 15 D-rank requirement for C-rank)
  if (req.prevRank && playerIdx <= reqIdx && completedLog[req.prevRank] < req.minPrevCompleted) {
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
      { name: 'a child\'s wooden kunai', sprite: 'obj_scroll_case' },
      { name: 'a runaway chicken', sprite: 'obj_bush_flower' },
      { name: 'a dropped scroll case', sprite: 'obj_scroll_case' },
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

// ══════════════════════════════════════
//  C-RANK TEMPLATES — Away missions
// ══════════════════════════════════════

import { getCRankDestinations, getBRankDestinations, getARankDestinations } from '../overmap/overmapData.ts';
import type { CRankMissionData } from '../types/awayMission.ts';
import type { EnemyType } from '../types/awayMission.ts';

/** Bandit leader names for procedural generation */
const BANDIT_LEADER_NAMES = [
  'Goro the Scarred', 'Tetsu Iron Fist', 'Kenta the Viper', 'Ryuma Shadow Blade',
  'Masa the Butcher', 'Shin Red Hand', 'Nobu the Jackal', 'Takeo Thunderstrike',
  'Ganryu One-Eye', 'Sabu the Serpent', 'Hachi Stone Wall', 'Kumaji the Fox',
];

const TROPHY_ITEMS = [
  'a signet ring bearing the gang\'s mark',
  'a blood-stained ledger of stolen goods',
  'an engraved dagger used as proof of authority',
  'a distinctive tattoo sketch matching the bounty poster',
  'a sealed letter with orders from a crime lord',
];

const C_RANK_CLIENTS = [
  'Lord Matsuda, a provincial magistrate',
  'A merchant guild representative',
  'A border village elder',
  'The Fire Country trade commission',
  'A caravan master from Tanzaku',
  'Lord Hayashi, a rice paddy landowner',
  'A teamster union foreman',
  'The Otafuku town council',
];

const C_RANK_BANDIT_CAPTURE: MissionTemplate = {
  rank: 'C',
  titles: ['Bandit Apprehension', 'Outlaw Roundup', 'Highway Robbers', 'Bandit Deterrence', 'Criminal Pursuit'],
  clients: C_RANK_CLIENTS,
  descriptions: [
    'A group of bandits has been terrorizing travelers on the trade routes. The local authorities want them captured alive for trial.',
    'Highwaymen have been ambushing merchants near a remote village. They need to be subdued and restrained.',
    'Bandits have set up camp near a trade route. The client wants them neutralized without unnecessary bloodshed.',
  ],
  templateKey: 'c_bandit_capture',
  generateData: (seed) => {
    const destinations = getCRankDestinations();
    const dest = destinations[seed % destinations.length];
    const leaderName = BANDIT_LEADER_NAMES[seed % BANDIT_LEADER_NAMES.length];
    const trophy = TROPHY_ITEMS[(seed >> 4) % TROPHY_ITEMS.length];
    const banditCount = 3 + (seed % 4); // 3-6 bandits

    const data: CRankMissionData = {
      missionType: 'bandit_capture',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: C_RANK_CLIENTS[(seed >> 8) % C_RANK_CLIENTS.length],
      trophyItem: trophy,
      banditCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 7),
      terrainType: 'forest',
      hasCamp: true,
    };

    return {
      objective: `Travel to ${dest.name}, locate ${leaderName}'s bandit camp, capture the leader, and return with proof.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

const C_RANK_GANG_ELIMINATION: MissionTemplate = {
  rank: 'C',
  titles: ['Threat Elimination', 'Gang Suppression', 'Bounty Hunt', 'Road Security', 'HVT Neutralization'],
  clients: C_RANK_CLIENTS,
  descriptions: [
    'A dangerous gang leader has been ambushing caravans and killing travelers. A local lord wants him permanently dealt with.',
    'Reports indicate a gang has established a base of operations near a trade route. The target must be eliminated.',
    'A bounty has been placed on a bandit leader who has grown too bold. Lethal force is authorized.',
  ],
  templateKey: 'c_gang_elimination',
  generateData: (seed) => {
    const destinations = getCRankDestinations();
    const dest = destinations[seed % destinations.length];
    const leaderName = BANDIT_LEADER_NAMES[(seed + 3) % BANDIT_LEADER_NAMES.length];
    const trophy = TROPHY_ITEMS[(seed >> 4) % TROPHY_ITEMS.length];
    const banditCount = 4 + (seed % 5); // 4-8 bandits

    const data: CRankMissionData = {
      missionType: 'gang_elimination',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: C_RANK_CLIENTS[(seed >> 8) % C_RANK_CLIENTS.length],
      trophyItem: trophy,
      banditCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 13),
      terrainType: 'forest',
      hasCamp: true,
    };

    return {
      objective: `Travel to the area near ${dest.name}, eliminate ${leaderName} and his gang, and return with proof.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

const C_RANK_ESCORT: MissionTemplate = {
  rank: 'C',
  titles: ['Escort Duty', 'Safe Passage', 'Trade Escort', 'VIP Protection', 'Caravan Guard'],
  clients: C_RANK_CLIENTS,
  descriptions: [
    'A merchant needs safe escort through bandit territory. Expect ambushes along the route.',
    'A minor official requires protection traveling to a remote outpost. Intelligence suggests bandits are active in the area.',
    'A supply caravan is traveling through dangerous territory and needs shinobi escort.',
  ],
  templateKey: 'c_escort',
  generateData: (seed) => {
    const destinations = getCRankDestinations();
    const dest = destinations[seed % destinations.length];
    const leaderName = BANDIT_LEADER_NAMES[(seed + 7) % BANDIT_LEADER_NAMES.length];
    const banditCount = 3 + (seed % 3); // 3-5 bandits (ambush party)

    const data: CRankMissionData = {
      missionType: 'escort',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: C_RANK_CLIENTS[(seed >> 8) % C_RANK_CLIENTS.length],
      trophyItem: 'n/a',
      banditCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 17),
      terrainType: 'forest',
      hasCamp: false, // ambush, no camp
    };

    return {
      objective: `Escort the client safely to ${dest.name}. Expect bandit ambushes. Eliminate threats and ensure safe arrival.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

// ══════════════════════════════════════
//  B-RANK TEMPLATES — Rogue nin operations
// ══════════════════════════════════════

const B_RANK_CLIENTS = [
  'Classified',
  'Lord Nobunaga, governor of the northern province',
  'The Fire Daimyo\'s trade minister',
  'An allied village liaison',
  'Konoha Intelligence Division',
  'A provincial governor under threat',
  'The Fire Country border patrol command',
];

/** Rogue nin names — higher profile than bandits */
const ROGUE_NIN_NAMES = [
  'Kagero the Phantom', 'Ushio of the Mist', 'Genma the Silent',
  'Hayato Wind Cutter', 'Suzume Bell Ringer', 'Aoba Murasaki',
  'Tsubaki the Betrayer', 'Enrai Lightning Fang', 'Yakumo the Alchemist',
  'Kurogane the Iron', 'Jinpachi Shark Tooth', 'Mukuro the Faceless',
];

const B_RANK_ENCAMPMENT: MissionTemplate = {
  rank: 'B',
  titles: ['Enemy Encampment', 'Rogue Nin Hideout', 'Forward Base Assault', 'Camp Elimination', 'Hostile Stronghold'],
  clients: B_RANK_CLIENTS,
  descriptions: [
    'Intelligence reports a group of rogue ninja have established a forward base. They must be eliminated before they stage attacks on Fire Country settlements.',
    'Rogue ninja have been spotted establishing a camp near a key trade route. Chuunin-level response required.',
    'A group of defectors from a minor village have set up operations within Fire Country borders. Deal with them.',
  ],
  templateKey: 'b_encampment_assault',
  generateData: (seed) => {
    const destinations = getBRankDestinations();
    const dest = destinations[seed % destinations.length];
    const leaderName = ROGUE_NIN_NAMES[seed % ROGUE_NIN_NAMES.length];
    const trophy = TROPHY_ITEMS[(seed >> 4) % TROPHY_ITEMS.length];
    const enemyCount = 4 + (seed % 4); // 4-7 rogue nin

    const data: CRankMissionData = {
      missionType: 'encampment_assault',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: B_RANK_CLIENTS[(seed >> 8) % B_RANK_CLIENTS.length],
      trophyItem: trophy,
      banditCount: enemyCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 19),
      terrainType: 'forest',
      hasCamp: true,
      enemyType: 'rogue_nin' as EnemyType,
    };

    return {
      objective: `Travel to ${dest.name}, assault ${leaderName}'s hideout, eliminate the rogue nin, and return with proof.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

const B_RANK_ASSET_RECOVERY: MissionTemplate = {
  rank: 'B',
  titles: ['Asset Recovery', 'Stolen Scroll Retrieval', 'Intel Extraction', 'Supply Interdiction', 'Contraband Seizure'],
  clients: B_RANK_CLIENTS,
  descriptions: [
    'Classified documents were stolen by rogue ninja. Recover the assets and neutralize the thieves.',
    'A vital supply shipment was intercepted by rogue operatives. Retrieve the cargo and deal with anyone guarding it.',
    'Stolen jutsu scrolls have been traced to a rogue nin camp. Recovery is the primary objective — elimination is authorized.',
  ],
  templateKey: 'b_asset_recovery',
  generateData: (seed) => {
    const destinations = getBRankDestinations();
    const dest = destinations[(seed + 3) % destinations.length];
    const leaderName = ROGUE_NIN_NAMES[(seed + 5) % ROGUE_NIN_NAMES.length];
    const trophy = TROPHY_ITEMS[(seed >> 4) % TROPHY_ITEMS.length];
    const enemyCount = 3 + (seed % 4); // 3-6 rogue nin

    const data: CRankMissionData = {
      missionType: 'asset_recovery',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: B_RANK_CLIENTS[(seed >> 8) % B_RANK_CLIENTS.length],
      trophyItem: trophy,
      banditCount: enemyCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 23),
      terrainType: 'forest',
      hasCamp: true,
      enemyType: 'rogue_nin' as EnemyType,
    };

    return {
      objective: `Locate ${leaderName}'s camp near ${dest.name}, recover the stolen assets, and eliminate resistance.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

const B_RANK_INFILTRATION: MissionTemplate = {
  rank: 'B',
  titles: ['Infiltration Op', 'Covert Assault', 'Shadow Strike', 'Silent Elimination', 'Night Raid'],
  clients: B_RANK_CLIENTS,
  descriptions: [
    'A rogue nin leader has information vital to village security. Infiltrate their position and extract them — dead or alive.',
    'Covert operation to neutralize a rogue nin cell before they can carry out planned attacks. Stealth is recommended.',
    'A high-priority target has been located. Move in quietly — they\'re dangerous and likely to flee if alerted.',
  ],
  templateKey: 'b_infiltration',
  generateData: (seed) => {
    const destinations = getBRankDestinations();
    const dest = destinations[(seed + 7) % destinations.length];
    const leaderName = ROGUE_NIN_NAMES[(seed + 2) % ROGUE_NIN_NAMES.length];
    const trophy = TROPHY_ITEMS[(seed >> 4) % TROPHY_ITEMS.length];
    const enemyCount = 3 + (seed % 3); // 3-5 (smaller group, stealthier mission)

    const data: CRankMissionData = {
      missionType: 'infiltration',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: B_RANK_CLIENTS[(seed >> 8) % B_RANK_CLIENTS.length],
      trophyItem: trophy,
      banditCount: enemyCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 29),
      terrainType: 'forest',
      hasCamp: true,
      enemyType: 'rogue_nin' as EnemyType,
    };

    return {
      objective: `Infiltrate ${leaderName}'s position near ${dest.name}, neutralize the target, and extract with proof.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

// ══════════════════════════════════════
//  A-RANK TEMPLATES — Missing-nin operations
// ══════════════════════════════════════

const A_RANK_CLIENTS = [
  'Classified',
  'The Fire Daimyo himself',
  'Konoha ANBU Command',
  'The Hokage\'s direct order',
  'Allied Kage Summit Council',
  'Fire Country National Defense',
];

/** Missing-nin names — elite threats */
const MISSING_NIN_NAMES = [
  'Dokuen the Serpent King', 'The Butcher of the Hidden Mist', 'Kirimaru the Headsman',
  'Fudo the Undying', 'Kanegawa Gold Thread', 'Kuguri the Puppeteer',
  'Bakudan the Mad Bomber', 'Karasu the Crow', 'Shura the Herald',
  'Origami the Paper Wraith', 'Samehada the Tailless', 'Kairai the Hollow',
];

const A_RANK_ROGUE_PURSUIT: MissionTemplate = {
  rank: 'A',
  titles: ['Rogue Nin Pursuit', 'Missing-Nin Hunt', 'S-Class Bounty', 'High-Value Target', 'Bingo Book Assignment'],
  clients: A_RANK_CLIENTS,
  descriptions: [
    'A dangerous missing-nin from the bingo book has been sighted. Jonin-level combat is expected. Eliminate or capture at your discretion.',
    'An S-class threat has been located. Approach with extreme caution — this target has killed before and will kill again.',
    'A former shinobi gone rogue has amassed followers and is operating dangerously close to Fire Country. End the threat.',
  ],
  templateKey: 'a_rogue_pursuit',
  generateData: (seed) => {
    const destinations = getARankDestinations();
    const dest = destinations[seed % destinations.length];
    const leaderName = MISSING_NIN_NAMES[seed % MISSING_NIN_NAMES.length];
    const trophy = TROPHY_ITEMS[(seed >> 4) % TROPHY_ITEMS.length];
    const enemyCount = 5 + (seed % 5); // 5-9 enemies (missing-nin + followers)

    const data: CRankMissionData = {
      missionType: 'rogue_nin_pursuit',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: A_RANK_CLIENTS[(seed >> 8) % A_RANK_CLIENTS.length],
      trophyItem: trophy,
      banditCount: enemyCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 37),
      terrainType: (seed % 3 === 0) ? 'rocky' : 'forest',
      hasCamp: true,
      enemyType: 'missing_nin' as EnemyType,
    };

    return {
      objective: `Hunt down ${leaderName} near ${dest.name}. Neutralize the target and all hostile forces. Return with proof.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

const A_RANK_THREAT_RESPONSE: MissionTemplate = {
  rank: 'A',
  titles: ['Threat Response', 'Border Crisis', 'Emergency Deployment', 'Imminent Threat', 'Crisis Intervention'],
  clients: A_RANK_CLIENTS,
  descriptions: [
    'An organized force of missing-nin is massing near a Fire Country settlement. Deploy immediately and eliminate the threat before civilians are harmed.',
    'Intelligence confirms a coordinated attack is being planned by hostile forces. Intercept and destroy their staging area.',
    'A border village has sent a distress signal. Missing-nin forces are closing in. Respond with maximum force.',
  ],
  templateKey: 'a_threat_response',
  generateData: (seed) => {
    const destinations = getARankDestinations();
    const dest = destinations[(seed + 3) % destinations.length];
    const leaderName = MISSING_NIN_NAMES[(seed + 4) % MISSING_NIN_NAMES.length];
    const trophy = TROPHY_ITEMS[(seed >> 4) % TROPHY_ITEMS.length];
    const enemyCount = 6 + (seed % 5); // 6-10 enemies (large force)

    const data: CRankMissionData = {
      missionType: 'threat_response',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: A_RANK_CLIENTS[(seed >> 8) % A_RANK_CLIENTS.length],
      trophyItem: trophy,
      banditCount: enemyCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 41),
      terrainType: 'forest',
      hasCamp: true,
      enemyType: 'missing_nin' as EnemyType,
    };

    return {
      objective: `Respond to the threat near ${dest.name}. Eliminate ${leaderName} and their forces. Ensure no survivors escape.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

const A_RANK_ASSASSINATION_PREVENTION: MissionTemplate = {
  rank: 'A',
  titles: ['Assassination Prevention', 'VIP Defense', 'Target Protection', 'Counter-Assassination', 'Shadow Guard'],
  clients: A_RANK_CLIENTS,
  descriptions: [
    'Intelligence indicates a missing-nin assassination squad is targeting a key figure. Locate them before they strike and eliminate the threat.',
    'An assassination plot has been uncovered. The kill squad is already in position. Find them, stop them, leave no loose ends.',
    'A high-value ally is marked for death by missing-nin operatives. Pre-empt the attack — find and destroy the hit squad.',
  ],
  templateKey: 'a_assassination_prevention',
  generateData: (seed) => {
    const destinations = getARankDestinations();
    const dest = destinations[(seed + 7) % destinations.length];
    const leaderName = MISSING_NIN_NAMES[(seed + 8) % MISSING_NIN_NAMES.length];
    const enemyCount = 4 + (seed % 4); // 4-7 (elite but smaller squad)

    const data: CRankMissionData = {
      missionType: 'assassination_prevention',
      targetName: leaderName,
      targetLocation: dest.id,
      targetLocationName: dest.name,
      clientName: A_RANK_CLIENTS[(seed >> 8) % A_RANK_CLIENTS.length],
      trophyItem: TROPHY_ITEMS[(seed >> 4) % TROPHY_ITEMS.length],
      banditCount: enemyCount,
      banditLeaderName: leaderName,
      mapSeed: cellHash(seed, seed * 47),
      terrainType: (seed % 2 === 0) ? 'rocky' : 'forest',
      hasCamp: false, // ambush squad, no established camp
      enemyType: 'missing_nin' as EnemyType,
    };

    return {
      objective: `Locate ${leaderName}'s kill squad near ${dest.name}. Eliminate all operatives before they reach their target.`,
      templateData: data as unknown as Record<string, unknown>,
    };
  },
};

const ALL_TEMPLATES: MissionTemplate[] = [
  D_RANK_DELIVERY, D_RANK_SEARCH, D_RANK_PATROL,
  C_RANK_BANDIT_CAPTURE, C_RANK_GANG_ELIMINATION, C_RANK_ESCORT,
  B_RANK_ENCAMPMENT, B_RANK_ASSET_RECOVERY, B_RANK_INFILTRATION,
  A_RANK_ROGUE_PURSUIT, A_RANK_THREAT_RESPONSE, A_RANK_ASSASSINATION_PREVENTION,
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

    // C-rank: bandit capture
    case 'c_bandit_capture': {
      if (event.type === 'target_captured') {
        active.progress.targetCaptured = true;
        const targetName = (mission.templateData as unknown as CRankMissionData).targetName;
        return `${targetName} has been captured! Search them for proof, then extract.`;
      }
      if (event.type === 'trophy_collected') {
        active.progress.hasTrophy = true;
        if (active.progress.targetCaptured) {
          active.objectiveComplete = true;
          return `Proof collected. Head to the map edge to extract, then return to Konoha.`;
        }
        return `You have the proof. Now capture the target.`;
      }
      break;
    }

    // C-rank: gang elimination
    case 'c_gang_elimination': {
      if (event.type === 'target_killed') {
        active.progress.targetEliminated = true;
        const targetName = (mission.templateData as unknown as CRankMissionData).targetName;
        return `${targetName} has been eliminated! Search them for proof, then extract.`;
      }
      if (event.type === 'trophy_collected') {
        active.progress.hasTrophy = true;
        if (active.progress.targetEliminated) {
          active.objectiveComplete = true;
          return `Proof collected. Head to the map edge to extract, then return to Konoha.`;
        }
        return `You have the proof. Now eliminate the target.`;
      }
      break;
    }

    // C-rank: escort
    case 'c_escort': {
      // For escort missions, objective completes when all bandits are dealt with
      // (simplified — the escort NPC is implied, not physically present)
      if (event.type === 'target_killed' || event.type === 'target_captured') {
        const banditsDown = ((active.progress.banditsDown as number) ?? 0) + 1;
        active.progress.banditsDown = banditsDown;
        const total = (mission.templateData as unknown as CRankMissionData).banditCount;
        if (banditsDown >= total) {
          active.objectiveComplete = true;
          return `All threats neutralized! The route is secure. Extract and return to Konoha.`;
        }
        return `Threat neutralized (${banditsDown}/${total}). Keep clearing the area.`;
      }
      break;
    }

    // B-rank: encampment assault — eliminate leader + collect proof
    case 'b_encampment_assault': {
      if (event.type === 'target_killed') {
        active.progress.targetEliminated = true;
        const targetName = (mission.templateData as unknown as CRankMissionData).targetName;
        return `${targetName} has been eliminated! Search them for proof, then extract.`;
      }
      if (event.type === 'trophy_collected') {
        active.progress.hasTrophy = true;
        if (active.progress.targetEliminated) {
          active.objectiveComplete = true;
          return `Proof collected. Head to the map edge to extract, then return to Konoha.`;
        }
        return `You have the proof. Now eliminate the target.`;
      }
      break;
    }

    // B-rank: asset recovery — eliminate all enemies (recover implied)
    case 'b_asset_recovery': {
      if (event.type === 'target_killed' || event.type === 'target_captured') {
        const enemiesDown = ((active.progress.enemiesDown as number) ?? 0) + 1;
        active.progress.enemiesDown = enemiesDown;
        const total = (mission.templateData as unknown as CRankMissionData).banditCount;
        if (enemiesDown >= total) {
          active.objectiveComplete = true;
          return `All hostiles neutralized! Assets secured. Extract and return to Konoha.`;
        }
        return `Hostile eliminated (${enemiesDown}/${total}). Secure the area.`;
      }
      break;
    }

    // B-rank: infiltration — eliminate leader + collect proof
    case 'b_infiltration': {
      if (event.type === 'target_killed') {
        active.progress.targetEliminated = true;
        const targetName = (mission.templateData as unknown as CRankMissionData).targetName;
        return `${targetName} neutralized! Search them for proof, then extract.`;
      }
      if (event.type === 'trophy_collected') {
        active.progress.hasTrophy = true;
        if (active.progress.targetEliminated) {
          active.objectiveComplete = true;
          return `Intelligence recovered. Extract and return to Konoha.`;
        }
        return `You have the evidence. Now eliminate the target.`;
      }
      break;
    }

    // A-rank: rogue nin pursuit — eliminate leader + collect proof
    case 'a_rogue_pursuit': {
      if (event.type === 'target_killed') {
        active.progress.targetEliminated = true;
        const targetName = (mission.templateData as unknown as CRankMissionData).targetName;
        return `${targetName} has been eliminated! Search them for proof, then extract.`;
      }
      if (event.type === 'trophy_collected') {
        active.progress.hasTrophy = true;
        if (active.progress.targetEliminated) {
          active.objectiveComplete = true;
          return `Proof collected. Extract and return to Konoha.`;
        }
        return `You have the proof. Now eliminate the target.`;
      }
      break;
    }

    // A-rank: threat response — eliminate all enemies
    case 'a_threat_response': {
      if (event.type === 'target_killed' || event.type === 'target_captured') {
        const enemiesDown = ((active.progress.enemiesDown as number) ?? 0) + 1;
        active.progress.enemiesDown = enemiesDown;
        const total = (mission.templateData as unknown as CRankMissionData).banditCount;
        if (enemiesDown >= total) {
          active.objectiveComplete = true;
          return `All hostile forces eliminated! Threat neutralized. Extract and return to Konoha.`;
        }
        return `Hostile eliminated (${enemiesDown}/${total}). Continue the assault.`;
      }
      break;
    }

    // A-rank: assassination prevention — eliminate all assassins
    case 'a_assassination_prevention': {
      if (event.type === 'target_killed' || event.type === 'target_captured') {
        const enemiesDown = ((active.progress.enemiesDown as number) ?? 0) + 1;
        active.progress.enemiesDown = enemiesDown;
        const total = (mission.templateData as unknown as CRankMissionData).banditCount;
        if (enemiesDown >= total) {
          active.objectiveComplete = true;
          return `Kill squad eliminated! The target is safe. Extract and return to Konoha.`;
        }
        return `Assassin neutralized (${enemiesDown}/${total}). Find the rest.`;
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
  if (!log.active || log.active.objectiveComplete) return 1;
  // Away missions use per-skill multipliers (handled separately in missionRewards.ts)
  // D-rank village missions use flat 2x
  return 2;
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

/** Check if a mission template requires away travel */
export function isAwayMission(templateKey: string): boolean {
  return templateKey.startsWith('c_') ||
         templateKey.startsWith('b_') ||
         templateKey.startsWith('a_');
}

/** Get the away mission data from a mission's templateData */
export function getCRankData(mission: Mission): CRankMissionData | null {
  if (!isAwayMission(mission.templateKey)) return null;
  return mission.templateData as unknown as CRankMissionData;
}

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
