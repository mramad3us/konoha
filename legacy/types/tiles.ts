export type TileType =
  | 'grass1'
  | 'grass2'
  | 'grass3'
  | 'dirt'
  | 'stone'
  | 'fence'
  | 'water'
  | 'gate'
  // Village tiles
  | 'road'
  | 'wooden_floor'
  | 'building_wall'
  | 'door'
  | 'bridge'
  | 'roof'
  | 'sand'
  | 'deep_water'
  | 'cliff';

export interface TileDefinition {
  spriteId: string;
  walkable: boolean;
  transparent: boolean;
  description: string;
}

export const TILE_REGISTRY: Record<TileType, TileDefinition> = {
  grass1:        { spriteId: 'tile_grass1',        walkable: true,  transparent: true,  description: 'Grass' },
  grass2:        { spriteId: 'tile_grass2',        walkable: true,  transparent: true,  description: 'Grass' },
  grass3:        { spriteId: 'tile_grass3',        walkable: true,  transparent: true,  description: 'Grass' },
  dirt:          { spriteId: 'tile_dirt',          walkable: true,  transparent: true,  description: 'Dirt path' },
  stone:         { spriteId: 'tile_stone',         walkable: true,  transparent: true,  description: 'Stone floor' },
  fence:         { spriteId: 'tile_fence',         walkable: false, transparent: false, description: 'Wooden fence' },
  water:         { spriteId: 'tile_water',         walkable: false, transparent: true,  description: 'Water' },
  gate:          { spriteId: 'tile_gate',          walkable: true,  transparent: true,  description: 'Gate' },
  road:          { spriteId: 'tile_road',          walkable: true,  transparent: true,  description: 'Packed earth road' },
  wooden_floor:  { spriteId: 'tile_wooden_floor',  walkable: true,  transparent: true,  description: 'Wooden floor' },
  building_wall: { spriteId: 'tile_building_wall', walkable: false, transparent: false, description: 'Building wall' },
  door:          { spriteId: 'tile_door',          walkable: true,  transparent: true,  description: 'Doorway' },
  bridge:        { spriteId: 'tile_bridge',        walkable: true,  transparent: true,  description: 'Wooden bridge' },
  roof:          { spriteId: 'tile_roof',          walkable: false, transparent: false, description: 'Roof tiles' },
  sand:          { spriteId: 'tile_sand',          walkable: true,  transparent: true,  description: 'Sand' },
  deep_water:    { spriteId: 'tile_deep_water',    walkable: false, transparent: true,  description: 'Deep water' },
  cliff:         { spriteId: 'tile_cliff',         walkable: false, transparent: false, description: 'Cliff face' },
} as const;

export const TILE_INDEX_TO_TYPE: TileType[] = [
  'grass1', 'grass2', 'grass3', 'dirt', 'stone', 'fence', 'water', 'gate',
  'road', 'wooden_floor', 'building_wall', 'door', 'bridge', 'roof', 'sand', 'deep_water', 'cliff',
];

export const TILE_TYPE_TO_INDEX: Record<TileType, number> = {
  grass1: 0, grass2: 1, grass3: 2, dirt: 3, stone: 4, fence: 5, water: 6, gate: 7,
  road: 8, wooden_floor: 9, building_wall: 10, door: 11, bridge: 12, roof: 13, sand: 14, deep_water: 15, cliff: 16,
} as const;
