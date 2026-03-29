/**
 * Village NPC spawns — population for Konoha.
 * Each NPC has position, accent, stats, dialogue, and interaction config.
 */

import type { World } from '../engine/world.ts';
import type { CharacterAccents } from '../sprites/characters.ts';
import { ACCENTS_TAKESHI, ACCENTS_ANBU } from '../sprites/characters.ts';
import { ANBU_DIALOGUE, TAKESHI_DIALOGUE } from '../engine/proximityDialogue.ts';
import { computeMaxHp } from '../engine/derivedStats.ts';
import { TG_OFFSET_X, TG_OFFSET_Y } from '../core/constants.ts';
import {
  ACCENTS_HOKAGE, ACCENTS_CHUNIN_1, ACCENTS_CHUNIN_2,
  ACCENTS_JONIN_1, ACCENTS_JONIN_2, ACCENTS_JONIN_3,
  ACCENTS_STUDENT_1, ACCENTS_STUDENT_2, ACCENTS_STUDENT_3,
  ACCENTS_CIVILIAN_1, ACCENTS_CIVILIAN_2, ACCENTS_CIVILIAN_3, ACCENTS_CIVILIAN_4,
  ACCENTS_MEDIC_1, ACCENTS_MEDIC_2,
  ACCENTS_SHOPKEEPER_1, ACCENTS_SHOPKEEPER_2,
  ACCENTS_CHEF,
} from './npcAccents.ts';

interface NpcDef {
  x: number;
  y: number;
  name: string;
  accents: CharacterAccents;
  rank: import('../types/character.ts').ShinobiRank;
  title: string;
  charClass: import('../types/character.ts').CharacterClass;
  skills: import('../types/character.ts').CharacterSkills;
  stats: import('../types/character.ts').CharacterStats;
  description: string;
  dialogue: Record<string, string[]>;
  cooldownTicks: number;
  devOnly?: boolean;
}

function spawnNpc(world: World, def: NpcDef, spritePrefix: string): void {
  const id = world.createEntity();
  const hp = computeMaxHp(def.stats);

  world.setPosition(id, { x: def.x, y: def.y, facing: 's' });
  world.renderables.set(id, { spriteId: `${spritePrefix}_s`, layer: 'character', offsetY: -16 });
  world.blockings.set(id, { blocksMovement: true, blocksSight: false });
  world.healths.set(id, { current: hp, max: hp });
  world.combatStats.set(id, {
    damage: Math.floor(def.skills.taijutsu * 0.3),
    accuracy: 50 + def.skills.taijutsu,
    evasion: Math.floor(def.skills.taijutsu * 0.3),
    attackVerb: 'strike',
  });
  world.characterSheets.set(id, {
    class: def.charClass,
    rank: def.rank,
    title: def.title,
    skills: def.skills,
    stats: def.stats,
    learnedJutsus: [],
  });
  world.names.set(id, { display: def.name, article: '' });
  world.aiControlled.set(id, { behavior: 'static' });
  world.objectSheets.set(id, { description: def.description, category: 'npc' });
  world.proximityDialogue.set(id, {
    lines: def.dialogue,
    lastSpokeTick: -100,
    cooldownTicks: def.cooldownTicks,
  });
}

// ── DIALOGUE POOLS ──

const HOKAGE_DIALOGUE: Record<string, string[]> = {
  idle: [
    'The Will of Fire burns in every shinobi of this village.',
    'Konoha has stood for generations. It will stand for many more.',
    'A Hokage protects everyone. Remember that.',
    'You remind me of someone I trained long ago.',
    'The village is peaceful today. I am grateful.',
    'Every shinobi matters. From genin to ANBU.',
    'Come see me when you are ready for a mission.',
  ],
  player_hurt: [
    'You should visit the hospital. Your health comes first.',
    'A wounded shinobi is a liability. Heal before you fight.',
  ],
  night: [
    'Even the Hokage needs rest. But the village never truly sleeps.',
    'The night watch reports all clear. For now.',
  ],
};

const GATE_GUARD_DIALOGUE: Record<string, string[]> = {
  idle: [
    'State your business, shinobi.',
    'The village is safe on my watch.',
    'No unauthorized entry. Those are the rules.',
    'Another quiet day at the gate. I prefer it that way.',
    'Keep your identification ready when leaving the village.',
    'Seen anything suspicious? Report it to the Hokage.',
  ],
  night: [
    'Night shift. Stay alert out there.',
    'The gates close at midnight. Don\'t get locked out.',
  ],
  player_hurt: [
    'You look rough. Hospital is that way, past the tower.',
  ],
};

const ACADEMY_INSTRUCTOR_DIALOGUE: Record<string, string[]> = {
  idle: [
    'Discipline is the foundation of strength.',
    'My students show promise this year.',
    'The academy produces the village\'s future. I take that seriously.',
    'Every jutsu starts with the basics. Never forget that.',
    'Practice your hand seals until they\'re muscle memory.',
  ],
  player_hurt: [
    'Training injuries are normal. Rest and return stronger.',
  ],
  dawn: [
    'Early morning classes start soon. Are you here to observe?',
  ],
};

const STUDENT_DIALOGUE: Record<string, string[]> = {
  idle: [
    'I\'m going to be Hokage someday!',
    'Sensei is so strict... but I\'m getting stronger.',
    'Did you see me do that jutsu? Pretty cool, right?',
    'I can\'t wait to graduate and go on real missions!',
    'My kunai throwing is getting better every day.',
    'Want to see my transformation jutsu? Well... almost.',
    'The academy is tough but I won\'t give up!',
  ],
  player_hurt: [
    'Whoa, are you okay? You look beat up.',
    'That looks painful. Maybe see a medic?',
  ],
};

const SHOPKEEPER_DIALOGUE: Record<string, string[]> = {
  idle: [
    'Welcome! Browse to your heart\'s content.',
    'Finest goods in all of Konoha, right here.',
    'Looking for something specific? I might have it.',
    'Business has been good since the last festival.',
    'Every shinobi needs the right tools. That\'s where I come in.',
  ],
  night: [
    'We\'re closing soon. Make your purchases quickly.',
    'Late night shopping? I respect the hustle.',
  ],
};

const VILLAGER_DIALOGUE: Record<string, string[]> = {
  idle: [
    'Beautiful day in the village.',
    'Have you tried the ramen at Konoha Kitchen? Incredible.',
    'The Hokage keeps us safe. We\'re lucky.',
    'I heard they\'re training new genin at the academy.',
    'The market has fresh produce today.',
    'Another peaceful day. I\'m grateful.',
    'The cherry blossoms are lovely this time of year.',
    'My neighbor\'s kid wants to be a shinobi. Runs in the family.',
  ],
  night: [
    'Heading home. It\'s getting late.',
    'The lanterns make the village look magical at night.',
  ],
  player_hurt: [
    'Oh my, are you alright? The hospital is nearby.',
  ],
};

const MEDIC_DIALOGUE: Record<string, string[]> = {
  idle: [
    'Chakra-based healing requires precise control.',
    'Prevention is better than cure, shinobi.',
    'The hospital sees too many training injuries.',
    'Keep your medical supplies stocked. Always.',
    'I\'ve patched up more shinobi than I can count.',
  ],
  player_hurt: [
    'Let me take a look at those wounds.',
    'You need treatment. Come inside the hospital.',
    'Those injuries won\'t heal on their own. Trust me.',
  ],
  player_bleeding: [
    'You\'re bleeding! Get in here immediately!',
    'That wound needs pressure. Now.',
  ],
};

const CHEF_DIALOGUE: Record<string, string[]> = {
  idle: [
    'One bowl of Konoha Kitchen\'s finest? Coming right up!',
    'The secret is in the broth. Simmered for twelve hours.',
    'Every shinobi needs a good meal after training.',
    'Special today: miso ramen with extra chashu!',
    'My ramen has powered shinobi for twenty years.',
  ],
  night: [
    'Kitchen\'s still open. Late night ramen is the best kind.',
  ],
};

const MISSION_DESK_DIALOGUE: Record<string, string[]> = {
  idle: [
    'Looking for a mission? Check the board.',
    'We have D-rank through A-rank available.',
    'Missions are how the village earns its keep.',
    'Complete your current mission before taking a new one.',
    'The mission board is updated daily.',
  ],
};

// ── SPAWN ALL VILLAGE NPCS ──

export function spawnVillageNpcs(world: World, devMode: boolean): void {
  const ox = TG_OFFSET_X;
  const oy = TG_OFFSET_Y;

  // ── Hokage ──
  spawnNpc(world, {
    x: 78, y: 85, name: 'Lord Hirotaka', accents: ACCENTS_HOKAGE,
    rank: 'kage', title: 'Third Hokage', charClass: 'shinobi',
    skills: { taijutsu: 85, bukijutsu: 80, ninjutsu: 95, genjutsu: 70, med: 40 },
    stats: { phy: 55, cha: 90, men: 85, soc: 90 },
    description: 'The Third Hokage, Lord Hirotaka. His kind eyes belie decades of combat experience.',
    dialogue: HOKAGE_DIALOGUE, cooldownTicks: 25,
  }, 'char_shinobi'); // Uses generic shinobi sprite for now — TODO: dynamic sprite gen

  // ── Mission Desk Chunin ──
  spawnNpc(world, {
    x: 76, y: 98, name: 'Iruma', accents: ACCENTS_CHUNIN_1,
    rank: 'chuunin', title: 'Mission Desk Operator', charClass: 'shinobi',
    skills: { taijutsu: 35, bukijutsu: 30, ninjutsu: 25, genjutsu: 15, med: 10 },
    stats: { phy: 25, cha: 20, men: 20, soc: 40 },
    description: 'A chunin staffing the mission desk. They process assignments for all ranks.',
    dialogue: MISSION_DESK_DIALOGUE, cooldownTicks: 15,
  }, 'char_shinobi');

  // ── Gate Guards ──
  spawnNpc(world, {
    x: 74, y: 150, name: 'Kotetsu', accents: ACCENTS_CHUNIN_1,
    rank: 'chuunin', title: 'Gate Guard', charClass: 'shinobi',
    skills: { taijutsu: 40, bukijutsu: 35, ninjutsu: 20, genjutsu: 10, med: 5 },
    stats: { phy: 35, cha: 18, men: 15, soc: 20 },
    description: 'One of the village gate guards. Perpetually bored but always vigilant.',
    dialogue: GATE_GUARD_DIALOGUE, cooldownTicks: 18,
  }, 'char_shinobi');

  spawnNpc(world, {
    x: 86, y: 150, name: 'Izumo', accents: ACCENTS_CHUNIN_2,
    rank: 'chuunin', title: 'Gate Guard', charClass: 'shinobi',
    skills: { taijutsu: 38, bukijutsu: 32, ninjutsu: 22, genjutsu: 12, med: 5 },
    stats: { phy: 32, cha: 20, men: 18, soc: 22 },
    description: 'The other gate guard. More talkative than his partner.',
    dialogue: GATE_GUARD_DIALOGUE, cooldownTicks: 18,
  }, 'char_shinobi');

  // ── Academy Instructor ──
  spawnNpc(world, {
    x: 65, y: 14, name: 'Daikichi-sensei', accents: ACCENTS_JONIN_3,
    rank: 'jounin', title: 'Academy Instructor', charClass: 'shinobi',
    skills: { taijutsu: 50, bukijutsu: 45, ninjutsu: 55, genjutsu: 30, med: 15 },
    stats: { phy: 35, cha: 40, men: 35, soc: 50 },
    description: 'The academy instructor. A scar runs across his nose — proof of real combat experience.',
    dialogue: ACADEMY_INSTRUCTOR_DIALOGUE, cooldownTicks: 20,
  }, 'char_shinobi');

  // ── Academy Students ──
  const studentPos = [
    { x: 62, y: 24 }, { x: 64, y: 26 }, { x: 66, y: 23 },
    { x: 68, y: 25 }, { x: 70, y: 24 }, { x: 63, y: 27 },
  ];
  const studentAccents = [ACCENTS_STUDENT_1, ACCENTS_STUDENT_2, ACCENTS_STUDENT_3];
  const studentNames = ['Ren', 'Yuki', 'Sora', 'Hana', 'Kai', 'Miki'];
  for (let i = 0; i < studentPos.length; i++) {
    spawnNpc(world, {
      x: studentPos[i].x, y: studentPos[i].y,
      name: studentNames[i], accents: studentAccents[i % studentAccents.length],
      rank: 'academy_student', title: 'Academy Student', charClass: 'shinobi',
      skills: { taijutsu: 5 + i, bukijutsu: 3, ninjutsu: 2, genjutsu: 1, med: 1 },
      stats: { phy: 8 + i, cha: 5, men: 4, soc: 8 },
      description: 'A young academy student, eager to learn the ways of the shinobi.',
      dialogue: STUDENT_DIALOGUE, cooldownTicks: 12,
    }, 'char_shinobi');
  }

  // ── Jonin ──
  spawnNpc(world, {
    x: 90, y: 40, name: 'Ryuuji', accents: ACCENTS_JONIN_1,
    rank: 'jounin', title: 'Elite Jonin', charClass: 'shinobi',
    skills: { taijutsu: 65, bukijutsu: 60, ninjutsu: 70, genjutsu: 45, med: 20 },
    stats: { phy: 50, cha: 55, men: 45, soc: 35 },
    description: 'A silver-haired jonin with a calm demeanor. Rumored to know over a thousand jutsu.',
    dialogue: { idle: ['Hmm? Oh, don\'t mind me. Just thinking.', 'The village is quiet today. That\'s usually when things happen.', 'You\'ve got potential. Keep training.'] },
    cooldownTicks: 25,
  }, 'char_shinobi');

  spawnNpc(world, {
    x: 55, y: 80, name: 'Asuka', accents: ACCENTS_JONIN_2,
    rank: 'jounin', title: 'Jonin', charClass: 'shinobi',
    skills: { taijutsu: 55, bukijutsu: 50, ninjutsu: 60, genjutsu: 65, med: 15 },
    stats: { phy: 40, cha: 50, men: 55, soc: 40 },
    description: 'A jonin specializing in genjutsu. Her red eyes are said to see through any illusion.',
    dialogue: { idle: ['Reality is more fragile than you think.', 'Genjutsu is the art of truth and lies.', 'Don\'t trust everything you see.'] },
    cooldownTicks: 25,
  }, 'char_shinobi');

  // ── Shopkeepers ──
  const shopDefs = [
    { x: 104, y: 86, name: 'Tenten', desc: 'The weapons shop owner. She knows every blade in her inventory by name.' },
    { x: 112, y: 86, name: 'Genma', desc: 'Runs the supply shop. Always chewing on a senbon needle.' },
    { x: 120, y: 86, name: 'Shiho', desc: 'The scroll shop proprietor. Quiet, but knows more jutsu theory than most jonin.' },
    { x: 104, y: 91, name: 'Ayame', desc: 'Sells shinobi clothing and armor. Has an eye for fashion.' },
  ];
  for (let i = 0; i < shopDefs.length; i++) {
    spawnNpc(world, {
      x: shopDefs[i].x, y: shopDefs[i].y, name: shopDefs[i].name,
      accents: i % 2 === 0 ? ACCENTS_SHOPKEEPER_1 : ACCENTS_SHOPKEEPER_2,
      rank: 'genin', title: 'Shopkeeper', charClass: 'merchant',
      skills: { taijutsu: 10, bukijutsu: 15, ninjutsu: 5, genjutsu: 2, med: 3 },
      stats: { phy: 12, cha: 8, men: 10, soc: 45 },
      description: shopDefs[i].desc,
      dialogue: SHOPKEEPER_DIALOGUE, cooldownTicks: 15,
    }, 'char_shinobi');
  }

  // ── Medical Ninja ──
  spawnNpc(world, {
    x: 38, y: 86, name: 'Dr. Nono', accents: ACCENTS_MEDIC_1,
    rank: 'special_jounin', title: 'Medical Ninja', charClass: 'shinobi',
    skills: { taijutsu: 20, bukijutsu: 10, ninjutsu: 40, genjutsu: 15, med: 75 },
    stats: { phy: 20, cha: 50, men: 45, soc: 35 },
    description: 'The head medic of Konoha Hospital. Stern but caring.',
    dialogue: MEDIC_DIALOGUE, cooldownTicks: 18,
  }, 'char_shinobi');

  spawnNpc(world, {
    x: 40, y: 88, name: 'Nurse Kabuki', accents: ACCENTS_MEDIC_2,
    rank: 'chuunin', title: 'Medical Ninja', charClass: 'shinobi',
    skills: { taijutsu: 15, bukijutsu: 8, ninjutsu: 30, genjutsu: 10, med: 55 },
    stats: { phy: 18, cha: 35, men: 30, soc: 30 },
    description: 'A medical ninja assisting at the hospital. Quick hands, steady nerves.',
    dialogue: MEDIC_DIALOGUE, cooldownTicks: 18,
  }, 'char_shinobi');

  // ── Ramen Chef ──
  spawnNpc(world, {
    x: 95, y: 108, name: 'Old Masashi', accents: ACCENTS_CHEF,
    rank: 'genin', title: 'Ramen Chef', charClass: 'civilian',
    skills: { taijutsu: 5, bukijutsu: 30, ninjutsu: 0, genjutsu: 0, med: 5 },
    stats: { phy: 20, cha: 5, men: 15, soc: 55 },
    description: 'The legendary ramen chef of Konoha Kitchen. His noodles are the stuff of myth.',
    dialogue: CHEF_DIALOGUE, cooldownTicks: 12,
  }, 'char_shinobi');

  // ── Villagers ──
  const villagerPos = [
    { x: 25, y: 112 }, { x: 34, y: 115 }, { x: 43, y: 110 },
    { x: 85, y: 100 }, { x: 90, y: 115 }, { x: 100, y: 120 },
    { x: 70, y: 105 }, { x: 60, y: 90 }, { x: 130, y: 95 },
    { x: 50, y: 75 }, { x: 110, y: 75 }, { x: 140, y: 85 },
  ];
  const civAccents = [ACCENTS_CIVILIAN_1, ACCENTS_CIVILIAN_2, ACCENTS_CIVILIAN_3, ACCENTS_CIVILIAN_4];
  const civNames = ['Tanaka', 'Suzuki', 'Yamamoto', 'Watanabe', 'Ito', 'Nakamura', 'Sato', 'Takahashi', 'Kobayashi', 'Yoshida', 'Mori', 'Fujita'];
  for (let i = 0; i < villagerPos.length; i++) {
    spawnNpc(world, {
      x: villagerPos[i].x, y: villagerPos[i].y,
      name: civNames[i], accents: civAccents[i % civAccents.length],
      rank: 'genin', title: 'Villager', charClass: 'civilian',
      skills: { taijutsu: 3, bukijutsu: 2, ninjutsu: 0, genjutsu: 0, med: 2 },
      stats: { phy: 10, cha: 5, men: 8, soc: 25 },
      description: 'A resident of Konoha going about their daily life.',
      dialogue: VILLAGER_DIALOGUE, cooldownTicks: 20,
    }, 'char_shinobi');
  }

  // ── Training Grounds: Takeshi ──
  spawnNpc(world, {
    x: ox + 20, y: oy + 20, name: 'Takeshi', accents: ACCENTS_TAKESHI,
    rank: 'genin', title: 'Training Partner', charClass: 'shinobi',
    skills: { taijutsu: 25, bukijutsu: 10, ninjutsu: 5, genjutsu: 2, med: 3 },
    stats: { phy: 20, cha: 10, men: 8, soc: 12 },
    description: 'A fellow genin from the academy. He trains here daily, always looking for a match.',
    dialogue: TAKESHI_DIALOGUE, cooldownTicks: 15,
  }, 'char_takeshi');

  // ── ANBU (dev mode) ──
  if (devMode) {
    spawnNpc(world, {
      x: ox + 20, y: oy + 3, name: 'ANBU Operative', accents: ACCENTS_ANBU,
      rank: 'anbu', title: 'ANBU Operative', charClass: 'shinobi',
      skills: { taijutsu: 65, bukijutsu: 60, ninjutsu: 55, genjutsu: 40, med: 20 },
      stats: { phy: 60, cha: 55, men: 50, soc: 30 },
      description: 'A masked ANBU operative. Their presence is unsettling.',
      dialogue: ANBU_DIALOGUE, cooldownTicks: 20,
    }, 'char_anbu');
  }
}
