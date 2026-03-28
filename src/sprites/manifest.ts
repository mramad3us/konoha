import type { PixelPattern } from './pixelPatterns.ts';
import { TILE_GRASS1, TILE_GRASS2, TILE_GRASS3, TILE_DIRT, TILE_STONE, TILE_FENCE, TILE_WATER, TILE_GATE } from './tiles.ts';
import { OBJ_DUMMY, OBJ_TREE_SMALL, OBJ_TREE_LARGE, OBJ_ROCK } from './objects.ts';
import {
  CHAR_SHINOBI_S, CHAR_SHINOBI_N, CHAR_SHINOBI_E, CHAR_SHINOBI_W,
  CHAR_KUNOICHI_S, CHAR_KUNOICHI_N, CHAR_KUNOICHI_E, CHAR_KUNOICHI_W,
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
  // Tiles (displayed at 48x24, pattern is 16x8)
  { id: 'tile_grass1', pattern: TILE_GRASS1, displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_grass2', pattern: TILE_GRASS2, displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_grass3', pattern: TILE_GRASS3, displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_dirt',   pattern: TILE_DIRT,   displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_stone',  pattern: TILE_STONE,  displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_fence',  pattern: TILE_FENCE,  displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_water',  pattern: TILE_WATER,  displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_gate',   pattern: TILE_GATE,   displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },

  // Objects (16x16 patterns displayed at 48x48 — 3x scale)
  { id: 'obj_dummy',      pattern: OBJ_DUMMY,      displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_tree_small', pattern: OBJ_TREE_SMALL, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_tree_large', pattern: OBJ_TREE_LARGE, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_rock',       pattern: OBJ_ROCK,       displayWidth: 48, displayHeight: 48, outline: true },

  // Shinobi (16x16 patterns displayed at 48x48)
  { id: 'char_shinobi_s', pattern: CHAR_SHINOBI_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_shinobi_n', pattern: CHAR_SHINOBI_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_shinobi_e', pattern: CHAR_SHINOBI_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_shinobi_w', pattern: CHAR_SHINOBI_W, displayWidth: 48, displayHeight: 48, outline: true },

  // Kunoichi (16x16 patterns displayed at 48x48)
  { id: 'char_kunoichi_s', pattern: CHAR_KUNOICHI_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_kunoichi_n', pattern: CHAR_KUNOICHI_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_kunoichi_e', pattern: CHAR_KUNOICHI_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_kunoichi_w', pattern: CHAR_KUNOICHI_W, displayWidth: 48, displayHeight: 48, outline: true },
];
