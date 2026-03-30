/**
 * Squad system — manages the persistent shinobi roster, squad assignment,
 * member generation, injury/death tracking, and mission integration.
 *
 * The roster starts with 4 shinobi (2 genin, 2 chuunin) and grows as
 * the player completes missions. Dead members are eventually replaced.
 */

import type { SquadMember, SquadRoster, SquadPersonality, MissionSquad, SquadROE } from '../types/squad.ts';
import type { ShinobiRank, CharacterSkills, CharacterStats } from '../types/character.ts';
import type { CharacterAccents } from '../sprites/characters.ts';
import type { MissionRank } from './missions.ts';

// ── NAME POOLS ──

const MALE_FIRST_NAMES = [
  'Kaito', 'Haruto', 'Sora', 'Ren', 'Yuto', 'Daichi', 'Riku', 'Shota',
  'Hayato', 'Taku', 'Isamu', 'Koji', 'Makoto', 'Naoki', 'Shiro', 'Akira',
  'Ryota', 'Kazuki', 'Tatsuya', 'Kenji', 'Minato', 'Yuji', 'Shinji',
  'Hisoka', 'Tetsuo', 'Noboru', 'Genta', 'Fumio', 'Kosuke', 'Masato',
];

const FEMALE_FIRST_NAMES = [
  'Yuki', 'Aoi', 'Hana', 'Sakura', 'Mio', 'Rin', 'Akane', 'Ayame',
  'Chihiro', 'Emi', 'Fumiko', 'Hikari', 'Izumi', 'Karin', 'Mei', 'Natsuki',
  'Sayuri', 'Tamaki', 'Yoshino', 'Midori', 'Kasumi', 'Hotaru', 'Tsukiko',
  'Koharu', 'Suzume', 'Shizuka', 'Noriko', 'Miho', 'Reiko', 'Tsubasa',
];

const FAMILY_NAMES = [
  'Yamada', 'Tanaka', 'Sato', 'Suzuki', 'Takahashi', 'Watanabe', 'Ito',
  'Kobayashi', 'Nakamura', 'Aoki', 'Hayashi', 'Matsumoto', 'Inoue',
  'Kimura', 'Shimizu', 'Yamazaki', 'Mori', 'Abe', 'Ikeda', 'Hashimoto',
  'Fujita', 'Ogawa', 'Goto', 'Hasegawa', 'Okada', 'Kondo', 'Ishii',
];

const PERSONALITIES: SquadPersonality[] = ['stoic', 'eager', 'cautious', 'fierce', 'calm'];

const TITLES_BY_RANK: Record<ShinobiRank, string[]> = {
  civilian: ['Volunteer'],
  academy_student: ['Student'],
  genin: ['Genin', 'Konoha Genin', 'Leaf Genin'],
  chuunin: ['Chunin', 'Konoha Chunin', 'Field Chunin'],
  special_jounin: ['Special Jonin', 'Specialist'],
  jounin: ['Jonin', 'Konoha Jonin', 'Elite Jonin'],
  anbu: ['ANBU Operative'],
  kage: ['Kage'],
};

// ── GENERATION ──

/** Simple seeded random for roster generation (separate from mission seed) */
let _rosterSeed = 42;
function rosterRand(): number {
  _rosterSeed = (_rosterSeed * 1664525 + 1013904223) & 0xFFFFFFFF;
  return (_rosterSeed >>> 0) / 0xFFFFFFFF;
}
function rosterRandInt(min: number, max: number): number {
  return min + Math.floor(rosterRand() * (max - min + 1));
}

/** Seed the roster RNG (call once with missionSalt) */
export function seedRosterRng(salt: number): void {
  _rosterSeed = salt ^ 0xDEADBEEF;
}

function pickRandom<T>(arr: T[]): T {
  return arr[rosterRandInt(0, arr.length - 1)];
}

function generateAccents(female: boolean): CharacterAccents {
  // Konoha ninja: blue headband, varied hair/eyes
  return {
    hair: [30 + rosterRandInt(0, 60), 25 + rosterRandInt(0, 40), 20 + rosterRandInt(0, 30)],
    headband: [26, 58, 92], // Konoha blue
    pupil: [25 + rosterRandInt(0, 40), 25 + rosterRandInt(0, 35), 25 + rosterRandInt(0, 35)],
    belt: [60 + rosterRandInt(0, 40), 50 + rosterRandInt(0, 30), 40 + rosterRandInt(0, 20)],
    beltHighlight: [90 + rosterRandInt(0, 40), 70 + rosterRandInt(0, 30), 55 + rosterRandInt(0, 20)],
    outfitDark: female
      ? [25 + rosterRandInt(0, 15), 20 + rosterRandInt(0, 12), 30 + rosterRandInt(0, 15)]
      : undefined,
    outfitMid: female
      ? [35 + rosterRandInt(0, 15), 30 + rosterRandInt(0, 12), 40 + rosterRandInt(0, 15)]
      : undefined,
  };
}

function generateSkills(rank: ShinobiRank): CharacterSkills {
  switch (rank) {
    case 'genin':
      return {
        taijutsu: rosterRandInt(8, 18),
        bukijutsu: rosterRandInt(5, 14),
        ninjutsu: rosterRandInt(4, 12),
        genjutsu: rosterRandInt(1, 5),
        med: rosterRandInt(1, 4),
      };
    case 'chuunin':
      return {
        taijutsu: rosterRandInt(22, 38),
        bukijutsu: rosterRandInt(15, 28),
        ninjutsu: rosterRandInt(18, 32),
        genjutsu: rosterRandInt(5, 15),
        med: rosterRandInt(3, 12),
      };
    case 'jounin':
    case 'special_jounin':
      return {
        taijutsu: rosterRandInt(40, 58),
        bukijutsu: rosterRandInt(30, 45),
        ninjutsu: rosterRandInt(35, 52),
        genjutsu: rosterRandInt(12, 28),
        med: rosterRandInt(8, 20),
      };
    default:
      return { taijutsu: 5, bukijutsu: 3, ninjutsu: 2, genjutsu: 1, med: 1 };
  }
}

function generateStats(rank: ShinobiRank): CharacterStats {
  switch (rank) {
    case 'genin':
      return { phy: rosterRandInt(8, 16), cha: rosterRandInt(6, 14), men: rosterRandInt(5, 12) };
    case 'chuunin':
      return { phy: rosterRandInt(16, 26), cha: rosterRandInt(14, 22), men: rosterRandInt(12, 20) };
    case 'jounin':
    case 'special_jounin':
      return { phy: rosterRandInt(24, 36), cha: rosterRandInt(22, 34), men: rosterRandInt(20, 30) };
    default:
      return { phy: 8, cha: 4, men: 4 };
  }
}

/** Generate a single squad member */
export function generateSquadMember(roster: SquadRoster, rank: ShinobiRank): SquadMember {
  const female = rosterRand() < 0.4;
  const firstName = female ? pickRandom(FEMALE_FIRST_NAMES) : pickRandom(MALE_FIRST_NAMES);
  const familyName = pickRandom(FAMILY_NAMES);
  const name = `${firstName} ${familyName}`;
  const titles = TITLES_BY_RANK[rank] ?? ['Shinobi'];

  const member: SquadMember = {
    id: `squad_${roster.nextMemberId++}`,
    name,
    female,
    rank,
    title: pickRandom(titles),
    skills: generateSkills(rank),
    stats: generateStats(rank),
    accents: generateAccents(female),
    status: 'available',
    recoveryTime: 0,
    missionsCompleted: 0,
    personality: pickRandom(PERSONALITIES),
  };

  return member;
}

// ── ROSTER MANAGEMENT ──

/** Create an initial roster with starter squad members */
export function createSquadRoster(salt: number): SquadRoster {
  seedRosterRng(salt);

  const roster: SquadRoster = {
    members: [],
    activeSquad: null,
    nextMemberId: 1,
  };

  // Start with 4 members: 2 genin, 2 chuunin
  roster.members.push(generateSquadMember(roster, 'genin'));
  roster.members.push(generateSquadMember(roster, 'genin'));
  roster.members.push(generateSquadMember(roster, 'chuunin'));
  roster.members.push(generateSquadMember(roster, 'chuunin'));

  return roster;
}

/** Get all available (not injured, dead, or on mission) members */
export function getAvailableMembers(roster: SquadRoster, gameTimeSeconds: number): SquadMember[] {
  // First, recover any injured members whose time is up
  for (const m of roster.members) {
    if (m.status === 'injured' && gameTimeSeconds >= m.recoveryTime) {
      m.status = 'available';
      m.recoveryTime = 0;
    }
  }
  return roster.members.filter(m => m.status === 'available');
}

/** Get recommended squad size for a mission rank */
export function getRecommendedSquadSize(rank: MissionRank): number {
  switch (rank) {
    case 'C': return 2;
    case 'B': return 3;
    case 'A': return 3;
    default: return 0; // D-rank: solo
  }
}

/** Get recommended ranks for squad members based on mission rank */
export function getRecommendedRanks(missionRank: MissionRank): ShinobiRank[] {
  switch (missionRank) {
    case 'C': return ['genin', 'genin'];
    case 'B': return ['chuunin', 'chuunin', 'genin'];
    case 'A': return ['jounin', 'chuunin', 'chuunin'];
    default: return [];
  }
}

/** Auto-assign best available members for a mission */
export function autoAssignSquad(
  roster: SquadRoster,
  missionRank: MissionRank,
  gameTimeSeconds: number,
): MissionSquad | null {
  const size = getRecommendedSquadSize(missionRank);
  if (size === 0) return null;

  const available = getAvailableMembers(roster, gameTimeSeconds);
  if (available.length === 0) return null;

  // Sort by combat strength (taijutsu + ninjutsu) descending
  const sorted = [...available].sort((a, b) =>
    (b.skills.taijutsu + b.skills.ninjutsu) - (a.skills.taijutsu + a.skills.ninjutsu)
  );

  // Pick up to `size` members
  const picked = sorted.slice(0, Math.min(size, sorted.length));

  return {
    memberIds: picked.map(m => m.id),
    roe: 'defensive',
  };
}

/** Mark assigned members as on_mission */
export function deploySquad(roster: SquadRoster, squad: MissionSquad): void {
  roster.activeSquad = squad;
  for (const id of squad.memberIds) {
    const m = roster.members.find(s => s.id === id);
    if (m) m.status = 'on_mission';
  }
}

/** After mission: process injuries/deaths, return survivors */
export function returnSquadFromMission(
  roster: SquadRoster,
  casualties: Map<string, 'dead' | 'injured'>,
  gameTimeSeconds: number,
): void {
  if (!roster.activeSquad) return;

  for (const id of roster.activeSquad.memberIds) {
    const member = roster.members.find(m => m.id === id);
    if (!member) continue;

    const casualty = casualties.get(id);
    if (casualty === 'dead') {
      member.status = 'dead';
    } else if (casualty === 'injured') {
      member.status = 'injured';
      // Recovery: 1-3 in-game days
      const recoveryDays = 1 + Math.floor(Math.random() * 3);
      member.recoveryTime = gameTimeSeconds + recoveryDays * 86400;
    } else {
      member.status = 'available';
      member.missionsCompleted++;
    }
  }

  roster.activeSquad = null;

  // Replace dead members with new recruits (keep roster at minimum 4)
  const alive = roster.members.filter(m => m.status !== 'dead');
  while (alive.length < 4) {
    const rank: ShinobiRank = Math.random() < 0.5 ? 'genin' : 'chuunin';
    const newMember = generateSquadMember(roster, rank);
    roster.members.push(newMember);
    alive.push(newMember);
  }
}

/** Get squad member by ID */
export function getSquadMember(roster: SquadRoster, memberId: string): SquadMember | undefined {
  return roster.members.find(m => m.id === memberId);
}

/** Toggle ROE for the active squad */
export function toggleROE(roster: SquadRoster): SquadROE {
  if (!roster.activeSquad) return 'defensive';
  roster.activeSquad.roe = roster.activeSquad.roe === 'aggressive' ? 'defensive' : 'aggressive';
  return roster.activeSquad.roe;
}

/** Get current ROE */
export function getCurrentROE(roster: SquadRoster): SquadROE {
  return roster.activeSquad?.roe ?? 'defensive';
}

// ── SPEECH BUBBLE LINES BY PERSONALITY ──

export const SQUAD_COMBAT_LINES: Record<SquadPersonality, {
  spot: string[];
  engage: string[];
  hit: string[];
  flee: string[];
  kill: string[];
  defend: string[];
}> = {
  stoic: {
    spot: ['...', 'Enemy.', 'Spotted.'],
    engage: ['Engaging.', 'On it.', 'Moving in.'],
    hit: ['Tch.', 'Ngh.', '...'],
    flee: ['Retreating.', 'Pulling back.', 'Not worth it.'],
    kill: ['Done.', 'Target down.', 'Eliminated.'],
    defend: ['Stay behind me.', 'I\'ll handle this.'],
  },
  eager: {
    spot: ['There!', 'I see one!', 'Enemy spotted!'],
    engage: ['Let\'s go!', 'I\'ve got this!', 'Watch me!'],
    hit: ['Ow!', 'That hurt!', 'Hey!'],
    flee: ['Too many!', 'We gotta go!', 'Fall back!'],
    kill: ['Yeah!', 'Got one!', 'Take that!'],
    defend: ['I\'ll protect you!', 'Behind me!'],
  },
  cautious: {
    spot: ['Careful...', 'Movement ahead.', 'Hold on...'],
    engage: ['Stay alert.', 'Watch your flanks.', 'Together now.'],
    hit: ['Gah!', 'They\'re strong...', 'Be careful!'],
    flee: ['We need to go!', 'This isn\'t working!', 'Too risky!'],
    kill: ['One down.', 'Stay focused.', 'Don\'t relax yet.'],
    defend: ['Watch yourself!', 'Stay close!'],
  },
  fierce: {
    spot: ['Found you!', 'There they are!', 'Prey spotted!'],
    engage: ['Come on!', 'You\'re mine!', 'Fight me!'],
    hit: ['Is that all?!', 'Grr!', 'You\'ll pay for that!'],
    flee: ['Tch... next time!', 'This isn\'t over!', 'I\'ll remember this!'],
    kill: ['Too easy!', 'Next!', 'Who else wants some?!'],
    defend: ['Nobody touches the team leader!', 'Over my dead body!'],
  },
  calm: {
    spot: ['Mm. Contact.', 'Eyes up.', 'There.'],
    engage: ['Here we go.', 'Engaging calmly.', 'Steady.'],
    hit: ['Hmph.', 'I\'m fine.', 'Nothing serious.'],
    flee: ['Time to regroup.', 'Fall back.', 'Live to fight another day.'],
    kill: ['Down.', 'One less.', 'Moving on.'],
    defend: ['I\'ve got your back.', 'Don\'t worry about me.'],
  },
};
