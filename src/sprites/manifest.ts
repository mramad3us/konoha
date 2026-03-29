import type { PixelPattern } from './pixelPatterns.ts';
import { TILE_GRASS1, TILE_GRASS2, TILE_GRASS3, TILE_DIRT, TILE_STONE, TILE_FENCE, TILE_WATER, TILE_GATE } from './tiles.ts';
import { TILE_ROAD, TILE_WOODEN_FLOOR, TILE_BUILDING_WALL, TILE_DOOR, TILE_BRIDGE, TILE_ROOF, TILE_SAND, TILE_DEEP_WATER, TILE_CLIFF } from './tilesVillage.ts';
import {
  OBJ_DUMMY, OBJ_TREE_SMALL, OBJ_TREE_LARGE, OBJ_TREE_WILLOW,
  OBJ_BUSH_SMALL, OBJ_BUSH_BERRY, OBJ_BUSH_TALL, OBJ_BUSH_FLOWER,
  OBJ_TALL_GRASS, OBJ_REEDS,
  OBJ_ROCK_SMALL, OBJ_ROCK_MEDIUM, OBJ_ROCK_LARGE, OBJ_ROCK_MOSSY,
  OBJ_SLEEPING_BAG, OBJ_TORCH_PILLAR,
  OBJ_DOOR_CLOSED, OBJ_DOOR_OPEN,
  OBJ_DESK, OBJ_SHELF, OBJ_COUNTER, OBJ_WEAPONS_RACK, OBJ_MEDICINE_CABINET,
  OBJ_WELL, OBJ_BARREL, OBJ_SCARECROW,
} from './objects.ts';
import {
  CHAR_SHINOBI_S, CHAR_SHINOBI_N, CHAR_SHINOBI_E, CHAR_SHINOBI_W,
  CHAR_KUNOICHI_S, CHAR_KUNOICHI_N, CHAR_KUNOICHI_E, CHAR_KUNOICHI_W,
  CHAR_SHINOBI_PRONE, CHAR_KUNOICHI_PRONE,
  CHAR_TAKESHI_S, CHAR_TAKESHI_N, CHAR_TAKESHI_E, CHAR_TAKESHI_W, CHAR_TAKESHI_PRONE,
  CHAR_ANBU_S, CHAR_ANBU_N, CHAR_ANBU_E, CHAR_ANBU_W, CHAR_ANBU_PRONE,
  CHAR_ANBU2_S, CHAR_ANBU2_N, CHAR_ANBU2_E, CHAR_ANBU2_W, CHAR_ANBU2_PRONE,
  CHAR_ANBU3_S, CHAR_ANBU3_N, CHAR_ANBU3_E, CHAR_ANBU3_W, CHAR_ANBU3_PRONE,
  CHAR_ANBU4_S, CHAR_ANBU4_N, CHAR_ANBU4_E, CHAR_ANBU4_W, CHAR_ANBU4_PRONE,
  CHAR_ANBU5_S, CHAR_ANBU5_N, CHAR_ANBU5_E, CHAR_ANBU5_W, CHAR_ANBU5_PRONE,
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
  // Village tiles
  { id: 'tile_road',          pattern: TILE_ROAD,          displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_wooden_floor',  pattern: TILE_WOODEN_FLOOR,  displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_building_wall', pattern: TILE_BUILDING_WALL, displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_door',          pattern: TILE_DOOR,          displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_bridge',        pattern: TILE_BRIDGE,        displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_roof',          pattern: TILE_ROOF,          displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_sand',          pattern: TILE_SAND,          displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_deep_water',    pattern: TILE_DEEP_WATER,    displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },
  { id: 'tile_cliff',         pattern: TILE_CLIFF,         displayWidth: TILE_WIDTH, displayHeight: TILE_HEIGHT },

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

  // Furniture
  { id: 'obj_desk',             pattern: OBJ_DESK,             displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_shelf',            pattern: OBJ_SHELF,            displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_counter',          pattern: OBJ_COUNTER,          displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_weapons_rack',     pattern: OBJ_WEAPONS_RACK,     displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_medicine_cabinet', pattern: OBJ_MEDICINE_CABINET, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_well',             pattern: OBJ_WELL,             displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_barrel',           pattern: OBJ_BARREL,           displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_scarecrow',        pattern: OBJ_SCARECROW,        displayWidth: 48, displayHeight: 48, outline: true },

  // Doors
  { id: 'obj_door_closed', pattern: OBJ_DOOR_CLOSED, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'obj_door_open', pattern: OBJ_DOOR_OPEN, displayWidth: 48, displayHeight: 48 },

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

  // Takeshi (sparring partner)
  { id: 'char_takeshi_s', pattern: CHAR_TAKESHI_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_takeshi_n', pattern: CHAR_TAKESHI_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_takeshi_e', pattern: CHAR_TAKESHI_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_takeshi_w', pattern: CHAR_TAKESHI_W, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_takeshi_prone', pattern: CHAR_TAKESHI_PRONE, displayWidth: 48, displayHeight: 48, outline: true },

  // ANBU
  { id: 'char_anbu_s', pattern: CHAR_ANBU_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu_n', pattern: CHAR_ANBU_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu_e', pattern: CHAR_ANBU_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu_w', pattern: CHAR_ANBU_W, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu_prone', pattern: CHAR_ANBU_PRONE, displayWidth: 48, displayHeight: 48, outline: true },

  // ANBU variant 2 (black hair, off-white mask)
  { id: 'char_anbu2_s', pattern: CHAR_ANBU2_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu2_n', pattern: CHAR_ANBU2_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu2_e', pattern: CHAR_ANBU2_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu2_w', pattern: CHAR_ANBU2_W, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu2_prone', pattern: CHAR_ANBU2_PRONE, displayWidth: 48, displayHeight: 48, outline: true },

  // ANBU variant 3 (silver hair, light grey mask)
  { id: 'char_anbu3_s', pattern: CHAR_ANBU3_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu3_n', pattern: CHAR_ANBU3_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu3_e', pattern: CHAR_ANBU3_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu3_w', pattern: CHAR_ANBU3_W, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu3_prone', pattern: CHAR_ANBU3_PRONE, displayWidth: 48, displayHeight: 48, outline: true },

  // ANBU variant 4 (brown hair, warm white mask)
  { id: 'char_anbu4_s', pattern: CHAR_ANBU4_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu4_n', pattern: CHAR_ANBU4_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu4_e', pattern: CHAR_ANBU4_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu4_w', pattern: CHAR_ANBU4_W, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu4_prone', pattern: CHAR_ANBU4_PRONE, displayWidth: 48, displayHeight: 48, outline: true },

  // ANBU variant 5 (purple hair, cool grey mask)
  { id: 'char_anbu5_s', pattern: CHAR_ANBU5_S, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu5_n', pattern: CHAR_ANBU5_N, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu5_e', pattern: CHAR_ANBU5_E, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu5_w', pattern: CHAR_ANBU5_W, displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_anbu5_prone', pattern: CHAR_ANBU5_PRONE, displayWidth: 48, displayHeight: 48, outline: true },

  // Prone / unconscious
  { id: 'char_shinobi_prone',  pattern: CHAR_SHINOBI_PRONE,  displayWidth: 48, displayHeight: 48, outline: true },
  { id: 'char_kunoichi_prone', pattern: CHAR_KUNOICHI_PRONE, displayWidth: 48, displayHeight: 48, outline: true },
];
