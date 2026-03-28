import { TILE_GRASS1, TILE_GRASS2, TILE_GRASS3, TILE_DIRT, TILE_STONE, TILE_FENCE, TILE_WATER, TILE_GATE } from './tiles.ts';
import { OBJ_DUMMY, OBJ_TREE_SMALL, OBJ_TREE_LARGE, OBJ_ROCK } from './objects.ts';
import {
  CHAR_SHINOBI_S, CHAR_SHINOBI_N, CHAR_SHINOBI_E, CHAR_SHINOBI_W,
  CHAR_KUNOICHI_S, CHAR_KUNOICHI_N, CHAR_KUNOICHI_E, CHAR_KUNOICHI_W,
} from './characters.ts';

export interface SpriteRegistration {
  id: string;
  svg: string;
  width: number;
  height: number;
}

/** Complete sprite manifest for preloading */
export const SPRITE_MANIFEST: SpriteRegistration[] = [
  // Tiles (48x24 iso)
  { id: 'tile_grass1', svg: TILE_GRASS1, width: 48, height: 24 },
  { id: 'tile_grass2', svg: TILE_GRASS2, width: 48, height: 24 },
  { id: 'tile_grass3', svg: TILE_GRASS3, width: 48, height: 24 },
  { id: 'tile_dirt',   svg: TILE_DIRT,   width: 48, height: 24 },
  { id: 'tile_stone',  svg: TILE_STONE,  width: 48, height: 24 },
  { id: 'tile_fence',  svg: TILE_FENCE,  width: 48, height: 24 },
  { id: 'tile_water',  svg: TILE_WATER,  width: 48, height: 24 },
  { id: 'tile_gate',   svg: TILE_GATE,   width: 48, height: 24 },

  // Objects
  { id: 'obj_dummy',      svg: OBJ_DUMMY,      width: 24, height: 36 },
  { id: 'obj_tree_small', svg: OBJ_TREE_SMALL, width: 24, height: 32 },
  { id: 'obj_tree_large', svg: OBJ_TREE_LARGE, width: 32, height: 48 },
  { id: 'obj_rock',       svg: OBJ_ROCK,       width: 20, height: 14 },

  // Shinobi (24x32)
  { id: 'char_shinobi_s', svg: CHAR_SHINOBI_S, width: 24, height: 32 },
  { id: 'char_shinobi_n', svg: CHAR_SHINOBI_N, width: 24, height: 32 },
  { id: 'char_shinobi_e', svg: CHAR_SHINOBI_E, width: 24, height: 32 },
  { id: 'char_shinobi_w', svg: CHAR_SHINOBI_W, width: 24, height: 32 },

  // Kunoichi (24x32)
  { id: 'char_kunoichi_s', svg: CHAR_KUNOICHI_S, width: 24, height: 32 },
  { id: 'char_kunoichi_n', svg: CHAR_KUNOICHI_N, width: 24, height: 32 },
  { id: 'char_kunoichi_e', svg: CHAR_KUNOICHI_E, width: 24, height: 32 },
  { id: 'char_kunoichi_w', svg: CHAR_KUNOICHI_W, width: 24, height: 32 },
];
