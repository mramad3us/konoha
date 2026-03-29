import { TileMap } from './tileMap.ts';
import { TRAINING_GROUNDS_LAYOUT } from './mapData.ts';
import { World } from '../engine/world.ts';
import { TILE_INDEX_TO_TYPE } from '../types/tiles.ts';
import type { TileType } from '../types/tiles.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import { DEFAULT_SHINOBI_SHEET } from '../types/character.ts';
import {
  TRAINING_GROUNDS_WIDTH,
  TRAINING_GROUNDS_HEIGHT,
  PLAYER_START_X,
  PLAYER_START_Y,
  BASE_PLAYER_HP,
  BASE_PLAYER_CHAKRA,
  BASE_PLAYER_WILLPOWER,
  BASE_PLAYER_STAMINA,
  BASE_PLAYER_DAMAGE,
  BASE_PLAYER_ACCURACY,
  BASE_PLAYER_EVASION,
} from '../core/constants.ts';

type SpawnType =
  | 'dummy' | 'sparring_partner'
  | 'tree_small' | 'tree_large' | 'tree_willow'
  | 'bush_small' | 'bush_berry' | 'bush_tall' | 'bush_flower'
  | 'tall_grass' | 'reeds'
  | 'rock_small' | 'rock_medium' | 'rock_large' | 'rock_mossy';

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
}> = {
  dummy:           { spriteId: 'obj_dummy',       offsetY: -20, blocksMove: true,  blocksSight: false, displayName: 'training dummy', article: 'a', destructible: true },
  sparring_partner:{ spriteId: 'char_shinobi_s',  offsetY: -16, blocksMove: true,  blocksSight: false, displayName: 'sparring partner', article: 'a', sparring: true },
  tree_small:  { spriteId: 'obj_tree_small',  offsetY: -28, blocksMove: true,  blocksSight: true,  displayName: 'tree', article: 'a' },
  tree_large:  { spriteId: 'obj_tree_large',  offsetY: -36, blocksMove: true,  blocksSight: true,  displayName: 'large tree', article: 'a' },
  tree_willow: { spriteId: 'obj_tree_willow', offsetY: -32, blocksMove: true,  blocksSight: true,  displayName: 'willow tree', article: 'a' },
  bush_small:  { spriteId: 'obj_bush_small',  offsetY: -8,  blocksMove: false, blocksSight: false, displayName: 'bush', article: 'a' },
  bush_berry:  { spriteId: 'obj_bush_berry',  offsetY: -10, blocksMove: false, blocksSight: false, displayName: 'berry bush', article: 'a' },
  bush_tall:   { spriteId: 'obj_bush_tall',   offsetY: -14, blocksMove: true,  blocksSight: false, displayName: 'tall bush', article: 'a' },
  bush_flower: { spriteId: 'obj_bush_flower', offsetY: -10, blocksMove: false, blocksSight: false, displayName: 'flowering bush', article: 'a' },
  tall_grass:  { spriteId: 'obj_tall_grass',  offsetY: -8,  blocksMove: false, blocksSight: false, displayName: 'tall grass', article: '' },
  reeds:       { spriteId: 'obj_reeds',       offsetY: -12, blocksMove: false, blocksSight: false, displayName: 'reeds', article: '' },
  rock_small:  { spriteId: 'obj_rock_small',  offsetY: -4,  blocksMove: true,  blocksSight: false, displayName: 'small rock', article: 'a' },
  rock_medium: { spriteId: 'obj_rock_medium', offsetY: -8,  blocksMove: true,  blocksSight: false, displayName: 'rock', article: 'a' },
  rock_large:  { spriteId: 'obj_rock_large',  offsetY: -14, blocksMove: true,  blocksSight: false, displayName: 'boulder', article: 'a' },
  rock_mossy:  { spriteId: 'obj_rock_mossy',  offsetY: -10, blocksMove: true,  blocksSight: false, displayName: 'mossy boulder', article: 'a' },
};

/**
 * Generate a fresh training grounds World with player and objects.
 */
export function generateTrainingGrounds(playerName: string, playerGender: 'shinobi' | 'kunoichi'): World {
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
  world.healths.set(playerId, { current: BASE_PLAYER_HP, max: BASE_PLAYER_HP });
  world.combatStats.set(playerId, {
    damage: BASE_PLAYER_DAMAGE,
    accuracy: BASE_PLAYER_ACCURACY,
    evasion: BASE_PLAYER_EVASION,
    attackVerb: 'strike',
  });
  world.playerControlled.set(playerId, { movementStance: 'walk' });
  world.resources.set(playerId, {
    chakra: BASE_PLAYER_CHAKRA,
    maxChakra: BASE_PLAYER_CHAKRA,
    willpower: BASE_PLAYER_WILLPOWER,
    maxWillpower: BASE_PLAYER_WILLPOWER,
    stamina: BASE_PLAYER_STAMINA,
    maxStamina: BASE_PLAYER_STAMINA,
  });
  world.names.set(playerId, { display: playerName, article: '' });
  world.characterSheets.set(playerId, {
    ...DEFAULT_SHINOBI_SHEET,
    title: 'Academy Graduate',
  });

  // ── Spawn Objects ──
  for (const spawn of OBJECT_SPAWNS) {
    const cfg = SPAWN_CONFIG[spawn.type];
    const id = world.createEntity();

    world.positions.set(id, { x: spawn.x, y: spawn.y, facing: 's' });
    world.renderables.set(id, { spriteId: cfg.spriteId, layer: 'object', offsetY: cfg.offsetY });
    world.blockings.set(id, { blocksMovement: cfg.blocksMove, blocksSight: cfg.blocksSight });
    world.names.set(id, { display: cfg.displayName, article: cfg.article });

    if (cfg.destructible) {
      // Dummies don't have HP — they only break from massive single hits (80+ dmg)
      world.combatStats.set(id, { damage: 0, accuracy: 0, evasion: 0, attackVerb: '' });
      world.characterSheets.set(id, {
        class: 'civilian',
        rank: 'academy_student',
        title: 'Training Equipment',
        skills: { taijutsu: 10, bukijutsu: 0, ninjutsu: 0, genjutsu: 0 },
        stats: { phy: 10, cha: 0, men: 0, soc: 0 },
      });
      world.destructibles.set(id, {
        onDestroyMessage: `The ${cfg.displayName} splinters apart in a shower of wood and straw!`,
        respawnTicks: 50,
      });
      world.aiControlled.set(id, { behavior: 'static' });
    }

    if (cfg.sparring) {
      // Sparring partner — real combatant with HP, can be knocked down/stunned
      world.renderables.set(id, { spriteId: cfg.spriteId, layer: 'character', offsetY: cfg.offsetY });
      world.healths.set(id, { current: 80, max: 80 });
      world.combatStats.set(id, { damage: 5, accuracy: 70, evasion: 15, attackVerb: 'strike' });
      world.characterSheets.set(id, {
        class: 'shinobi',
        rank: 'genin',
        title: 'Training Partner',
        skills: { taijutsu: 25, bukijutsu: 10, ninjutsu: 5, genjutsu: 2 },
        stats: { phy: 20, cha: 10, men: 8, soc: 12 },
      });
      world.names.set(id, { display: 'Takeshi', article: '' });
      world.aiControlled.set(id, { behavior: 'static' });
    }
  }

  world.log(`${playerName} enters the training grounds.`, 'system');
  world.log('The scent of fresh earth and worn wood fills the air.', 'info');

  return world;
}
