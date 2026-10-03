/**
 * Building stamper — stamps rectangular buildings onto a TileMap.
 * Supports multi-room layouts with internal walls and connecting doors.
 */

import { TileMap } from './tileMap.ts';
import type { TileType } from '../types/tiles.ts';

export interface BuildingTemplate {
  x: number;
  y: number;
  w: number;
  h: number;
  floorType?: TileType;
  doorSide?: 'n' | 's' | 'e' | 'w';
  doorOffset?: number; // offset from left/top of the door side
  hasRoof?: boolean;   // if true, add roof tiles above
  label?: string;      // for debugging
}

/** Internal wall divider within a building */
export interface InternalWall {
  /** 'h' = horizontal wall (runs left-right), 'v' = vertical wall (runs top-bottom) */
  orientation: 'h' | 'v';
  /** Absolute position of the wall row (h) or column (v) */
  pos: number;
  /** Start of wall (absolute x for 'h', absolute y for 'v') */
  from: number;
  /** End of wall (absolute x for 'h', absolute y for 'v'), inclusive */
  to: number;
  /** Offset along wall where a door is placed (absolute coord). undefined = no door */
  doorAt?: number;
}

/**
 * Stamp a building onto the tilemap.
 * Creates walls around the perimeter, floor inside, and a door on one side.
 * Returns the door position { x, y } for entity spawning.
 */
export function stampBuilding(map: TileMap, b: BuildingTemplate): { doorX: number; doorY: number } {
  const floor = b.floorType ?? 'wooden_floor';
  const doorOff = b.doorOffset ?? Math.floor(b.w / 2);

  // Fill interior with floor
  for (let dy = 1; dy < b.h - 1; dy++) {
    for (let dx = 1; dx < b.w - 1; dx++) {
      map.setTile(b.x + dx, b.y + dy, floor);
    }
  }

  // Walls (perimeter)
  for (let dx = 0; dx < b.w; dx++) {
    map.setTile(b.x + dx, b.y, 'building_wall');
    map.setTile(b.x + dx, b.y + b.h - 1, 'building_wall');
  }
  for (let dy = 0; dy < b.h; dy++) {
    map.setTile(b.x, b.y + dy, 'building_wall');
    map.setTile(b.x + b.w - 1, b.y + dy, 'building_wall');
  }

  // Door
  const side = b.doorSide ?? 's';
  let doorX: number, doorY: number;

  switch (side) {
    case 's':
      doorX = b.x + doorOff;
      doorY = b.y + b.h - 1;
      break;
    case 'n':
      doorX = b.x + doorOff;
      doorY = b.y;
      break;
    case 'e':
      doorX = b.x + b.w - 1;
      doorY = b.y + doorOff;
      break;
    case 'w':
      doorX = b.x;
      doorY = b.y + doorOff;
      break;
  }

  map.setTile(doorX, doorY, 'door');
  // Also make tile next to door walkable (approach path)
  switch (side) {
    case 's': map.setTile(doorX, doorY + 1, floor === 'wooden_floor' ? 'road' : 'dirt'); break;
    case 'n': map.setTile(doorX, doorY - 1, floor === 'wooden_floor' ? 'road' : 'dirt'); break;
    case 'e': map.setTile(doorX + 1, doorY, floor === 'wooden_floor' ? 'road' : 'dirt'); break;
    case 'w': map.setTile(doorX - 1, doorY, floor === 'wooden_floor' ? 'road' : 'dirt'); break;
  }

  return { doorX, doorY };
}

/**
 * Stamp internal walls inside an already-stamped building.
 * Call AFTER stampBuilding(). Places wall tiles along the specified line
 * and a door tile at the optional doorAt position.
 */
export function stampInternalWalls(map: TileMap, walls: InternalWall[]): void {
  for (const w of walls) {
    if (w.orientation === 'h') {
      // Horizontal wall: fixed y = w.pos, x runs from w.from to w.to
      for (let x = w.from; x <= w.to; x++) {
        if (w.doorAt !== undefined && x === w.doorAt) {
          map.setTile(x, w.pos, 'door');
        } else {
          map.setTile(x, w.pos, 'building_wall');
        }
      }
    } else {
      // Vertical wall: fixed x = w.pos, y runs from w.from to w.to
      for (let y = w.from; y <= w.to; y++) {
        if (w.doorAt !== undefined && y === w.doorAt) {
          map.setTile(w.pos, y, 'door');
        } else {
          map.setTile(w.pos, y, 'building_wall');
        }
      }
    }
  }
}

/**
 * Stamp a road (horizontal or vertical strip).
 */
export function stampRoad(map: TileMap, x1: number, y1: number, x2: number, y2: number, width: number = 3): void {
  if (x1 === x2) {
    // Vertical road
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      for (let dx = 0; dx < width; dx++) {
        map.setTile(x1 + dx, y, 'road');
      }
    }
  } else if (y1 === y2) {
    // Horizontal road
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      for (let dy = 0; dy < width; dy++) {
        map.setTile(x, y1 + dy, 'road');
      }
    }
  }
}

/**
 * Stamp a river (horizontal water band with optional bridges).
 */
export function stampRiver(
  map: TileMap,
  y: number,
  depth: number,
  mapWidth: number,
  bridgeXPositions: number[],
  bridgeWidth: number = 5,
): void {
  for (let x = 0; x < mapWidth; x++) {
    for (let dy = 0; dy < depth; dy++) {
      // Check if this is a bridge position
      const isBridge = bridgeXPositions.some(bx => x >= bx && x < bx + bridgeWidth);
      if (isBridge) {
        map.setTile(x, y + dy, 'bridge');
      } else {
        // Deeper in the middle
        const isDeep = dy >= 1 && dy < depth - 1;
        map.setTile(x, y + dy, isDeep ? 'deep_water' : 'water');
      }
    }
  }
}

/**
 * Fill a rectangular area with a tile type.
 */
export function fillRect(map: TileMap, x: number, y: number, w: number, h: number, type: TileType): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      map.setTile(x + dx, y + dy, type);
    }
  }
}
