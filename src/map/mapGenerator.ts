import { TileMap } from './tileMap.ts';
import { TRAINING_GROUNDS_LAYOUT } from './mapData.ts';
import { World } from '../engine/world.ts';
import { TILE_INDEX_TO_TYPE } from '../types/tiles.ts';
import type { TileType } from '../types/tiles.ts';
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
  TRAINING_DUMMY_HP,
} from '../core/constants.ts';

interface ObjectSpawn {
  x: number;
  y: number;
  type: 'dummy' | 'tree_small' | 'tree_large' | 'rock';
}

/** Object placements for the training grounds */
const OBJECT_SPAWNS: ObjectSpawn[] = [
  // Training dummy ring around the central clearing
  { x: 14, y: 20, type: 'dummy' },
  { x: 14, y: 24, type: 'dummy' },
  { x: 20, y: 17, type: 'dummy' },
  { x: 26, y: 20, type: 'dummy' },
  { x: 26, y: 24, type: 'dummy' },
  { x: 20, y: 27, type: 'dummy' },
  { x: 16, y: 22, type: 'dummy' },
  { x: 24, y: 22, type: 'dummy' },

  // Tree groves — NW corner
  { x: 3,  y: 2,  type: 'tree_large' },
  { x: 5,  y: 3,  type: 'tree_small' },
  { x: 2,  y: 5,  type: 'tree_small' },
  { x: 6,  y: 5,  type: 'tree_large' },
  { x: 4,  y: 7,  type: 'tree_small' },

  // Tree grove — SW corner
  { x: 3,  y: 32, type: 'tree_large' },
  { x: 5,  y: 34, type: 'tree_small' },
  { x: 2,  y: 36, type: 'tree_large' },
  { x: 7,  y: 33, type: 'tree_small' },

  // Tree grove — SE corner
  { x: 33, y: 32, type: 'tree_large' },
  { x: 35, y: 34, type: 'tree_small' },
  { x: 37, y: 33, type: 'tree_large' },
  { x: 34, y: 36, type: 'tree_small' },

  // Scattered trees along east side
  { x: 35, y: 10, type: 'tree_large' },
  { x: 37, y: 15, type: 'tree_small' },

  // Scattered rocks
  { x: 8,  y: 14, type: 'rock' },
  { x: 32, y: 8,  type: 'rock' },
  { x: 12, y: 30, type: 'rock' },
  { x: 30, y: 28, type: 'rock' },
  { x: 15, y: 10, type: 'rock' },
];

/**
 * Generate a fresh training grounds World with player and objects.
 */
export function generateTrainingGrounds(playerName: string, playerGender: 'shinobi' | 'kunoichi'): World {
  const W = TRAINING_GROUNDS_WIDTH;
  const H = TRAINING_GROUNDS_HEIGHT;
  const tileMap = new TileMap(W, H);

  // Fill tiles from layout, with random grass variant substitution
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const raw = TRAINING_GROUNDS_LAYOUT[y * W + x];
      let tileType: TileType;

      if (raw <= 2) {
        // Randomize grass variants
        const variant = Math.floor(Math.random() * 3);
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

  // ── Spawn Objects ──
  for (const spawn of OBJECT_SPAWNS) {
    const id = world.createEntity();
    world.positions.set(id, { x: spawn.x, y: spawn.y, facing: 's' });

    switch (spawn.type) {
      case 'dummy':
        world.renderables.set(id, { spriteId: 'obj_dummy', layer: 'object', offsetY: -20 });
        world.blockings.set(id, { blocksMovement: true, blocksSight: false });
        world.healths.set(id, { current: TRAINING_DUMMY_HP, max: TRAINING_DUMMY_HP });
        world.combatStats.set(id, { damage: 0, accuracy: 0, evasion: 0, attackVerb: '' });
        world.names.set(id, { display: 'training dummy', article: 'a' });
        world.destructibles.set(id, {
          onDestroyMessage: 'The training dummy splinters apart!',
          respawnTicks: 50,
        });
        world.aiControlled.set(id, { behavior: 'static' });
        break;

      case 'tree_small':
        world.renderables.set(id, { spriteId: 'obj_tree_small', layer: 'object', offsetY: -28 });
        world.blockings.set(id, { blocksMovement: true, blocksSight: true });
        world.names.set(id, { display: 'small tree', article: 'a' });
        break;

      case 'tree_large':
        world.renderables.set(id, { spriteId: 'obj_tree_large', layer: 'object', offsetY: -40 });
        world.blockings.set(id, { blocksMovement: true, blocksSight: true });
        world.names.set(id, { display: 'large tree', article: 'a' });
        break;

      case 'rock':
        world.renderables.set(id, { spriteId: 'obj_rock', layer: 'object', offsetY: -6 });
        world.blockings.set(id, { blocksMovement: true, blocksSight: false });
        world.names.set(id, { display: 'rock', article: 'a' });
        break;
    }
  }

  world.log(`${playerName} enters the training grounds.`, 'system');
  world.log('The scent of fresh earth and worn wood fills the air.', 'info');

  return world;
}
