import type { TileType } from '../types/tiles.ts';
import { TILE_INDEX_TO_TYPE, TILE_TYPE_TO_INDEX, TILE_REGISTRY } from '../types/tiles.ts';

/**
 * Flat Uint8Array-backed tile grid for efficient storage and access.
 * Each cell stores a numeric index into TILE_INDEX_TO_TYPE.
 */
export class TileMap {
  readonly width: number;
  readonly height: number;
  private tiles: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = new Uint8Array(width * height);
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }

  getTileType(x: number, y: number): TileType {
    if (!this.isInBounds(x, y)) return 'fence';
    return TILE_INDEX_TO_TYPE[this.tiles[this.index(x, y)]];
  }

  setTile(x: number, y: number, type: TileType): void {
    if (!this.isInBounds(x, y)) return;
    this.tiles[this.index(x, y)] = TILE_TYPE_TO_INDEX[type];
  }

  isWalkable(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return false;
    const type = this.getTileType(x, y);
    return TILE_REGISTRY[type].walkable;
  }

  isTransparent(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return false;
    const type = this.getTileType(x, y);
    return TILE_REGISTRY[type].transparent;
  }

  getSpriteId(x: number, y: number): string {
    const type = this.getTileType(x, y);
    return TILE_REGISTRY[type].spriteId;
  }

  /** Serialize for save data */
  serialize(): { width: number; height: number; tiles: number[] } {
    return {
      width: this.width,
      height: this.height,
      tiles: Array.from(this.tiles),
    };
  }

  /** Deserialize from save data */
  static deserialize(data: { width: number; height: number; tiles: number[] }): TileMap {
    const map = new TileMap(data.width, data.height);
    map.tiles = new Uint8Array(data.tiles);
    return map;
  }
}
