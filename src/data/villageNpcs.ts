/**
 * Village NPC spawns — population for Konoha.
 * Each NPC has position, accent, stats, dialogue, and interaction config.
 */

import type { World } from '../engine/world.ts';
import type { CharacterAccents, BodyOverrides } from '../sprites/characters.ts';
import type { NpcCategory } from '../types/ecs.ts';
import { ACCENTS_TAKESHI, ACCENTS_ANBU, ACCENTS_ANBU_2, ACCENTS_ANBU_3, ACCENTS_ANBU_4, ACCENTS_ANBU_5, generateCharacterSprites, ANBU_BODIES, CIVILIAN_BODIES, FEMALE_CIVILIAN_BODIES, RAISED_BODIES, ANBU_RAISED_BODIES, SIGNING_BODIES, ANBU_SIGNING_BODIES } from '../sprites/characters.ts';
import { ANBU_DIALOGUE, TAKESHI_DIALOGUE } from '../engine/proximityDialogue.ts';
import { computeMaxHp, computeMaxChakra, computeMaxWillpower, computeMaxStamina } from '../engine/derivedStats.ts';
import { spriteCache } from '../rendering/spriteCache.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import { TG_OFFSET_X, TG_OFFSET_Y, NPC_WANDER_RADIUS, NPC_WANDER_INTERVAL_MIN, NPC_WANDER_INTERVAL_MAX, VILLAGE_WIDTH, VILLAGE_HEIGHT } from '../core/constants.ts';
import {
  ACCENTS_HOKAGE, ACCENTS_CHUNIN_1, ACCENTS_CHUNIN_2,
  ACCENTS_JONIN_1, ACCENTS_JONIN_2, ACCENTS_JONIN_3,
  ACCENTS_STUDENT_1, ACCENTS_STUDENT_2, ACCENTS_STUDENT_3,
  ACCENTS_MEDIC_1, ACCENTS_MEDIC_2,
  ACCENTS_SHOPKEEPER_1, ACCENTS_SHOPKEEPER_2,
  ACCENTS_CHEF,
  ALL_MALE_CIVILIAN_ACCENTS, ALL_FEMALE_CIVILIAN_ACCENTS,
} from './npcAccents.ts';

export interface NpcDef {
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
  female?: boolean;
  category?: NpcCategory;       // defaults to 'fixed'
  despawnAtNight?: boolean;      // defaults to true for 'wandering', false otherwise
}

/** Counter for unique NPC sprite prefixes */
let npcSpriteCounter = 0;

/** Generate a unique sprite set for an NPC from their accents and register in cache */
function registerNpcAccentSprites(accents: CharacterAccents, overrides?: BodyOverrides): string {
  const prefix = `npc_${npcSpriteCounter++}`;
  const sprites = generateCharacterSprites(accents, overrides);
  for (const [dir, pattern] of Object.entries(sprites)) {
    spriteCache.registerDynamic(`${prefix}_${dir}`, pattern, 48, 48, true);
  }

  // Register raised + signing sprites for non-civilian characters (ninja hand-sign poses)
  const isCivilian = overrides === CIVILIAN_BODIES || overrides === FEMALE_CIVILIAN_BODIES;
  if (!isCivilian) {
    const isAnbu = overrides === ANBU_BODIES;
    const raisedBodies = isAnbu ? ANBU_RAISED_BODIES : RAISED_BODIES;
    const raisedSprites = generateCharacterSprites(accents, raisedBodies);
    for (const [dir, pattern] of Object.entries(raisedSprites)) {
      if (dir === 'prone') continue;
      spriteCache.registerDynamic(`${prefix}_raised_${dir}`, pattern, 48, 48, true);
    }
    const signingBodies = isAnbu ? ANBU_SIGNING_BODIES : SIGNING_BODIES;
    const signingSprites = generateCharacterSprites(accents, signingBodies);
    for (const [dir, pattern] of Object.entries(signingSprites)) {
      if (dir === 'prone') continue;
      spriteCache.registerDynamic(`${prefix}_sign_${dir}`, pattern, 48, 48, true);
    }
  }

  return prefix;
}

function spawnNpc(world: World, def: NpcDef, spritePrefix?: string): number {
  // If no specific sprite prefix given, generate from accents
  // Civilians use CIVILIAN_BODIES (no headband), merchants too
  const isCivilian = def.charClass === 'civilian' || def.charClass === 'merchant';
  const bodyOverride = isCivilian
    ? (def.female ? FEMALE_CIVILIAN_BODIES : CIVILIAN_BODIES)
    : undefined;
  const actualPrefix = spritePrefix ?? registerNpcAccentSprites(def.accents, bodyOverride);

  const category = def.category ?? 'fixed';
  const isNinja = def.charClass === 'shinobi';

  // Randomize spawn position for wandering NPCs
  let spawnX = def.x;
  let spawnY = def.y;
  if (category === 'wandering') {
    const radius = NPC_WANDER_RADIUS;
    // Try a few random offsets, fall back to exact position
    for (let attempt = 0; attempt < 8; attempt++) {
      const ox = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const oy = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const tx = def.x + ox;
      const ty = def.y + oy;
      if (world.tileMap.isWalkable(tx, ty) && !world.isBlockedByEntity(tx, ty)) {
        spawnX = tx;
        spawnY = ty;
        break;
      }
    }
  }

  const id = world.createEntity();
  const hp = computeMaxHp(def.stats);

  world.setPosition(id, { x: spawnX, y: spawnY, facing: 's' });
  world.renderables.set(id, { spriteId: `${actualPrefix}_s`, layer: 'character', offsetY: -16 });
  world.blockings.set(id, { blocksMovement: true, blocksSight: false });
  world.healths.set(id, { current: hp, max: hp });

  // All NPCs get resources derived from their stats
  const maxChakra = isNinja ? computeMaxChakra(def.stats) : 0;
  const maxWillpower = computeMaxWillpower(def.stats);
  const maxStamina = computeMaxStamina(def.stats);
  world.resources.set(id, {
    chakra: maxChakra,
    maxChakra,
    chakraCeiling: maxChakra,
    lastChakraExertionTick: 0,
    willpower: maxWillpower,
    maxWillpower,
    stamina: maxStamina,
    maxStamina,
    staminaCeiling: maxStamina,
    lastExertionTick: 0,
    blood: 100,
    maxBlood: 100,
  });

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
  world.aiControlled.set(id, { behavior: category === 'wandering' ? 'wander' : 'static' });
  world.objectSheets.set(id, { description: def.description, category: 'npc' });
  world.proximityDialogue.set(id, {
    lines: def.dialogue,
    lastSpokeTick: -100,
    cooldownTicks: def.cooldownTicks,
  });

  // Anchor & lifecycle for all NPCs
  const wanderInterval = NPC_WANDER_INTERVAL_MIN + Math.floor(Math.random() * (NPC_WANDER_INTERVAL_MAX - NPC_WANDER_INTERVAL_MIN + 1));
  world.anchors.set(id, {
    anchorX: def.x,
    anchorY: def.y,
    wanderRadius: category === 'wandering' ? NPC_WANDER_RADIUS : 0,
    lastMoveTick: world.currentTick,
    moveIntervalTicks: wanderInterval,
    spritePrefix: actualPrefix,
  });
  world.npcLifecycles.set(id, {
    category,
    isNinja,
    despawnAtNight: def.despawnAtNight ?? (category === 'wandering'),
  });
  world.aggros.set(id, {
    targetId: null,
    state: 'idle',
    fleeHpThreshold: isNinja ? 0.20 : 0.40,
  });

  return id;
}

/** Re-export for lifecycle system to respawn despawned NPCs */
export { registerNpcAccentSprites };

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

const INNKEEPER_DIALOGUE: Record<string, string[]> = {
  idle: [
    'Rooms are available. Clean sheets, no questions asked.',
    'Welcome to the inn. Best rest in the village, if I do say so myself.',
    'Tired from a mission? A good night\'s sleep works wonders.',
    'The beds are clean and the walls are thick. You won\'t hear a thing.',
    'We get all kinds here. Shinobi, merchants, travelers. All welcome.',
    'Need a room? Just use any open bed upstairs.',
  ],
  night: [
    'Late night? We\'re always open. Take any bed that\'s free.',
    'Most guests are already asleep. Keep it quiet up there.',
  ],
  player_hurt: [
    'You look rough. Get some rest — it\'ll do you good.',
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

  // ── Hokage (inside Hokage Tower at 58-73, 72-79) ──
  spawnNpc(world, {
    x: 64, y: 76, name: 'Lord Hirotaka', accents: ACCENTS_HOKAGE,
    rank: 'kage', title: 'Third Hokage', charClass: 'shinobi',
    skills: { taijutsu: 85, bukijutsu: 80, ninjutsu: 95, genjutsu: 70, med: 40 },
    stats: { phy: 55, cha: 90, men: 85 },
    description: 'The Third Hokage, Lord Hirotaka. His kind eyes belie decades of combat experience.',
    dialogue: HOKAGE_DIALOGUE, cooldownTicks: 25,
    category: 'fixed',
  });

  // ── Mission Desk Chunin ──
  spawnNpc(world, {
    x: 65, y: 87, name: 'Iruma', accents: ACCENTS_CHUNIN_1,
    rank: 'chuunin', title: 'Mission Desk Operator', charClass: 'shinobi',
    skills: { taijutsu: 35, bukijutsu: 30, ninjutsu: 25, genjutsu: 15, med: 10 },
    stats: { phy: 25, cha: 20, men: 20},
    description: 'A chunin staffing the mission desk. They process assignments for all ranks.',
    dialogue: MISSION_DESK_DIALOGUE, cooldownTicks: 15,
    category: 'fixed',
  });

  // ── Gate Guards ──
  spawnNpc(world, {
    x: 70, y: 149, name: 'Kotetsu', accents: ACCENTS_CHUNIN_1,
    rank: 'chuunin', title: 'Gate Guard', charClass: 'shinobi',
    skills: { taijutsu: 40, bukijutsu: 35, ninjutsu: 20, genjutsu: 10, med: 5 },
    stats: { phy: 35, cha: 18, men: 15},
    description: 'One of the village gate guards. Perpetually bored but always vigilant.',
    dialogue: GATE_GUARD_DIALOGUE, cooldownTicks: 18,
    category: 'fixed',
  });

  spawnNpc(world, {
    x: 90, y: 149, name: 'Izumo', accents: ACCENTS_CHUNIN_2,
    rank: 'chuunin', title: 'Gate Guard', charClass: 'shinobi',
    skills: { taijutsu: 38, bukijutsu: 32, ninjutsu: 22, genjutsu: 12, med: 5 },
    stats: { phy: 32, cha: 20, men: 18},
    description: 'The other gate guard. More talkative than his partner.',
    dialogue: GATE_GUARD_DIALOGUE, cooldownTicks: 18,
    category: 'fixed',
  });

  // ── Academy Instructor ──
  spawnNpc(world, {
    x: 64, y: 14, name: 'Daikichi-sensei', accents: ACCENTS_JONIN_3,
    rank: 'jounin', title: 'Academy Instructor', charClass: 'shinobi',
    skills: { taijutsu: 50, bukijutsu: 45, ninjutsu: 55, genjutsu: 30, med: 15 },
    stats: { phy: 35, cha: 40, men: 35},
    description: 'The academy instructor. A scar runs across his nose — proof of real combat experience.',
    dialogue: ACADEMY_INSTRUCTOR_DIALOGUE, cooldownTicks: 20,
    category: 'fixed',
  });

  // ── Academy Students ──
  const studentPos = [
    { x: 60, y: 23 }, { x: 63, y: 25 }, { x: 66, y: 22 },
    { x: 69, y: 24 }, { x: 72, y: 23 }, { x: 65, y: 26 },
  ];
  const studentAccents = [ACCENTS_STUDENT_1, ACCENTS_STUDENT_2, ACCENTS_STUDENT_3];
  const studentNames = ['Ren', 'Yuki', 'Sora', 'Hana', 'Kai', 'Miki'];
  for (let i = 0; i < studentPos.length; i++) {
    spawnNpc(world, {
      x: studentPos[i].x, y: studentPos[i].y,
      name: studentNames[i], accents: studentAccents[i % studentAccents.length],
      rank: 'academy_student', title: 'Academy Student', charClass: 'shinobi',
      skills: { taijutsu: 5 + i, bukijutsu: 3, ninjutsu: 2, genjutsu: 1, med: 1 },
      stats: { phy: 8 + i, cha: 5, men: 4},
      description: 'A young academy student, eager to learn the ways of the shinobi.',
      dialogue: STUDENT_DIALOGUE, cooldownTicks: 12,
      category: 'wandering',
    });
  }

  // ── Jonin ──
  spawnNpc(world, {
    x: 76, y: 90, name: 'Ryuuji', accents: ACCENTS_JONIN_1,
    rank: 'jounin', title: 'Elite Jonin', charClass: 'shinobi',
    skills: { taijutsu: 65, bukijutsu: 60, ninjutsu: 70, genjutsu: 45, med: 20 },
    stats: { phy: 50, cha: 55, men: 45},
    description: 'A silver-haired jonin with a calm demeanor. Rumored to know over a thousand jutsu.',
    dialogue: { idle: ['Hmm? Oh, don\'t mind me. Just thinking.', 'The village is quiet today. That\'s usually when things happen.', 'You\'ve got potential. Keep training.'] },
    cooldownTicks: 25,
    category: 'wandering',
  });

  spawnNpc(world, {
    x: 68, y: 28, name: 'Asuka', accents: ACCENTS_JONIN_2,
    rank: 'jounin', title: 'Jonin', charClass: 'shinobi',
    skills: { taijutsu: 55, bukijutsu: 50, ninjutsu: 60, genjutsu: 65, med: 15 },
    stats: { phy: 40, cha: 50, men: 55},
    description: 'A jonin specializing in genjutsu. Her red eyes are said to see through any illusion.',
    dialogue: { idle: ['Reality is more fragile than you think.', 'Genjutsu is the art of truth and lies.', 'Don\'t trust everything you see.'] },
    cooldownTicks: 25,
    category: 'wandering',
  });

  // ── Shopkeepers ──
  const shopDefs = [
    { x: 101, y: 74, name: 'Tenten', desc: 'The weapons shop owner. She knows every blade in her inventory by name.' },
    { x: 111, y: 74, name: 'Genma', desc: 'Runs the supply shop. Always chewing on a senbon needle.' },
    { x: 121, y: 74, name: 'Shiho', desc: 'The scroll shop proprietor. Quiet, but knows more jutsu theory than most jonin.' },
    { x: 101, y: 90, name: 'Ayame', desc: 'Sells shinobi clothing and armor. Has an eye for fashion.' },
  ];
  for (let i = 0; i < shopDefs.length; i++) {
    spawnNpc(world, {
      x: shopDefs[i].x, y: shopDefs[i].y, name: shopDefs[i].name,
      accents: i % 2 === 0 ? ACCENTS_SHOPKEEPER_1 : ACCENTS_SHOPKEEPER_2,
      rank: 'civilian', title: 'Shopkeeper', charClass: 'merchant',
      skills: { taijutsu: 10, bukijutsu: 15, ninjutsu: 5, genjutsu: 2, med: 3 },
      stats: { phy: 12, cha: 8, men: 10},
      description: shopDefs[i].desc,
      dialogue: SHOPKEEPER_DIALOGUE, cooldownTicks: 15,
      category: 'fixed',
    });
  }

  // ── Medical Ninja ──
  spawnNpc(world, {
    x: 25, y: 86, name: 'Dr. Nono', accents: ACCENTS_MEDIC_1,
    rank: 'special_jounin', title: 'Medical Ninja', charClass: 'shinobi',
    skills: { taijutsu: 20, bukijutsu: 10, ninjutsu: 40, genjutsu: 15, med: 75 },
    stats: { phy: 20, cha: 50, men: 45},
    description: 'The head medic of Konoha Hospital. Stern but caring.',
    dialogue: MEDIC_DIALOGUE, cooldownTicks: 18,
    category: 'fixed',
  });

  spawnNpc(world, {
    x: 27, y: 86, name: 'Nurse Kabuki', accents: ACCENTS_MEDIC_2,
    rank: 'chuunin', title: 'Medical Ninja', charClass: 'shinobi',
    skills: { taijutsu: 15, bukijutsu: 8, ninjutsu: 30, genjutsu: 10, med: 55 },
    stats: { phy: 18, cha: 35, men: 30},
    description: 'A medical ninja assisting at the hospital. Quick hands, steady nerves.',
    dialogue: MEDIC_DIALOGUE, cooldownTicks: 18,
    category: 'fixed',
  });

  // ── Ramen Chef ──
  spawnNpc(world, {
    x: 66, y: 100, name: 'Old Masashi', accents: ACCENTS_CHEF,
    rank: 'civilian', title: 'Ramen Chef', charClass: 'civilian',
    skills: { taijutsu: 5, bukijutsu: 30, ninjutsu: 0, genjutsu: 0, med: 5 },
    stats: { phy: 20, cha: 5, men: 15},
    description: 'The legendary ramen chef of Konoha Kitchen. His noodles are the stuff of myth.',
    dialogue: CHEF_DIALOGUE, cooldownTicks: 12,
    category: 'fixed',
  });

  // ── Innkeeper ──
  spawnNpc(world, {
    x: 65, y: 123, name: 'Jinsuke', accents: ACCENTS_CHEF,
    rank: 'civilian', title: 'Innkeeper', charClass: 'civilian',
    skills: { taijutsu: 3, bukijutsu: 5, ninjutsu: 0, genjutsu: 0, med: 8 },
    stats: { phy: 15, cha: 3, men: 12},
    description: 'The innkeeper of Konoha\'s only inn. A quiet man who keeps clean rooms and asks no questions.',
    dialogue: INNKEEPER_DIALOGUE, cooldownTicks: 15,
    category: 'fixed',
  });

  // ── Villagers (30+ civilians with varied looks) ──
  const civilianDefs: Array<{ x: number; y: number; name: string; title: string; desc: string; female?: boolean }> = [
    // Main avenue (busy thoroughfare)
    { x: 76, y: 95, name: 'Tanaka', title: 'Farmer', desc: 'A weathered farmer heading to market with produce.' },
    { x: 77, y: 100, name: 'Mrs. Suzuki', title: 'Housewife', desc: 'A mother doing errands in the village.', female: true },
    { x: 76, y: 110, name: 'Yamamoto', title: 'Carpenter', desc: 'A carpenter carrying tools to a job site.' },
    { x: 77, y: 120, name: 'Watanabe', title: 'Elder', desc: 'An elderly man taking his daily walk through the village.' },
    { x: 76, y: 130, name: 'Ito', title: 'Merchant', desc: 'A traveling merchant passing through Konoha.' },
    { x: 77, y: 138, name: 'Sato', title: 'Fisherman', desc: 'Heading to the river with his rod and tackle.' },

    // Market plaza (shoppers and browsers)
    { x: 103, y: 80, name: 'Nakamura', title: 'Shopper', desc: 'Examining weapons at the market.' },
    { x: 113, y: 80, name: 'Takahashi', title: 'Shopper', desc: 'Comparing prices between stalls.' },
    { x: 123, y: 82, name: 'Kobayashi', title: 'Vendor', desc: 'A food vendor hawking fresh dumplings.' },
    { x: 108, y: 82, name: 'Yoshida', title: 'Baker', desc: 'Delivering fresh bread to the market.' },
    { x: 118, y: 82, name: 'Mrs. Mori', title: 'Tea Seller', desc: 'Pouring samples of her special blend.', female: true },
    { x: 130, y: 80, name: 'Fujita', title: 'Blacksmith', desc: 'A burly smith taking a break from the forge.' },

    // Commercial strip (eating, socializing)
    { x: 72, y: 100, name: 'Hideo', title: 'Regular', desc: 'A ramen regular. He\'s here every day.' },
    { x: 72, y: 108, name: 'Keiko', title: 'Tea Lady', desc: 'Sipping tea and watching the world go by.', female: true },
    { x: 82, y: 100, name: 'Riku', title: 'Barber\'s son', desc: 'Sweeping the floor outside his father\'s shop.' },

    // Residential west (at home, in yards)
    { x: 18, y: 110, name: 'Grandpa Oda', title: 'Retired', desc: 'An old man sitting outside his home, watching the clouds.' },
    { x: 32, y: 112, name: 'Mrs. Hayashi', title: 'Gardener', desc: 'Tending to potted plants outside her door.', female: true },
    { x: 42, y: 110, name: 'Daisuke', title: 'Child', desc: 'A young boy playing with a wooden kunai.' },
    { x: 24, y: 125, name: 'Emi', title: 'Seamstress', desc: 'Carrying fabric bundles home from the market.', female: true },
    { x: 40, y: 125, name: 'Taro', title: 'Baker', desc: 'Just closed his bakery for the day.' },

    // Residential east
    { x: 102, y: 112, name: 'Haruto', title: 'Craftsman', desc: 'A potter heading to his workshop.' },
    { x: 122, y: 112, name: 'Yuna', title: 'Child', desc: 'A little girl chasing a butterfly.', female: true },
    { x: 112, y: 125, name: 'Kaoru', title: 'Artist', desc: 'Sketching the village scenery on a scroll.' },
    { x: 128, y: 125, name: 'Shin', title: 'Fishmonger', desc: 'Smells like fresh catch. Heading home.' },

    // Near river (fishermen, walkers)
    { x: 35, y: 63, name: 'Old Jiro', title: 'Fisherman', desc: 'Been fishing this river for forty years.' },
    { x: 85, y: 63, name: 'Masa', title: 'Walker', desc: 'Enjoying a quiet walk along the riverbank.' },
    { x: 130, y: 63, name: 'Tomoe', title: 'Washerwoman', desc: 'Doing laundry by the river, as her mother did before her.', female: true },

    // Near gate (travelers, loiterers)
    { x: 78, y: 145, name: 'Wanderer', title: 'Traveler', desc: 'A dusty traveler who just arrived at Konoha.' },
    { x: 82, y: 144, name: 'Koji', title: 'Cart Driver', desc: 'Waiting for his supply cart to be unloaded.' },

    // Near hospital
    { x: 36, y: 85, name: 'Mrs. Toda', title: 'Visitor', desc: 'Visiting a family member at the hospital.', female: true },
  ];

  for (let i = 0; i < civilianDefs.length; i++) {
    const d = civilianDefs[i];
    const accent = d.female
      ? ALL_FEMALE_CIVILIAN_ACCENTS[i % ALL_FEMALE_CIVILIAN_ACCENTS.length]
      : ALL_MALE_CIVILIAN_ACCENTS[i % ALL_MALE_CIVILIAN_ACCENTS.length];
    // Random stats 1-10
    const rng = cellHash(d.x, d.y);
    spawnNpc(world, {
      x: d.x, y: d.y, name: d.name, accents: accent,
      rank: 'civilian', title: d.title, charClass: 'civilian',
      skills: { taijutsu: 1, bukijutsu: 0, ninjutsu: 0, genjutsu: 0, med: (rng % 3) },
      stats: {
        phy: 1 + (rng % 10),
        cha: 1 + ((rng >> 4) % 5),
        men: 1 + ((rng >> 8) % 8),
      },
      description: d.desc,
      dialogue: VILLAGER_DIALOGUE, cooldownTicks: 25,
      female: d.female,
      category: 'wandering',
    });
  }

  // ── Hyuga Clan Members ──
  const hyugaAccent: CharacterAccents = {
    hair: [35, 30, 50], headband: [200, 195, 210], pupil: [200, 195, 210], // lavender eyes
    belt: [100, 95, 110], beltHighlight: [120, 115, 130],
  };
  const hyugaNames = ['Hiashi', 'Neji', 'Hanabi', 'Ko'];
  const hyugaPos = [{ x: 16, y: 12 }, { x: 33, y: 10 }, { x: 14, y: 22 }, { x: 24, y: 22 }];
  for (let i = 0; i < hyugaNames.length; i++) {
    spawnNpc(world, {
      x: hyugaPos[i].x, y: hyugaPos[i].y, name: hyugaNames[i], accents: hyugaAccent,
      rank: i === 0 ? 'jounin' : 'chuunin', title: 'Hyuga Clan', charClass: 'shinobi',
      skills: { taijutsu: 40 + i * 10, bukijutsu: 20, ninjutsu: 30, genjutsu: 35, med: 5 },
      stats: { phy: 30 + i * 5, cha: 25, men: 35},
      description: `A member of the Hyuga clan. Their Byakugan allows them to see chakra flow.`,
      dialogue: { idle: [
        'The Byakugan sees all. Do not forget that.',
        'Our clan\'s gentle fist is the strongest taijutsu.',
        'Train hard. The Hyuga name demands excellence.',
        'Fate is absolute. But effort shapes its edges.',
      ], night: ['Even at night, these eyes see clearly.'] },
      cooldownTicks: 30,
      category: 'wandering',
    });
  }

  // ── Uchiha Clan Members ──
  const uchihaAccent: CharacterAccents = {
    hair: [25, 22, 30], headband: [26, 58, 92], pupil: [180, 30, 30], // red eyes (Sharingan feel)
    belt: [50, 45, 60], beltHighlight: [70, 65, 80],
  };
  const uchihaNames = ['Fugaku', 'Itachi', 'Shisui', 'Tekka', 'Yashiro'];
  const uchihaPos = [{ x: 118, y: 12 }, { x: 130, y: 12 }, { x: 114, y: 22 }, { x: 124, y: 22 }, { x: 134, y: 22 }];
  for (let i = 0; i < uchihaNames.length; i++) {
    spawnNpc(world, {
      x: uchihaPos[i].x, y: uchihaPos[i].y, name: uchihaNames[i], accents: uchihaAccent,
      rank: i === 0 ? 'jounin' : 'chuunin', title: 'Uchiha Clan', charClass: 'shinobi',
      skills: { taijutsu: 35 + i * 8, bukijutsu: 30 + i * 5, ninjutsu: 40 + i * 8, genjutsu: 30, med: 5 },
      stats: { phy: 28 + i * 5, cha: 35, men: 30},
      description: `A member of the Uchiha clan. Their Sharingan is feared across the shinobi world.`,
      dialogue: { idle: [
        'The Sharingan copies what it sees. Remember that.',
        'Fire Release is our clan\'s birthright.',
        'Don\'t underestimate an Uchiha.',
        'Strength comes from bonds. And from vengeance.',
        'Our police force keeps this village safe.',
      ], night: ['The Uchiha never sleep soundly. We\'re always watching.'] },
      cooldownTicks: 30,
      category: 'wandering',
    });
  }

  // ── Training Grounds: Takeshi ──
  spawnNpc(world, {
    x: ox + 20, y: oy + 20, name: 'Takeshi', accents: ACCENTS_TAKESHI,
    rank: 'genin', title: 'Training Partner', charClass: 'shinobi',
    skills: { taijutsu: 25, bukijutsu: 10, ninjutsu: 5, genjutsu: 2, med: 3 },
    stats: { phy: 20, cha: 10, men: 8},
    description: 'A fellow genin from the academy. He trains here daily, always looking for a match.',
    dialogue: TAKESHI_DIALOGUE, cooldownTicks: 15,
    category: 'fixed',
  }, 'char_takeshi');

  // ── ANBU (dev mode — extra one in training grounds) ──
  if (devMode) {
    spawnNpc(world, {
      x: ox + 20, y: oy + 3, name: 'ANBU Operative', accents: ACCENTS_ANBU,
      rank: 'anbu', title: 'ANBU Operative', charClass: 'shinobi',
      skills: { taijutsu: 65, bukijutsu: 60, ninjutsu: 55, genjutsu: 40, med: 20 },
      stats: { phy: 60, cha: 55, men: 50},
      description: 'A masked ANBU operative. Their presence is unsettling.',
      dialogue: ANBU_DIALOGUE, cooldownTicks: 20,
      category: 'fixed',
    }, registerNpcAccentSprites(ACCENTS_ANBU, ANBU_BODIES));
  }

  // ── ANBU Elite (10 invisible operatives) ──
  spawnAnbuOperatives(world);
}

// ── ANBU SPAWN SYSTEM ──

const ANBU_ELITE_DIALOGUE: Record<string, string[]> = {
  idle: [
    '...',
    'You shouldn\'t be able to see me.',
    'The shadows have eyes.',
    'Move along.',
    'Lord Hokage\'s orders. Nothing more to say.',
    'If you can perceive me, you\'re either very skilled or very lucky.',
  ],
  night: [
    'The night is our domain.',
    'The village sleeps. We do not.',
  ],
};

const ANBU_NAMES = [
  'Cat', 'Hawk', 'Bear', 'Fox', 'Crow',
  'Wolf', 'Boar', 'Rat', 'Tiger', 'Hound',
];

const ANBU_ACCENT_POOL = [
  ACCENTS_ANBU, ACCENTS_ANBU_2, ACCENTS_ANBU_3, ACCENTS_ANBU_4, ACCENTS_ANBU_5,
];

function spawnAnbuOperatives(world: World): void {
  // 2 fixed in Hokage office corners (Hokage Tower interior: x=56-73, y=73-82)
  const fixedPositions = [
    { x: 57, y: 73 },  // NW corner of Hokage Tower
    { x: 73, y: 73 },  // NE corner of Hokage Tower
  ];

  for (let i = 0; i < fixedPositions.length; i++) {
    const ninjutsuSkill = 70 + Math.floor(Math.random() * 15); // 70-84
    const accents = ANBU_ACCENT_POOL[i % ANBU_ACCENT_POOL.length];
    const prefix = registerNpcAccentSprites(accents, ANBU_BODIES);

    const def: NpcDef = {
      x: fixedPositions[i].x,
      y: fixedPositions[i].y,
      name: ANBU_NAMES[i],
      accents,
      rank: 'anbu',
      title: 'ANBU Black Ops',
      charClass: 'shinobi',
      skills: {
        taijutsu: 60 + Math.floor(Math.random() * 20),
        bukijutsu: 55 + Math.floor(Math.random() * 20),
        ninjutsu: ninjutsuSkill,
        genjutsu: 40 + Math.floor(Math.random() * 20),
        med: 15 + Math.floor(Math.random() * 10),
      },
      stats: {
        phy: 55 + Math.floor(Math.random() * 15),
        cha: 50 + Math.floor(Math.random() * 15),
        men: 50 + Math.floor(Math.random() * 15),
      },
      description: 'A masked ANBU operative standing perfectly still. Their presence is barely perceptible.',
      dialogue: ANBU_ELITE_DIALOGUE,
      cooldownTicks: 40,
      category: 'fixed',
    };

    const anbuId = spawnNpc(world, def, prefix);
    world.invisible.set(anbuId, { casterNinjutsu: ninjutsuSkill });
  }

  // 8 randomly placed across the map
  for (let i = 2; i < 10; i++) {
    const ninjutsuSkill = 65 + Math.floor(Math.random() * 20); // 65-84
    const accents = ANBU_ACCENT_POOL[i % ANBU_ACCENT_POOL.length];
    const prefix = registerNpcAccentSprites(accents, ANBU_BODIES);

    // Find a random walkable position
    let spawnX = 80;
    let spawnY = 80;
    for (let attempt = 0; attempt < 50; attempt++) {
      const rx = 10 + Math.floor(Math.random() * (VILLAGE_WIDTH - 20));
      const ry = 10 + Math.floor(Math.random() * (VILLAGE_HEIGHT - 20));
      if (world.tileMap.isWalkable(rx, ry) && !world.isBlockedByEntity(rx, ry)) {
        spawnX = rx;
        spawnY = ry;
        break;
      }
    }

    const def: NpcDef = {
      x: spawnX,
      y: spawnY,
      name: ANBU_NAMES[i],
      accents,
      rank: 'anbu',
      title: 'ANBU Black Ops',
      charClass: 'shinobi',
      skills: {
        taijutsu: 55 + Math.floor(Math.random() * 25),
        bukijutsu: 50 + Math.floor(Math.random() * 25),
        ninjutsu: ninjutsuSkill,
        genjutsu: 35 + Math.floor(Math.random() * 25),
        med: 10 + Math.floor(Math.random() * 15),
      },
      stats: {
        phy: 50 + Math.floor(Math.random() * 20),
        cha: 45 + Math.floor(Math.random() * 20),
        men: 45 + Math.floor(Math.random() * 20),
      },
      description: 'A masked ANBU operative watching from the shadows. You can barely make out their form.',
      dialogue: ANBU_ELITE_DIALOGUE,
      cooldownTicks: 50,
      category: 'fixed',
      despawnAtNight: false,
    };

    const anbuId = spawnNpc(world, def, prefix);
    world.invisible.set(anbuId, { casterNinjutsu: ninjutsuSkill });
  }
}
