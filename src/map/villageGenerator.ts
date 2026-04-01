/**
 * Konoha Village Generator — City Builder Methodology
 *
 * 7 layers, each depends on the previous:
 * 1. DISTRICT ZONING — purpose of each area
 * 2. STREET GRID — how people get around
 * 3. BUILDING PLOTS — where structures go (facing streets)
 * 4. BUILDINGS — stamp walls, floors, doors
 * 5. INTERIORS — furniture fitting each building's purpose
 * 6. POPULATION — NPCs placed where they'd logically be
 * 7. DECORATION — trees, lanterns, signs, life
 */

import { TileMap } from './tileMap.ts';
import { TRAINING_GROUNDS_LAYOUT } from './mapData.ts';
import { World } from '../engine/world.ts';
import { TILE_INDEX_TO_TYPE } from '../types/tiles.ts';
import type { TileType } from '../types/tiles.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import { DEFAULT_SHINOBI_SHEET } from '../types/character.ts';
import { computeMaxHp, computeMaxChakra, computeMaxWillpower, computeMaxStamina } from '../engine/derivedStats.ts';
import { stampBuilding, stampInternalWalls, stampRoad, stampRiver, fillRect } from './buildingStamper.ts';
import { spawnVillageNpcs } from '../data/villageNpcs.ts';
import { spawnVillageObjects, spawnDoor } from '../data/villageObjects.ts';
import { MAX_THROWN_AMMO } from '../core/constants.ts';

/** Buildings whose doors should NOT lock at night (public/essential buildings).
 *  Format: [x, y, w, h] bounding boxes for each building. */
const ALWAYS_OPEN_BUILDINGS: Array<[number, number, number, number]> = [
  [55, 72, 20, 12],   // Hokage Tower
  [58, 86, 14, 7],    // Mission Desk
  [55, 93, 10, 6],    // Council Room
  [56, 10, 20, 10],   // Academy
  [56, 32, 8, 6],     // Instructor Office
  [15, 82, 18, 12],   // Hospital
  [15, 96, 10, 6],    // Clinic
  [60, 115, 12, 10],  // Inn
  [66, 147, 6, 5],    // Guard Post W
  [88, 147, 6, 5],    // Guard Post E
];

function isAlwaysOpenDoor(x: number, y: number): boolean {
  for (const [bx, by, bw, bh] of ALWAYS_OPEN_BUILDINGS) {
    if (x >= bx && x < bx + bw && y >= by && y < by + bh) return true;
  }
  return false;
}
import {
  VILLAGE_WIDTH, VILLAGE_HEIGHT,
  VILLAGE_PLAYER_START_X, VILLAGE_PLAYER_START_Y,
  TG_OFFSET_X, TG_OFFSET_Y,
  TRAINING_GROUNDS_WIDTH, TRAINING_GROUNDS_HEIGHT,
  GAME_START_HOUR,
  BASE_PLAYER_DAMAGE, BASE_PLAYER_ACCURACY, BASE_PLAYER_EVASION,
} from '../core/constants.ts';

export function generateVillage(playerName: string, playerGender: 'shinobi' | 'kunoichi', devMode: boolean = false): World {
  const W = VILLAGE_WIDTH;
  const H = VILLAGE_HEIGHT;
  const tileMap = new TileMap(W, H);

  // ╔══════════════════════════════════════╗
  // ║  LAYER 0: BASE TERRAIN               ║
  // ╚══════════════════════════════════════╝
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      tileMap.setTile(x, y, TILE_INDEX_TO_TYPE[cellHash(x, y) % 3]);
    }
  }

  // Border: 4-tile cliff wall
  for (let x = 0; x < W; x++) {
    for (let d = 0; d < 4; d++) {
      tileMap.setTile(x, d, 'cliff');
      tileMap.setTile(x, H - 1 - d, 'cliff');
    }
  }
  for (let y = 4; y < H - 4; y++) {
    for (let d = 0; d < 4; d++) {
      tileMap.setTile(d, y, 'cliff');
      tileMap.setTile(W - 1 - d, y, 'cliff');
    }
  }

  // ╔══════════════════════════════════════╗
  // ║  LAYER 1: DISTRICT ZONING            ║
  // ║  (ground treatment per district)      ║
  // ╚══════════════════════════════════════╝

  // Training Grounds — copy existing 40×40 layout
  for (let ty = 0; ty < TRAINING_GROUNDS_HEIGHT; ty++) {
    for (let tx = 0; tx < TRAINING_GROUNDS_WIDTH; tx++) {
      const raw = TRAINING_GROUNDS_LAYOUT[ty * TRAINING_GROUNDS_WIDTH + tx];
      let t: TileType;
      if (raw <= 2) t = TILE_INDEX_TO_TYPE[cellHash(tx + TG_OFFSET_X, ty + TG_OFFSET_Y) % 3];
      else t = TILE_INDEX_TO_TYPE[raw];
      tileMap.setTile(TG_OFFSET_X + tx, TG_OFFSET_Y + ty, t);
    }
  }

  // Gate Plaza — wide stone approach
  fillRect(tileMap, 68, 143, 24, 12, 'stone');

  // Market Square — open stone trading area
  fillRect(tileMap, 98, 75, 38, 10, 'stone');

  // Academy Yard — sand training area
  fillRect(tileMap, 58, 21, 18, 8, 'sand');

  // Memorial Stone clearing
  fillRect(tileMap, 48, 58, 8, 5, 'stone');

  // ╔══════════════════════════════════════╗
  // ║  LAYER 2: STREET GRID                ║
  // ║  (roads connect everything)           ║
  // ╚══════════════════════════════════════╝

  // === MAIN AVENUE (N-S backbone) ===
  stampRoad(tileMap, 75, 35, 75, 145, 3);

  // === MARKET ROAD (E-W, south of river) ===
  stampRoad(tileMap, 15, 80, 145, 80, 3);

  // === ACADEMY ROAD (E-W, north) ===
  stampRoad(tileMap, 30, 30, 140, 30, 2);

  // === RESIDENTIAL LANE WEST (N-S) ===
  stampRoad(tileMap, 30, 70, 30, 140, 2);

  // === RESIDENTIAL LANE EAST (N-S) ===
  stampRoad(tileMap, 120, 70, 120, 140, 2);

  // === Gate approach (wider) ===
  stampRoad(tileMap, 75, 145, 75, 155, 3);

  // === Secondary: training grounds connection ===
  stampRoad(tileMap, 46, 35, 75, 35, 2); // TG east edge → main avenue

  // === Secondary: hospital approach ===
  stampRoad(tileMap, 34, 80, 34, 95, 2);

  // === Secondary: commercial strip ===
  stampRoad(tileMap, 60, 96, 60, 120, 2);

  // === Secondary: market internal lane ===
  stampRoad(tileMap, 98, 86, 140, 86, 2);

  // === Residential cross-streets ===
  stampRoad(tileMap, 10, 110, 50, 110, 2);
  stampRoad(tileMap, 10, 125, 50, 125, 2);
  stampRoad(tileMap, 95, 110, 145, 110, 2);
  stampRoad(tileMap, 95, 125, 145, 125, 2);

  // ╔══════════════════════════════════════╗
  // ║  LAYER 2b: RIVER + BRIDGES           ║
  // ╚══════════════════════════════════════╝
  // River at rows 64-69, bridges align with N-S roads
  stampRiver(tileMap, 64, 6, W, [30, 75, 120], 5);

  // River walk (dirt path along north bank)
  stampRoad(tileMap, 6, 63, 154, 63, 1);

  // Gate opening
  for (let d = 0; d < 4; d++) {
    tileMap.setTile(76, 156 + d, 'road');
    tileMap.setTile(77, 156 + d, 'road');
    tileMap.setTile(78, 156 + d, 'road');
  }
  tileMap.setTile(76, 155, 'gate');
  tileMap.setTile(77, 155, 'gate');
  tileMap.setTile(78, 155, 'gate');

  // --- DEAD ZONE FILLS (before buildings!) ---
  fillRect(tileMap, 42, 8, 14, 10, 'dirt'); // North park
  fillRect(tileMap, 45, 10, 3, 3, 'water'); // park pond
  stampRoad(tileMap, 42, 18, 55, 18, 2); // park path
  fillRect(tileMap, 55, 130, 20, 10, 'dirt'); // South park
  fillRect(tileMap, 60, 133, 4, 3, 'water'); // south park pond
  fillRect(tileMap, 142, 72, 8, 8, 'stone'); // Shrine platform
  fillRect(tileMap, 6, 100, 8, 12, 'dirt'); // Farm field west
  fillRect(tileMap, 6, 115, 8, 12, 'dirt'); // Farm field 2
  fillRect(tileMap, 73, 78, 7, 5, 'stone'); // Well plaza
  stampRoad(tileMap, 42, 30, 55, 30, 2); // park to academy
  stampRoad(tileMap, 90, 80, 98, 80, 2); // avenue to market
  stampRoad(tileMap, 50, 100, 60, 100, 2); // residential to commercial

  // ╔══════════════════════════════════════╗
  // ║  LAYER 3-4: BUILDING PLOTS + STAMP   ║
  // ║  (buildings LAST so walls never erased║
  // ║  Multi-room with internal walls       ║
  // ╚══════════════════════════════════════╝

  // ─── GOVERNMENT QUARTER (stone, south of river, west of main avenue) ───

  // Hokage Tower: 20×12 — Single open hall with Hokage's office
  stampBuilding(tileMap, { x: 55, y: 72, w: 20, h: 12, floorType: 'stone', doorSide: 's', doorOffset: 10, label: 'Hokage Tower' });

  // Mission Desk: 14×7 — Counter area (front), back office
  stampBuilding(tileMap, { x: 58, y: 86, w: 14, h: 7, floorType: 'stone', doorSide: 's', doorOffset: 7, label: 'Mission Desk' });
  stampInternalWalls(tileMap, [
    { orientation: 'h', pos: 89, from: 59, to: 70, doorAt: 64 },
  ]);

  // Council Chamber: 10×7 — Single room with table
  stampBuilding(tileMap, { x: 55, y: 93, w: 10, h: 6, floorType: 'stone', doorSide: 'e', doorOffset: 3, label: 'Council Room' });

  // ─── ACADEMY DISTRICT (north, near main avenue) ───

  // Academy: 20×10 — Main classroom (top-left), practice hall (top-right), storage (bottom)
  stampBuilding(tileMap, { x: 56, y: 10, w: 20, h: 10, floorType: 'stone', doorSide: 's', doorOffset: 10, label: 'Academy' });
  stampInternalWalls(tileMap, [
    // Vertical wall: classroom (left) | practice hall (right) at x=66
    { orientation: 'v', pos: 66, from: 11, to: 15, doorAt: 13 },
    // Horizontal wall: top rooms | bottom corridor at y=16
    { orientation: 'h', pos: 16, from: 57, to: 74, doorAt: 62 },
  ]);

  // Library: 10×8 — Reading room (front), restricted section (back)
  stampBuilding(tileMap, { x: 78, y: 10, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 's', doorOffset: 5, label: 'Library' });
  stampInternalWalls(tileMap, [
    { orientation: 'h', pos: 14, from: 79, to: 86, doorAt: 83 },
  ]);

  // Instructor Office: 8×6
  stampBuilding(tileMap, { x: 56, y: 32, w: 8, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'Instructor Office' });

  // ─── COMMERCIAL STRIP (both sides of main avenue) ───

  // Konoha Kitchen: 10×8 — Dining area (front), kitchen (back)
  stampBuilding(tileMap, { x: 62, y: 97, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 4, label: 'Konoha Kitchen' });
  stampInternalWalls(tileMap, [
    { orientation: 'v', pos: 67, from: 98, to: 103, doorAt: 100 },
  ]);

  // Tea House: 9×6 — Seating (front), prep room (back)
  stampBuilding(tileMap, { x: 62, y: 107, w: 9, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'Tea House' });
  stampInternalWalls(tileMap, [
    { orientation: 'v', pos: 67, from: 108, to: 111, doorAt: 109 },
  ]);

  // Inn: 12×10 — Lobby (front), room 1 (back-left), room 2 (back-right)
  stampBuilding(tileMap, { x: 60, y: 115, w: 12, h: 10, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 5, label: 'Inn' });
  stampInternalWalls(tileMap, [
    // Horizontal wall: lobby (bottom) | rooms (top) at y=119
    { orientation: 'h', pos: 119, from: 61, to: 70, doorAt: 64 },
    // Vertical wall: room 1 (left) | room 2 (right) at x=66
    { orientation: 'v', pos: 66, from: 116, to: 118, doorAt: 117 },
  ]);

  // East side of avenue
  // Barbershop: 8×6
  stampBuilding(tileMap, { x: 80, y: 97, w: 8, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'Barbershop' });

  // Dango Shop: 8×6
  stampBuilding(tileMap, { x: 80, y: 105, w: 8, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'Dango Shop' });

  // General Store: 10×7 — Front shop, back storage
  stampBuilding(tileMap, { x: 80, y: 113, w: 10, h: 7, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'General Store' });
  stampInternalWalls(tileMap, [
    { orientation: 'v', pos: 85, from: 114, to: 118, doorAt: 116 },
  ]);

  // ─── MARKET PLAZA (east side, buildings face the square) ───

  // Weapons Shop: 9×7 — Showroom (front), forge room (back)
  stampBuilding(tileMap, { x: 98, y: 72, w: 9, h: 7, floorType: 'wooden_floor', doorSide: 's', doorOffset: 4, label: 'Weapons Shop' });
  stampInternalWalls(tileMap, [
    { orientation: 'h', pos: 75, from: 99, to: 105, doorAt: 102 },
  ]);

  // Supply Shop: 9×7 — Front counter, back storage
  stampBuilding(tileMap, { x: 109, y: 72, w: 9, h: 7, floorType: 'wooden_floor', doorSide: 's', doorOffset: 4, label: 'Supply Shop' });
  stampInternalWalls(tileMap, [
    { orientation: 'h', pos: 75, from: 110, to: 116, doorAt: 113 },
  ]);

  // Scroll Shop: 9×7
  stampBuilding(tileMap, { x: 120, y: 72, w: 9, h: 7, floorType: 'wooden_floor', doorSide: 's', doorOffset: 4, label: 'Scroll Shop' });
  stampInternalWalls(tileMap, [
    { orientation: 'h', pos: 75, from: 121, to: 127, doorAt: 124 },
  ]);

  // Forge: 10×8 — Front shop, back forge area
  stampBuilding(tileMap, { x: 131, y: 72, w: 10, h: 8, floorType: 'stone', doorSide: 's', doorOffset: 5, label: 'Forge' });
  stampInternalWalls(tileMap, [
    { orientation: 'h', pos: 76, from: 132, to: 139, doorAt: 135 },
  ]);

  // Clothing Shop: 9×6
  stampBuilding(tileMap, { x: 98, y: 88, w: 9, h: 6, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 4, label: 'Clothing Shop' });

  // Food Stall: 8×5
  stampBuilding(tileMap, { x: 109, y: 88, w: 8, h: 5, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 4, label: 'Food Stall' });

  // ─── HOSPITAL (west, faces market road) ───

  // Hospital: 18×12 — Ward 1 (top-left), Ward 2 (top-right), Treatment (bottom-left), Supply (bottom-right)
  stampBuilding(tileMap, { x: 15, y: 82, w: 18, h: 12, floorType: 'stone', doorSide: 'e', doorOffset: 5, label: 'Hospital' });
  stampInternalWalls(tileMap, [
    // Vertical wall: left wards | right corridor at x=24
    { orientation: 'v', pos: 24, from: 83, to: 92, doorAt: 86 },
    // Horizontal wall: top ward | bottom ward at y=88
    { orientation: 'h', pos: 88, from: 16, to: 23, doorAt: 19 },
    // Horizontal wall in right side: treatment | supply at y=88
    { orientation: 'h', pos: 88, from: 25, to: 31, doorAt: 28 },
  ]);

  // Clinic: 10×6
  stampBuilding(tileMap, { x: 15, y: 96, w: 10, h: 6, floorType: 'stone', doorSide: 'e', doorOffset: 3, label: 'Clinic' });

  // ─── RESIDENTIAL WEST ───
  // Houses: 10×8 each — Living room (front), bedroom (back)
  // Row 1
  stampBuilding(tileMap, { x: 8, y: 102, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House W1' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 106, from: 9, to: 16, doorAt: 12 }]);

  stampBuilding(tileMap, { x: 20, y: 102, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House W2' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 106, from: 21, to: 28, doorAt: 24 }]);

  stampBuilding(tileMap, { x: 34, y: 102, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House W3' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 106, from: 35, to: 42, doorAt: 38 }]);

  stampBuilding(tileMap, { x: 46, y: 102, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House W4' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 106, from: 47, to: 54, doorAt: 50 }]);

  // Row 2
  stampBuilding(tileMap, { x: 8, y: 117, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House W5' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 121, from: 9, to: 16, doorAt: 12 }]);

  stampBuilding(tileMap, { x: 20, y: 117, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House W6' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 121, from: 21, to: 28, doorAt: 24 }]);

  stampBuilding(tileMap, { x: 34, y: 117, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House W7' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 121, from: 35, to: 42, doorAt: 38 }]);

  stampBuilding(tileMap, { x: 46, y: 117, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House W8' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 121, from: 47, to: 54, doorAt: 50 }]);

  // ─── RESIDENTIAL EAST ───
  stampBuilding(tileMap, { x: 96, y: 102, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House E1' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 106, from: 97, to: 104, doorAt: 100 }]);

  stampBuilding(tileMap, { x: 110, y: 102, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House E2' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 106, from: 111, to: 118, doorAt: 114 }]);

  stampBuilding(tileMap, { x: 124, y: 102, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House E3' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 106, from: 125, to: 132, doorAt: 128 }]);

  stampBuilding(tileMap, { x: 96, y: 117, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House E4' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 121, from: 97, to: 104, doorAt: 100 }]);

  stampBuilding(tileMap, { x: 110, y: 117, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House E5' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 121, from: 111, to: 118, doorAt: 114 }]);

  stampBuilding(tileMap, { x: 124, y: 117, w: 10, h: 8, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House E6' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 121, from: 125, to: 132, doorAt: 128 }]);

  // ─── HYUGA COMPOUND (northwest, mini-village) ───
  fillRect(tileMap, 8, 6, 34, 26, 'stone');
  // Main hall: 16×10 — Audience hall + back meditation room
  stampBuilding(tileMap, { x: 10, y: 7, w: 16, h: 10, floorType: 'stone', doorSide: 's', doorOffset: 8, label: 'Hyuga Main Hall' });
  stampInternalWalls(tileMap, [
    { orientation: 'h', pos: 13, from: 11, to: 24, doorAt: 18 },
  ]);
  // Training dojo: 12×8
  stampBuilding(tileMap, { x: 28, y: 7, w: 12, h: 8, floorType: 'stone', doorSide: 's', doorOffset: 6, label: 'Hyuga Dojo' });
  // Residences: 10×7 each with bedroom
  stampBuilding(tileMap, { x: 10, y: 21, w: 10, h: 7, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 5, label: 'Hyuga House 1' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 24, from: 11, to: 18, doorAt: 14 }]);

  stampBuilding(tileMap, { x: 22, y: 21, w: 10, h: 7, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 5, label: 'Hyuga House 2' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 24, from: 23, to: 30, doorAt: 26 }]);

  // Pond + sand + paths
  fillRect(tileMap, 34, 18, 6, 4, 'water');
  stampRoad(tileMap, 16, 17, 32, 17, 2);
  fillRect(tileMap, 28, 16, 10, 4, 'sand');

  // ─── UCHIHA COMPOUND (northeast, mini-village) ───
  fillRect(tileMap, 106, 6, 38, 26, 'stone');
  // Main hall: 18×10 — Audience + armory back
  stampBuilding(tileMap, { x: 108, y: 7, w: 18, h: 10, floorType: 'stone', doorSide: 's', doorOffset: 9, label: 'Uchiha Main Hall' });
  stampInternalWalls(tileMap, [
    { orientation: 'h', pos: 13, from: 109, to: 124, doorAt: 117 },
    { orientation: 'v', pos: 118, from: 14, to: 15, doorAt: 14 },
  ]);
  // Armory: 10×7
  stampBuilding(tileMap, { x: 128, y: 7, w: 12, h: 8, floorType: 'stone', doorSide: 's', doorOffset: 6, label: 'Uchiha Armory' });
  // Residences: 10×7 each
  stampBuilding(tileMap, { x: 108, y: 21, w: 10, h: 7, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 5, label: 'Uchiha House 1' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 24, from: 109, to: 116, doorAt: 112 }]);

  stampBuilding(tileMap, { x: 120, y: 21, w: 10, h: 7, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 5, label: 'Uchiha House 2' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 24, from: 121, to: 128, doorAt: 124 }]);

  stampBuilding(tileMap, { x: 132, y: 21, w: 10, h: 7, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 5, label: 'Uchiha House 3' });
  stampInternalWalls(tileMap, [{ orientation: 'h', pos: 24, from: 133, to: 140, doorAt: 136 }]);

  // Training + paths + pond
  fillRect(tileMap, 128, 16, 10, 4, 'sand');
  stampRoad(tileMap, 114, 17, 138, 17, 2);
  fillRect(tileMap, 108, 18, 4, 3, 'water');

  // ─── GATE GUARD POSTS ───
  stampBuilding(tileMap, { x: 66, y: 147, w: 6, h: 5, floorType: 'stone', doorSide: 'e', doorOffset: 2, label: 'Guard Post W' });
  stampBuilding(tileMap, { x: 88, y: 147, w: 6, h: 5, floorType: 'stone', doorSide: 'w', doorOffset: 2, label: 'Guard Post E' });

  // ─── SHRINE (east, on platform) ───
  stampBuilding(tileMap, { x: 143, y: 73, w: 8, h: 6, floorType: 'stone', doorSide: 's', doorOffset: 4, label: 'Shrine' });

  // ╔══════════════════════════════════════╗
  // ║  CREATE WORLD + PLAYER               ║
  // ╚══════════════════════════════════════╝
  const world = new World(tileMap);
  world.currentTick = Math.round(GAME_START_HOUR * 3600 / 0.1);  // 8 AM in ticks

  const playerId = world.createEntity();
  world.playerEntityId = playerId;
  world.setPosition(playerId, { x: VILLAGE_PLAYER_START_X, y: VILLAGE_PLAYER_START_Y, facing: 'n' });
  world.renderables.set(playerId, { spriteId: `char_${playerGender}_s`, layer: 'character', offsetY: -16 });
  world.blockings.set(playerId, { blocksMovement: true, blocksSight: false });

  const playerSheet = devMode
    ? { class: 'shinobi' as const, rank: 'jounin' as const, title: 'Elite Shinobi',
        skills: { taijutsu: 90, bukijutsu: 90, ninjutsu: 90, genjutsu: 90, med: 90 },
        stats: { phy: 90, cha: 90, men: 90 }, learnedJutsus: ['substitution', 'chakra_sprint', 'water_walk'] }
    : { ...DEFAULT_SHINOBI_SHEET, title: 'Academy Graduate' };
  world.characterSheets.set(playerId, playerSheet);

  const maxHp = computeMaxHp(playerSheet.stats);
  const maxChakra = computeMaxChakra(playerSheet.stats);
  const maxWillpower = computeMaxWillpower(playerSheet.stats);
  const maxStamina = computeMaxStamina(playerSheet.stats);

  world.healths.set(playerId, { current: maxHp, max: maxHp });
  world.combatStats.set(playerId, { damage: BASE_PLAYER_DAMAGE, accuracy: BASE_PLAYER_ACCURACY, evasion: BASE_PLAYER_EVASION, attackVerb: 'strike' });
  world.playerControlled.set(playerId, { movementStance: 'walk' });
  world.resources.set(playerId, {
    chakra: maxChakra, maxChakra, chakraCeiling: maxChakra, lastChakraExertionTick: 0,
    willpower: maxWillpower, maxWillpower,
    stamina: maxStamina, maxStamina, staminaCeiling: maxStamina, lastExertionTick: 0,
    blood: 100, maxBlood: 100,
  });
  world.names.set(playerId, { display: playerName, article: '' });
  world.thrownAmmo.set(playerId, { kunai: MAX_THROWN_AMMO, shuriken: MAX_THROWN_AMMO });

  // ╔══════════════════════════════════════╗
  // ║  SPAWN DOORS (entity on every door tile) ║
  // ╚══════════════════════════════════════╝
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (tileMap.getTileType(x, y) === 'door') {
        // Determine if this door should lock at night.
        // Doors that stay UNLOCKED: Hokage Tower, Mission Desk, Hospital, Clinic,
        // Inn, Guard Posts, Academy, Council Room, Instructor Office.
        const lockedAtNight = !isAlwaysOpenDoor(x, y);
        spawnDoor(world, x, y, lockedAtNight);
      }
    }
  }

  // ╔══════════════════════════════════════╗
  // ║  LAYERS 5-7: OBJECTS + NPCS + DECOR  ║
  // ╚══════════════════════════════════════╝
  spawnVillageObjects(world, devMode);
  spawnVillageNpcs(world, devMode);

  world.log(`${playerName} stands at the gates of Konoha.`, 'system');
  world.log('The Hidden Leaf Village stretches before you.', 'info');
  world.log('The main avenue leads north to the heart of the village.', 'info');
  world.log('Training grounds are northwest, past the river.', 'info');

  return world;
}
