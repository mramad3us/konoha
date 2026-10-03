/**
 * Terrain and prop registries.
 *
 * Tiles: ground type per cell (Uint8). Props: static scenery per cell (Uint16) — trees, rocks,
 * grass, fences, lanterns. Props are not entities: they are cheap, numerous and immutable
 * except through explicit level edits.
 */

export interface TileDef {
  key: string;
  name: string;
  walkable: boolean;
  /** Water: swim or water-walk. */
  water: 0 | 1 | 2;   // 0 none, 1 shallow (wade), 2 deep (swim)
  /** Footstep noise multiplier. */
  noise: number;
}

const TILE_LIST = [
  { key: 'void', name: 'nothing', walkable: false, water: 0, noise: 1 },
  { key: 'grass', name: 'grass', walkable: true, water: 0, noise: 0.8 },
  { key: 'grass_lush', name: 'lush grass', walkable: true, water: 0, noise: 0.8 },
  { key: 'dirt', name: 'packed earth', walkable: true, water: 0, noise: 1 },
  { key: 'road', name: 'stone road', walkable: true, water: 0, noise: 1.2 },
  { key: 'plaza', name: 'paved plaza', walkable: true, water: 0, noise: 1.2 },
  { key: 'sand', name: 'sand', walkable: true, water: 0, noise: 0.7 },
  { key: 'planks', name: 'wooden planks', walkable: true, water: 0, noise: 1.4 },
  { key: 'shallow', name: 'shallow water', walkable: true, water: 1, noise: 1.5 },
  { key: 'deep', name: 'deep water', walkable: false, water: 2, noise: 1.5 },
  { key: 'field', name: 'tilled field', walkable: true, water: 0, noise: 1 },
  { key: 'forest_floor', name: 'forest floor', walkable: true, water: 0, noise: 1.1 },
  { key: 'rock', name: 'bare rock', walkable: true, water: 0, noise: 1.2 },
] as const satisfies readonly TileDef[];

export type TileKey = typeof TILE_LIST[number]['key'];
export const TILES: readonly TileDef[] = TILE_LIST;
export const T = Object.fromEntries(TILE_LIST.map((t, i) => [t.key, i])) as Record<TileKey, number>;

export interface PropDef {
  key: string;
  name: string;
  /** Blocks movement. */
  solid: boolean;
  /** Blocks sight. */
  opaque: boolean;
  /** Standing in/behind it hides you (stealth cover). */
  cover: boolean;
  /** Light radius in tiles (0 = none). Only lit at night. */
  light: number;
  /** Art key in the prop atlas. */
  art: string;
  description: string;
}

const PROP_LIST = [
  { key: 'none', name: '', solid: false, opaque: false, cover: false, light: 0, art: '', description: '' },
  { key: 'tree_pine', name: 'pine', solid: true, opaque: true, cover: false, light: 0, art: 'tree_pine', description: 'A tall pine. Its needles smell of resin.' },
  { key: 'tree_broad', name: 'broadleaf tree', solid: true, opaque: true, cover: false, light: 0, art: 'tree_broad', description: 'A broad old tree, branches heavy with leaves.' },
  { key: 'tree_sakura', name: 'cherry tree', solid: true, opaque: true, cover: false, light: 0, art: 'tree_sakura', description: 'Pink blossoms drift from its branches.' },
  { key: 'tree_dead', name: 'dead tree', solid: true, opaque: false, cover: false, light: 0, art: 'tree_dead', description: 'A bare, lightning-split trunk.' },
  { key: 'bush', name: 'bush', solid: false, opaque: false, cover: true, light: 0, art: 'bush', description: 'Dense enough to crouch behind.' },
  { key: 'tall_grass', name: 'tall grass', solid: false, opaque: false, cover: true, light: 0, art: 'tall_grass', description: 'Waist-high grass. Good for hiding.' },
  { key: 'reeds', name: 'reeds', solid: false, opaque: false, cover: true, light: 0, art: 'reeds', description: 'Reeds rustle at the water\'s edge.' },
  { key: 'flowers', name: 'flowers', solid: false, opaque: false, cover: false, light: 0, art: 'flowers', description: 'Small wildflowers.' },
  { key: 'rock_small', name: 'stone', solid: false, opaque: false, cover: false, light: 0, art: 'rock_small', description: 'A weathered stone.' },
  { key: 'rock_large', name: 'boulder', solid: true, opaque: false, cover: false, light: 0, art: 'rock_large', description: 'A mossy boulder.' },
  { key: 'stump', name: 'stump', solid: true, opaque: false, cover: false, light: 0, art: 'stump', description: 'An old cut stump.' },
  { key: 'log', name: 'fallen log', solid: true, opaque: false, cover: false, light: 0, art: 'log', description: 'A rotting log.' },
  { key: 'fence', name: 'fence', solid: true, opaque: false, cover: false, light: 0, art: 'fence', description: 'A wooden fence.' },
  { key: 'palisade', name: 'palisade', solid: true, opaque: true, cover: false, light: 0, art: 'palisade', description: 'The village wall: sharpened timber, lashed tight.' },
  { key: 'lantern', name: 'stone lantern', solid: true, opaque: false, cover: false, light: 4, art: 'lantern', description: 'A stone tōrō. Lit at dusk.' },
  { key: 'torch', name: 'torch', solid: true, opaque: false, cover: false, light: 4, art: 'torch', description: 'A torch on a pole.' },
  { key: 'campfire', name: 'campfire', solid: true, opaque: false, cover: false, light: 5, art: 'campfire', description: 'Embers and a cook pot.' },
  { key: 'barrel', name: 'barrel', solid: true, opaque: false, cover: false, light: 0, art: 'barrel', description: 'A water barrel.' },
  { key: 'crates', name: 'crates', solid: true, opaque: false, cover: false, light: 0, art: 'crates', description: 'Stacked supply crates.' },
  { key: 'tent', name: 'tent', solid: true, opaque: true, cover: false, light: 0, art: 'tent', description: 'A patched canvas tent.' },
  { key: 'bedroll', name: 'bedroll', solid: false, opaque: false, cover: false, light: 0, art: 'bedroll', description: 'A bedroll, still warm.' },
  { key: 'well', name: 'well', solid: true, opaque: false, cover: false, light: 0, art: 'well', description: 'A stone well.' },
  { key: 'bench', name: 'bench', solid: true, opaque: false, cover: false, light: 0, art: 'bench', description: 'A wooden bench.' },
  { key: 'post', name: 'training post', solid: true, opaque: false, cover: false, light: 0, art: 'post', description: 'A wooden post, scarred by kunai.' },
  { key: 'target', name: 'target board', solid: true, opaque: false, cover: false, light: 0, art: 'target', description: 'A straw target for throwing practice.' },
  { key: 'sign', name: 'signpost', solid: true, opaque: false, cover: false, light: 0, art: 'sign', description: 'A weathered signpost.' },
  { key: 'stall', name: 'market stall', solid: true, opaque: false, cover: false, light: 0, art: 'stall', description: 'A stall under a cloth awning.' },
  { key: 'planter', name: 'planter', solid: true, opaque: false, cover: false, light: 0, art: 'planter', description: 'A planter of trimmed shrubs.' },
  { key: 'cliff', name: 'cliff', solid: true, opaque: true, cover: false, light: 0, art: 'cliff', description: 'Sheer rock.' },
] as const satisfies readonly PropDef[];

export type PropKey = typeof PROP_LIST[number]['key'];
export const PROPS: readonly PropDef[] = PROP_LIST;
export const P = Object.fromEntries(PROP_LIST.map((p, i) => [p.key, i])) as Record<PropKey, number>;
