import type { PixelPattern } from './pixelPatterns.ts';
import { TILE_GRASS1, TILE_GRASS2, TILE_GRASS3, TILE_DIRT, TILE_STONE, TILE_FENCE, TILE_WATER, TILE_GATE } from './tiles.ts';
import {
  OBJ_DUMMY, OBJ_TREE_SMALL, OBJ_TREE_LARGE, OBJ_TREE_WILLOW,
  OBJ_BUSH_SMALL, OBJ_BUSH_BERRY, OBJ_BUSH_TALL, OBJ_BUSH_FLOWER,
  OBJ_TALL_GRASS, OBJ_REEDS,
  OBJ_ROCK_SMALL, OBJ_ROCK_MEDIUM, OBJ_ROCK_LARGE, OBJ_ROCK_MOSSY,
  OBJ_SLEEPING_BAG, OBJ_TORCH_PILLAR,
} from './objects.ts';
import {
  CHAR_SHINOBI_S, CHAR_SHINOBI_N, CHAR_SHINOBI_E, CHAR_SHINOBI_W,
  CHAR_KUNOICHI_S, CHAR_KUNOICHI_N, CHAR_KUNOICHI_E, CHAR_KUNOICHI_W,
  CHAR_SHINOBI_PRONE, CHAR_KUNOICHI_PRONE,
} from './characters.ts';
import { TILE_WIDTH, TILE_HEIGHT } from '../core/constants.ts';

export interface SpriteRegistration {
  id: string;
  pattern: PixelPattern;
  displayWidth: number;
  displayHeight: number;
  outline?: boolean;
}

/** Complete sprite manifest for preloading */
export const SPRITE_MANIFEST: SpriteRegistration[] = [
  // Tiles
  { id: 'tile_grass1', pattern: TILE_GRASS1, displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_grass2', pattern: TILE_GRASS2, displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_grass3', pattern: TILE_GRASS3, displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_dirt',   pattern: TILE_DIRT,   displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_stone',  pattern: TILE_STONE,  displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_fence',  pattern: TILE_FENCE,  displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_water',  pattern: TILE_WATER,  displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_gate',   pattern: TILE_GATE,   displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },

  // Trees
  { id: 'obj_tree_small',  pattern: OBJ_TREE_SMALL,  displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_tree_large',  pattern: OBJ_TREE_LARGE,  displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_tree_willow', pattern: OBJ_TREE_WILLOW, displayWidth: 48, displayHeight: 48, outline: true },

  // Bushes
  { id: 'obj_bush_small',  pattern: OBJ_BUSH_SMALL,  displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_bush_berry',  pattern: OBJ_BUSH_BERRY,  displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_bush_tall',   pattern: OBJ_BUSH_TALL,   displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_bush_flower', pattern: OBJ_BUSH_FLOWER, displayWidth: 48, displayHeight: 48, outline: true },

  // Vegetation
  { id: 'obj_tall_grass', pattern: OBJ_TALL_GRASS, displayWidth: 48, displayHeight: 48 },
  { id: 'obj_reeds',      pattern: OBJ_REEDS,      displayWidth: 48, displayHeight: 48 },

  // Rocks
  { id: 'obj_rock_small',  pattern: OBJ_ROCK_SMALL,  displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_rock_medium', pattern: OBJ_ROCK_MEDIUM, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_rock_large',  pattern: OBJ_ROCK_LARGE,  displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_rock_mossy',  pattern: OBJ_ROCK_MOSSY,  displayWidth: 48, displayHeight: 48, outline: true },

  // Sleeping bag & torch
  { id: 'obj_sleeping_bag',  pattern: OBJ_SLEEPING_BAG,  displayWidth: 48, displayHeight: 48 },
  { id: 'obj_torch_pillar',  pattern: OBJ_TORCH_PILLAR,  displayWidth: 48, displayHeight: 48, outline: true },

  // Training dummy
  { id: 'obj_dummy', pattern: OBJ_DUMMY, displayWidth: 48, displayHeight: 48, outline: true },

  // Shinobi
  { id: 'char_shinobi_s', pattern: CHAR_SHINOBI_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_shinobi_n', pattern: CHAR_SHINOBI_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_shinobi_e', pattern: CHAR_SHINOBI_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_shinobi_w', pattern: CHAR_SHINOBI_W, displayWidth: 48, displayHeight: 48, outline: true },

  // Kunoichi
  { id: 'char_kunoichi_s', pattern: CHAR_KUNOICHI_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_kunoichi_n', pattern: CHAR_KUNOICHI_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_kunoichi_e', pattern: CHAR_KUNOICHI_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_kunoichi_w', pattern: CHAR_KUNOICHI_W, displayWidth: 48, displayHeight: 48, outline: true },

  // Prone / unconscious
  { id: 'char_shinobi_prone',  pattern: CHAR_SHINOBI_PRONE,  displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_kunoichi_prone', pattern: CHAR_KUNOICHI_PRONE, displayWidth: 48, displayHeight: 48, outline: true },
];
