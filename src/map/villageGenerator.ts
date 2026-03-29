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
import { stampBuilding, stampRoad, stampRiver, fillRect } from './buildingStamper.ts';
import { spawnVillageNpcs } from '../data/villageNpcs.ts';
import { spawnVillageObjects } from '../data/villageObjects.ts';
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

  // ╔══════════════════════════════════════╗
  // ║  LAYER 3-4: BUILDING PLOTS + STAMP   ║
  // ║  (buildings face streets)             ║
  // ╚══════════════════════════════════════╝

  // --- GOVERNMENT QUARTER (stone, south of river, west of main avenue) ---
  stampBuilding(tileMap, { x: 58, y: 72, w: 16, h: 8, floorType: 'stone', doorSide: 's', doorOffset: 8, label: 'Hokage Tower' });
  stampBuilding(tileMap, { x: 60, y: 85, w: 12, h: 5, floorType: 'stone', doorSide: 's', doorOffset: 6, label: 'Mission Desk' });
  stampBuilding(tileMap, { x: 60, y: 92, w: 8, h: 5, floorType: 'stone', doorSide: 's', doorOffset: 4, label: 'Council Room' });

  // --- ACADEMY DISTRICT (north, near main avenue) ---
  stampBuilding(tileMap, { x: 58, y: 12, w: 16, h: 8, floorType: 'stone', doorSide: 's', doorOffset: 8, label: 'Academy' });
  stampBuilding(tileMap, { x: 78, y: 12, w: 8, h: 6, floorType: 'wooden_floor', doorSide: 's', doorOffset: 4, label: 'Library' });
  stampBuilding(tileMap, { x: 58, y: 32, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 2, label: 'Instructor Office' });

  // --- COMMERCIAL STRIP (both sides of main avenue) ---
  // West side of avenue — doors face east toward the road
  stampBuilding(tileMap, { x: 62, y: 97, w: 8, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'Konoha Kitchen' });
  stampBuilding(tileMap, { x: 62, y: 105, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 2, label: 'Tea House' });
  stampBuilding(tileMap, { x: 62, y: 112, w: 8, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'Inn' });
  // East side of avenue — doors face west toward the road
  stampBuilding(tileMap, { x: 80, y: 97, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 2, label: 'Barbershop' });
  stampBuilding(tileMap, { x: 80, y: 104, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 2, label: 'Dango Shop' });
  stampBuilding(tileMap, { x: 80, y: 111, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 2, label: 'General Store' });

  // --- MARKET PLAZA (east side, buildings face the square) ---
  stampBuilding(tileMap, { x: 98, y: 72, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 's', doorOffset: 3, label: 'Weapons Shop' });
  stampBuilding(tileMap, { x: 108, y: 72, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 's', doorOffset: 3, label: 'Supply Shop' });
  stampBuilding(tileMap, { x: 118, y: 72, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 's', doorOffset: 3, label: 'Scroll Shop' });
  stampBuilding(tileMap, { x: 128, y: 72, w: 8, h: 6, floorType: 'stone', doorSide: 's', doorOffset: 4, label: 'Forge' });
  stampBuilding(tileMap, { x: 98, y: 88, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 3, label: 'Clothing Shop' });
  stampBuilding(tileMap, { x: 108, y: 88, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 3, label: 'Food Stall' });

  // --- HOSPITAL (west, faces market road) ---
  stampBuilding(tileMap, { x: 18, y: 82, w: 14, h: 10, floorType: 'stone', doorSide: 'e', doorOffset: 5, label: 'Hospital' });
  stampBuilding(tileMap, { x: 18, y: 94, w: 8, h: 5, floorType: 'stone', doorSide: 'e', doorOffset: 2, label: 'Clinic' });

  // --- RESIDENTIAL WEST (houses face residential lane or cross-streets) ---
  // Row 1: y=102-107, facing east toward lane at x=30
  stampBuilding(tileMap, { x: 10, y: 102, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 20, y: 102, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 34, y: 102, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 44, y: 102, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House' });
  // Row 2: y=117-122
  stampBuilding(tileMap, { x: 10, y: 117, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 20, y: 117, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 34, y: 117, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 44, y: 117, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House' });

  // --- RESIDENTIAL EAST ---
  stampBuilding(tileMap, { x: 98, y: 102, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 110, y: 102, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 124, y: 102, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 98, y: 117, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'e', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 110, y: 117, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House' });
  stampBuilding(tileMap, { x: 124, y: 117, w: 7, h: 6, floorType: 'wooden_floor', doorSide: 'w', doorOffset: 3, label: 'House' });

  // --- HYUGA COMPOUND (northwest, mini-village) ---
  // Outer wall
  fillRect(tileMap, 8, 6, 32, 24, 'stone'); // stone ground for entire compound
  // Main hall
  stampBuilding(tileMap, { x: 12, y: 8, w: 12, h: 8, floorType: 'stone', doorSide: 's', doorOffset: 6, label: 'Hyuga Main Hall' });
  // Training dojo
  stampBuilding(tileMap, { x: 26, y: 8, w: 10, h: 6, floorType: 'stone', doorSide: 's', doorOffset: 5, label: 'Hyuga Dojo' });
  // Residences
  stampBuilding(tileMap, { x: 12, y: 20, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 3, label: 'Hyuga House' });
  stampBuilding(tileMap, { x: 22, y: 20, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 3, label: 'Hyuga House' });
  // Pond (decorative water feature)
  fillRect(tileMap, 32, 16, 6, 4, 'water');
  // Internal paths
  stampRoad(tileMap, 18, 16, 30, 16, 2);
  // Sand training area
  fillRect(tileMap, 26, 15, 8, 4, 'sand');

  // --- UCHIHA COMPOUND (northeast, mini-village) ---
  fillRect(tileMap, 108, 6, 32, 24, 'stone');
  // Main hall (larger)
  stampBuilding(tileMap, { x: 112, y: 8, w: 14, h: 8, floorType: 'stone', doorSide: 's', doorOffset: 7, label: 'Uchiha Main Hall' });
  // Armory
  stampBuilding(tileMap, { x: 128, y: 8, w: 8, h: 6, floorType: 'stone', doorSide: 's', doorOffset: 4, label: 'Uchiha Armory' });
  // Residences
  stampBuilding(tileMap, { x: 112, y: 20, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 3, label: 'Uchiha House' });
  stampBuilding(tileMap, { x: 122, y: 20, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 3, label: 'Uchiha House' });
  stampBuilding(tileMap, { x: 132, y: 20, w: 7, h: 5, floorType: 'wooden_floor', doorSide: 'n', doorOffset: 3, label: 'Uchiha House' });
  // Training yard
  fillRect(tileMap, 128, 16, 8, 4, 'sand');
  // Internal paths
  stampRoad(tileMap, 118, 16, 136, 16, 2);
  // Decorative pond
  fillRect(tileMap, 110, 18, 4, 3, 'water');

  // --- GATE GUARD POSTS ---
  stampBuilding(tileMap, { x: 68, y: 147, w: 5, h: 4, floorType: 'stone', doorSide: 'e', doorOffset: 2, label: 'Guard Post' });
  stampBuilding(tileMap, { x: 88, y: 147, w: 5, h: 4, floorType: 'stone', doorSide: 'w', doorOffset: 2, label: 'Guard Post' });

  // --- FILL DEAD ZONES ---
  // North park (between compounds and academy)
  fillRect(tileMap, 42, 8, 14, 10, 'dirt'); // park ground
  fillRect(tileMap, 45, 10, 3, 3, 'water'); // small pond in park
  stampRoad(tileMap, 42, 18, 55, 18, 2); // park path connecting to academy road

  // South park (between residential and gate)
  fillRect(tileMap, 55, 130, 20, 10, 'dirt'); // open park
  fillRect(tileMap, 60, 133, 4, 3, 'water'); // park pond

  // Shrine area (east, between river and market)
  fillRect(tileMap, 142, 72, 8, 8, 'stone'); // shrine platform
  stampBuilding(tileMap, { x: 143, y: 73, w: 6, h: 5, floorType: 'stone', doorSide: 's', doorOffset: 3, label: 'Shrine' });

  // Farm plots (southwest, near residential)
  fillRect(tileMap, 6, 100, 8, 12, 'dirt'); // farm field
  fillRect(tileMap, 6, 115, 8, 12, 'dirt'); // farm field 2

  // Well plaza (intersection of main roads)
  fillRect(tileMap, 73, 78, 7, 5, 'stone'); // small plaza at crossroads

  // Additional connecting roads
  stampRoad(tileMap, 42, 30, 55, 30, 2); // park to academy
  stampRoad(tileMap, 90, 80, 98, 80, 2); // avenue to market
  stampRoad(tileMap, 50, 100, 60, 100, 2); // residential to commercial

  // ╔══════════════════════════════════════╗
  // ║  CREATE WORLD + PLAYER               ║
  // ╚══════════════════════════════════════╝
  const world = new World(tileMap);
  world.gameTimeSeconds = GAME_START_HOUR * 3600;

  const playerId = world.createEntity();
  world.playerEntityId = playerId;
  world.setPosition(playerId, { x: VILLAGE_PLAYER_START_X, y: VILLAGE_PLAYER_START_Y, facing: 'n' });
  world.renderables.set(playerId, { spriteId: `char_${playerGender}_s`, layer: 'character', offsetY: -16 });
  world.blockings.set(playerId, { blocksMovement: true, blocksSight: false });

  const playerSheet = devMode
    ? { class: 'shinobi' as const, rank: 'jounin' as const, title: 'Elite Shinobi',
        skills: { taijutsu: 70, bukijutsu: 70, ninjutsu: 70, genjutsu: 70, med: 70 },
        stats: { phy: 70, cha: 70, men: 70, soc: 70 }, learnedJutsus: ['substitution'] }
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
    chakra: maxChakra, maxChakra, willpower: maxWillpower, maxWillpower,
    stamina: maxStamina, maxStamina, staminaCeiling: maxStamina, lastExertionTick: 0,
    blood: 100, maxBlood: 100,
  });
  world.names.set(playerId, { display: playerName, article: '' });

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
