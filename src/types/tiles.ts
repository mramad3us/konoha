export type TileType =
  | 'grass1'
  | 'grass2'
  | 'grass3'
  | 'dirt'
  | 'stone'
  | 'fence'
  | 'water'
  | 'gate';

export interface TileDefinition {
  spriteId: string;
  walkable: boolean;
  transparent: boolean;
  description: string;
}

/**
 * Registry of all tile types and their properties.
 * The spriteId maps to the sprite manifest for rendering.
 */
export const TILE_REGISTRY: Record<TileType, TileDefinition> = {
  grass1:  { spriteId: 'tile_grass1',  walkable: true,  transparent: true,  description: 'Grass' },
  grass2:  { spriteId: 'tile_grass2',  walkable: true,  transparent: true,  description: 'Grass' },
  grass3:  { spriteId: 'tile_grass3',  walkable: true,  transparent: true,  description: 'Grass' },
  dirt:    { spriteId: 'tile_dirt',    walkable: true,  transparent: true,  description: 'Dirt path' },
  stone:   { spriteId: 'tile_stone',   walkable: true,  transparent: true,  description: 'Stone floor' },
  fence:   { spriteId: 'tile_fence',   walkable: false, transparent: false, description: 'Wooden fence' },
  water:   { spriteId: 'tile_water',   walkable: false, transparent: true,  description: 'Water' },
  gate:    { spriteId: 'tile_gate',    walkable: true,  transparent: true,  description: 'Gate' },
} as const;

/** Numeric index to TileType mapping for Uint8Array storage */
export const TILE_INDEX_TO_TYPE: TileType[] = [
  'grass1', 'grass2', 'grass3', 'dirt', 'stone', 'fence', 'water', 'gate',
];

/** TileType to numeric index for Uint8Array storage */
export const TILE_TYPE_TO_INDEX: Record<TileType, number> = {
  grass1: 0, grass2: 1, grass3: 2, dirt: 3, stone: 4, fence: 5, water: 6, gate: 7,
} as const;
