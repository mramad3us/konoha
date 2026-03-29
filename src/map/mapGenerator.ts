import { TileMap } from './tileMap.ts';
import { TRAINING_GROUNDS_LAYOUT } from './mapData.ts';
import { World } from '../engine/world.ts';
import { TILE_INDEX_TO_TYPE } from '../types/tiles.ts';
import type { TileType } from '../types/tiles.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import { DEFAULT_SHINOBI_SHEET } from '../types/character.ts';
import { computeMaxHp, computeMaxChakra, computeMaxWillpower, computeMaxStamina } from '../engine/derivedStats.ts';
import { TAKESHI_DIALOGUE, ANBU_DIALOGUE } from '../engine/proximityDialogue.ts';
import {
  GAME_START_HOUR,
  TRAINING_GROUNDS_WIDTH,
  TRAINING_GROUNDS_HEIGHT,
  PLAYER_START_X,
  PLAYER_START_Y,
  BASE_PLAYER_DAMAGE,
  BASE_PLAYER_ACCURACY,
  BASE_PLAYER_EVASION,
} from '../core/constants.ts';

type SpawnType =
  | 'dummy' | 'sparring_partner'
  | 'tree_small' | 'tree_large' | 'tree_willow'
  | 'bush_small' | 'bush_berry' | 'bush_tall' | 'bush_flower'
  | 'tall_grass' | 'reeds'
  | 'rock_small' | 'rock_medium' | 'rock_large' | 'rock_mossy'
  | 'sleeping_bag' | 'torch_pillar';

interface ObjectSpawn {
  x: number;
  y: number;
  type: SpawnType;
}

/** Object placements for the training grounds */
const OBJECT_SPAWNS: ObjectSpawn[] = [
  // ── Sparring partner (near center) ──
  { x: 20, y: 20, type: 'sparring_partner' },

  // ── Training dummy ring ──
  { x: 14, y: 20, type: 'dummy' },
  { x: 14, y: 24, type: 'dummy' },
  { x: 20, y: 17, type: 'dummy' },
  { x: 26, y: 20, type: 'dummy' },
  { x: 26, y: 24, type: 'dummy' },
  { x: 20, y: 27, type: 'dummy' },
  { x: 16, y: 22, type: 'dummy' },
  { x: 24, y: 22, type: 'dummy' },

  // ── NW tree grove ──
  { x: 3,  y: 2,  type: 'tree_large' },
  { x: 5,  y: 3,  type: 'tree_small' },
  { x: 2,  y: 5,  type: 'tree_willow' },
  { x: 6,  y: 5,  type: 'tree_large' },
  { x: 4,  y: 7,  type: 'tree_small' },
  { x: 3,  y: 4,  type: 'bush_berry' },
  { x: 7,  y: 6,  type: 'bush_small' },
  { x: 5,  y: 8,  type: 'tall_grass' },

  // ── SW tree grove ──
  { x: 3,  y: 32, type: 'tree_large' },
  { x: 5,  y: 34, type: 'tree_willow' },
  { x: 2,  y: 36, type: 'tree_large' },
  { x: 7,  y: 33, type: 'tree_small' },
  { x: 4,  y: 35, type: 'bush_tall' },
  { x: 6,  y: 36, type: 'bush_small' },

  // ── SE tree grove ──
  { x: 33, y: 32, type: 'tree_large' },
  { x: 35, y: 34, type: 'tree_small' },
  { x: 37, y: 33, type: 'tree_large' },
  { x: 34, y: 36, type: 'tree_willow' },
  { x: 36, y: 35, type: 'bush_berry' },
  { x: 32, y: 34, type: 'bush_flower' },

  // ── NE — near pond ──
  { x: 35, y: 3,  type: 'tree_willow' },
  { x: 37, y: 5,  type: 'tree_small' },
  { x: 33, y: 6,  type: 'reeds' },
  { x: 35, y: 7,  type: 'reeds' },
  { x: 36, y: 8,  type: 'reeds' },

  // ── East side scattered ──
  { x: 35, y: 10, type: 'tree_large' },
  { x: 37, y: 15, type: 'tree_small' },
  { x: 36, y: 12, type: 'bush_small' },
  { x: 34, y: 18, type: 'tall_grass' },

  // ── Bushes along paths ──
  { x: 18, y: 14, type: 'bush_flower' },
  { x: 22, y: 14, type: 'bush_small' },
  { x: 10, y: 20, type: 'bush_tall' },
  { x: 30, y: 20, type: 'bush_berry' },
  { x: 18, y: 30, type: 'bush_small' },
  { x: 22, y: 30, type: 'bush_flower' },

  // ── Tall grass patches ──
  { x: 8,  y: 8,  type: 'tall_grass' },
  { x: 9,  y: 9,  type: 'tall_grass' },
  { x: 28, y: 10, type: 'tall_grass' },
  { x: 10, y: 25, type: 'tall_grass' },
  { x: 30, y: 30, type: 'tall_grass' },

  // ── Sleeping bag near spawn ──
  { x: 21, y: 36, type: 'sleeping_bag' },

  // ── Torch pillars around perimeter ──
  { x: 5,  y: 1,  type: 'torch_pillar' },
  { x: 20, y: 1,  type: 'torch_pillar' },
  { x: 35, y: 1,  type: 'torch_pillar' },
  { x: 1,  y: 15, type: 'torch_pillar' },
  { x: 38, y: 15, type: 'torch_pillar' },
  { x: 1,  y: 30, type: 'torch_pillar' },
  { x: 38, y: 30, type: 'torch_pillar' },
  { x: 18, y: 38, type: 'torch_pillar' },
  { x: 22, y: 38, type: 'torch_pillar' },

  // ── Rocks — varied sizes ──
  { x: 8,  y: 14, type: 'rock_medium' },
  { x: 32, y: 8,  type: 'rock_large' },
  { x: 12, y: 30, type: 'rock_mossy' },
  { x: 30, y: 28, type: 'rock_small' },
  { x: 15, y: 10, type: 'rock_medium' },
  { x: 25, y: 6,  type: 'rock_small' },
  { x: 6,  y: 18, type: 'rock_small' },
  { x: 34, y: 25, type: 'rock_mossy' },
  { x: 11, y: 4,  type: 'rock_large' },
  { x: 28, y: 35, type: 'rock_medium' },
];

/** Sprite ID and rendering config for each spawn type */
const SPAWN_CONFIG: Record<SpawnType, {
  spriteId: string;
  offsetY: number;
  blocksMove: boolean;
  blocksSight: boolean;
  displayName: string;
  article: 'a' | 'an' | 'the' | '';
  destructible?: boolean;
  sparring?: boolean;
  objectCategory: import('../types/ecs.ts').ObjectCategory;
  description: string;
}> = {
  dummy:           { spriteId: 'obj_dummy',       offsetY: -20, blocksMove: true,  blocksSight: false, displayName: 'training dummy', article: 'a', destructible: true, objectCategory: 'object', description: 'A training dummy made of wood and straw. The target painted on its chest has seen countless strikes.' },
  sparring_partner:{ spriteId: 'char_takeshi_s',  offsetY: -16, blocksMove: true,  blocksSight: false, displayName: 'sparring partner', article: 'a', sparring: true, objectCategory: 'npc', description: 'A fellow genin from the academy. He trains here daily, always looking for a match.' },
  tree_small:  { spriteId: 'obj_tree_small',  offsetY: -28, blocksMove: true,  blocksSight: true,  displayName: 'tree', article: 'a', objectCategory: 'terrain', description: 'A sturdy tree with thick branches. Its leaves rustle softly in the breeze.' },
  tree_large:  { spriteId: 'obj_tree_large',  offsetY: -36, blocksMove: true,  blocksSight: true,  displayName: 'large tree', article: 'a', objectCategory: 'terrain', description: 'An ancient tree towering overhead. Its trunk is wide enough to hide behind.' },
  tree_willow: { spriteId: 'obj_tree_willow', offsetY: -32, blocksMove: true,  blocksSight: true,  displayName: 'willow tree', article: 'a', objectCategory: 'terrain', description: 'A graceful willow, its long branches sweeping low to the ground like curtains.' },
  bush_small:  { spriteId: 'obj_bush_small',  offsetY: -8,  blocksMove: false, blocksSight: false, displayName: 'bush', article: 'a', objectCategory: 'terrain', description: 'A low, unremarkable shrub. Good for concealment if you crouch.' },
  bush_berry:  { spriteId: 'obj_bush_berry',  offsetY: -10, blocksMove: false, blocksSight: false, displayName: 'berry bush', article: 'a', objectCategory: 'terrain', description: 'Dark berries grow among the leaves. Some look edible, others less so.' },
  bush_tall:   { spriteId: 'obj_bush_tall',   offsetY: -14, blocksMove: true,  blocksSight: false, displayName: 'tall bush', article: 'a', objectCategory: 'terrain', description: 'A dense thicket, tall enough to block your path. Thorny branches discourage shortcuts.' },
  bush_flower: { spriteId: 'obj_bush_flower', offsetY: -10, blocksMove: false, blocksSight: false, displayName: 'flowering bush', article: 'a', objectCategory: 'terrain', description: 'Bright yellow flowers dot this bush, attracting small insects in the warm air.' },
  tall_grass:  { spriteId: 'obj_tall_grass',  offsetY: -8,  blocksMove: false, blocksSight: false, displayName: 'tall grass', article: '', objectCategory: 'terrain', description: 'Knee-high grass sways gently. Good for low-profile movement.' },
  reeds:       { spriteId: 'obj_reeds',       offsetY: -12, blocksMove: false, blocksSight: false, displayName: 'reeds', article: '', objectCategory: 'terrain', description: 'Tall reeds grow near the water\'s edge, their stalks dry and papery.' },
  rock_small:  { spriteId: 'obj_rock_small',  offsetY: -4,  blocksMove: true,  blocksSight: false, displayName: 'small rock', article: 'a', objectCategory: 'terrain', description: 'A smooth stone, worn by weather. Nothing special.' },
  rock_medium: { spriteId: 'obj_rock_medium', offsetY: -8,  blocksMove: true,  blocksSight: false, displayName: 'rock', article: 'a', objectCategory: 'terrain', description: 'A solid chunk of grey stone embedded in the earth. Immovable.' },
  rock_large:  { spriteId: 'obj_rock_large',  offsetY: -14, blocksMove: true,  blocksSight: false, displayName: 'boulder', article: 'a', objectCategory: 'terrain', description: 'A massive boulder. Generations of shinobi have used it as a landmark.' },
  rock_mossy:  { spriteId: 'obj_rock_mossy',  offsetY: -10, blocksMove: true,  blocksSight: false, displayName: 'mossy boulder', article: 'a', objectCategory: 'terrain', description: 'Green moss clings to this old stone. The damp surface is cool to the touch.' },
  sleeping_bag:{ spriteId: 'obj_sleeping_bag', offsetY: -4,  blocksMove: false, blocksSight: false, displayName: 'sleeping bag', article: 'a', objectCategory: 'object', description: 'A well-worn bedroll. It looks warm enough for a few hours of rest.' },
  torch_pillar:{ spriteId: 'obj_torch_pillar', offsetY: -20, blocksMove: true,  blocksSight: false, displayName: 'torch pillar', article: 'a', objectCategory: 'object', description: 'A stone pillar topped with an oil-soaked torch. It lights automatically at dusk.' },
};

/**
 * Generate a fresh training grounds World with player and objects.
 */
export function generateTrainingGrounds(playerName: string, playerGender: 'shinobi' | 'kunoichi', devMode: boolean = false): World {
  const W = TRAINING_GROUNDS_WIDTH;
  const H = TRAINING_GROUNDS_HEIGHT;
  const tileMap = new TileMap(W, H);

  // Fill tiles from layout, with deterministic grass variant substitution
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const raw = TRAINING_GROUNDS_LAYOUT[y * W + x];
      let tileType: TileType;

      if (raw <= 2) {
        // Deterministic grass variant from cell hash
        const variant = cellHash(x, y) % 3;
        tileType = TILE_INDEX_TO_TYPE[variant];
      } else {
        tileType = TILE_INDEX_TO_TYPE[raw];
      }

      tileMap.setTile(x, y, tileType);
    }
  }

  const world = new World(tileMap);
  world.gameTimeSeconds = GAME_START_HOUR * 3600; // Start at 8:00 AM

  // ── Create Player ──
  const playerId = world.createEntity();
  world.playerEntityId = playerId;

  world.positions.set(playerId, { x: PLAYER_START_X, y: PLAYER_START_Y, facing: 'n' });
  world.renderables.set(playerId, {
    spriteId: `char_${playerGender}_s`,
    layer: 'character',
    offsetY: -16,
  });
  world.blockings.set(playerId, { blocksMovement: true, blocksSight: false });

  // Character sheet FIRST — resources derive from stats
  const playerSheet = devMode
    ? {
        class: 'shinobi' as const,
        rank: 'jounin' as const,
        title: 'Elite Shinobi',
        skills: { taijutsu: 70, bukijutsu: 70, ninjutsu: 70, genjutsu: 70, med: 70 },
        stats: { phy: 70, cha: 70, men: 70, soc: 70 },
        learnedJutsus: ['substitution'],
      }
    : { ...DEFAULT_SHINOBI_SHEET, title: 'Academy Graduate' };
  world.characterSheets.set(playerId, playerSheet);

  // Derive max resources from stats
  const maxHp = computeMaxHp(playerSheet.stats);
  const maxChakra = computeMaxChakra(playerSheet.stats);
  const maxWillpower = computeMaxWillpower(playerSheet.stats);
  const maxStamina = computeMaxStamina(playerSheet.stats);

  world.healths.set(playerId, { current: maxHp, max: maxHp });
  world.combatStats.set(playerId, {
    damage: BASE_PLAYER_DAMAGE,
    accuracy: BASE_PLAYER_ACCURACY,
    evasion: BASE_PLAYER_EVASION,
    attackVerb: 'strike',
  });
  world.playerControlled.set(playerId, { movementStance: 'walk' });
  world.resources.set(playerId, {
    chakra: maxChakra,
    maxChakra,
    willpower: maxWillpower,
    maxWillpower,
    stamina: maxStamina,
    maxStamina,
    staminaCeiling: maxStamina,
    lastExertionTick: 0,
    blood: 100,
    maxBlood: 100,
  });
  world.names.set(playerId, { display: playerName, article: '' });

  // ── Spawn Objects ──
  for (const spawn of OBJECT_SPAWNS) {
    const cfg = SPAWN_CONFIG[spawn.type];
    const id = world.createEntity();

    world.positions.set(id, { x: spawn.x, y: spawn.y, facing: 's' });
    world.renderables.set(id, { spriteId: cfg.spriteId, layer: 'object', offsetY: cfg.offsetY });
    world.blockings.set(id, { blocksMovement: cfg.blocksMove, blocksSight: cfg.blocksSight });
    world.names.set(id, { display: cfg.displayName, article: cfg.article });
    world.objectSheets.set(id, { description: cfg.description, category: cfg.objectCategory });

    if (cfg.destructible) {
      // Dummies don't have HP — they only break from massive single hits (80+ dmg)
      world.combatStats.set(id, { damage: 0, accuracy: 0, evasion: 0, attackVerb: '' });
      world.characterSheets.set(id, {
        class: 'civilian',
        rank: 'academy_student',
        title: 'Training Equipment',
        skills: { taijutsu: 10, bukijutsu: 0, ninjutsu: 0, genjutsu: 0, med: 0 },
        stats: { phy: 10, cha: 0, men: 0, soc: 0 },
        learnedJutsus: [],
      });
      world.destructibles.set(id, {
        onDestroyMessage: `The ${cfg.displayName} splinters apart in a shower of wood and straw!`,
        respawnTicks: 50,
      });
      world.aiControlled.set(id, { behavior: 'static' });
    }

    if (spawn.type === 'sleeping_bag') {
      world.interactables.set(id, { interactionType: 'sleep', label: 'Sleep' });
    }

    if (spawn.type === 'torch_pillar') {
      world.lightSources.set(id, { radius: 5, activeAtNight: true });
    }

    if (cfg.sparring) {
      // Sparring partner — real combatant, stats scale HP
      const sparStats = { phy: 20, cha: 10, men: 8, soc: 12 };
      const sparHp = computeMaxHp(sparStats);
      world.renderables.set(id, { spriteId: cfg.spriteId, layer: 'character', offsetY: cfg.offsetY });
      world.healths.set(id, { current: sparHp, max: sparHp });
      world.combatStats.set(id, { damage: 5, accuracy: 70, evasion: 15, attackVerb: 'strike' });
      world.characterSheets.set(id, {
        class: 'shinobi',
        rank: 'genin',
        title: 'Training Partner',
        skills: { taijutsu: 25, bukijutsu: 10, ninjutsu: 5, genjutsu: 2, med: 3 },
        stats: sparStats,
        learnedJutsus: [],
      });
      world.names.set(id, { display: 'Takeshi', article: '' });
      world.aiControlled.set(id, { behavior: 'static' });
      world.proximityDialogue.set(id, { lines: TAKESHI_DIALOGUE, lastSpokeTick: -100, cooldownTicks: 15 });
    }
  }

  // ── ANBU (dev mode only) ──
  if (devMode) {
    const anbuId = world.createEntity();
    const anbuStats = { phy: 60, cha: 55, men: 50, soc: 30 };
    const anbuHp = computeMaxHp(anbuStats);
    world.positions.set(anbuId, { x: 20, y: 3, facing: 's' });
    world.renderables.set(anbuId, { spriteId: 'char_anbu_s', layer: 'character', offsetY: -16 });
    world.blockings.set(anbuId, { blocksMovement: true, blocksSight: false });
    world.healths.set(anbuId, { current: anbuHp, max: anbuHp });
    world.combatStats.set(anbuId, { damage: 15, accuracy: 90, evasion: 40, attackVerb: 'strike' });
    world.characterSheets.set(anbuId, {
      class: 'shinobi',
      rank: 'anbu',
      title: 'ANBU Operative',
      skills: { taijutsu: 65, bukijutsu: 60, ninjutsu: 55, genjutsu: 40, med: 20 },
      stats: anbuStats,
      learnedJutsus: ['substitution'],
    });
    world.names.set(anbuId, { display: 'ANBU Operative', article: 'an' });
    world.aiControlled.set(anbuId, { behavior: 'static' });
    world.objectSheets.set(anbuId, {
      description: 'A masked ANBU operative standing motionless at the edge of the grounds. Their presence is unsettling.',
      category: 'npc',
    });
    world.proximityDialogue.set(anbuId, { lines: ANBU_DIALOGUE, lastSpokeTick: -100, cooldownTicks: 20 });
  }

  world.log(`${playerName} enters the training grounds.`, 'system');
  world.log('The scent of fresh earth and worn wood fills the air.', 'info');

  return world;
}
