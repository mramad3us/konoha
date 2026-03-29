/**
 * Konoha Village Generator — 160×160 procedural map with districts.
 * Integrates the existing training grounds as a zone within the village.
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
import type { BuildingTemplate } from './buildingStamper.ts';
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

  // ══════════════════════════════════════
  //  PASS 1: Base terrain (all grass)
  // ══════════════════════════════════════
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const variant = cellHash(x, y) % 3;
      tileMap.setTile(x, y, TILE_INDEX_TO_TYPE[variant]);
    }
  }

  // ══════════════════════════════════════
  //  PASS 2: Border (cliff + dense forest feel)
  // ══════════════════════════════════════
  for (let x = 0; x < W; x++) {
    for (let d = 0; d < 4; d++) {
      tileMap.setTile(x, d, 'cliff');           // north
      tileMap.setTile(x, H - 1 - d, 'cliff');   // south
    }
  }
  for (let y = 0; y < H; y++) {
    for (let d = 0; d < 4; d++) {
      tileMap.setTile(d, y, 'cliff');           // west
      tileMap.setTile(W - 1 - d, y, 'cliff');   // east
    }
  }

  // ══════════════════════════════════════
  //  PASS 3: Main roads
  // ══════════════════════════════════════
  // N-S main road (center)
  stampRoad(tileMap, 78, 10, 78, 145, 3);
  // E-W main road
  stampRoad(tileMap, 4, 76, 155, 76, 3);
  // Road to training grounds
  stampRoad(tileMap, 25, 55, 25, 78, 2);
  // Road to market
  stampRoad(tileMap, 80, 80, 100, 80, 2);
  // Road from gate to center
  stampRoad(tileMap, 78, 145, 78, 155, 3);

  // ══════════════════════════════════════
  //  PASS 4: River (E-W at rows 68-73)
  // ══════════════════════════════════════
  stampRiver(tileMap, 68, 6, W, [30, 78, 125], 5);

  // ══════════════════════════════════════
  //  PASS 5: Training Grounds (copy existing layout at offset)
  // ══════════════════════════════════════
  for (let ty = 0; ty < TRAINING_GROUNDS_HEIGHT; ty++) {
    for (let tx = 0; tx < TRAINING_GROUNDS_WIDTH; tx++) {
      const raw = TRAINING_GROUNDS_LAYOUT[ty * TRAINING_GROUNDS_WIDTH + tx];
      let tileType: TileType;
      if (raw <= 2) {
        tileType = TILE_INDEX_TO_TYPE[cellHash(tx + TG_OFFSET_X, ty + TG_OFFSET_Y) % 3];
      } else {
        tileType = TILE_INDEX_TO_TYPE[raw];
      }
      tileMap.setTile(TG_OFFSET_X + tx, TG_OFFSET_Y + ty, tileType);
    }
  }

  // ══════════════════════════════════════
  //  PASS 6: Buildings
  // ══════════════════════════════════════
  const buildings: BuildingTemplate[] = [
    // Hokage Tower (large, central)
    { x: 70, y: 82, w: 16, h: 12, doorSide: 's', doorOffset: 8, label: 'Hokage Tower' },
    // Mission Desk (adjacent)
    { x: 72, y: 96, w: 10, h: 5, doorSide: 's', doorOffset: 5, label: 'Mission Desk' },

    // Academy (north area)
    { x: 58, y: 10, w: 16, h: 10, doorSide: 's', doorOffset: 8, label: 'Academy' },
    // Academy yard (sand area)

    // Hospital
    { x: 32, y: 82, w: 12, h: 10, doorSide: 'e', doorOffset: 5, label: 'Hospital' },

    // Ramen Shop
    { x: 92, y: 106, w: 8, h: 6, doorSide: 'w', doorOffset: 3, label: 'Konoha Kitchen' },

    // Market stalls (small buildings)
    { x: 102, y: 82, w: 6, h: 5, doorSide: 's', doorOffset: 3, label: 'Weapons Shop' },
    { x: 110, y: 82, w: 6, h: 5, doorSide: 's', doorOffset: 3, label: 'Supply Shop' },
    { x: 118, y: 82, w: 6, h: 5, doorSide: 's', doorOffset: 3, label: 'Scroll Shop' },
    { x: 102, y: 90, w: 6, h: 5, doorSide: 'n', doorOffset: 3, label: 'Clothing Shop' },

    // Hyuga Compound (north-west)
    { x: 12, y: 6, w: 18, h: 8, doorSide: 's', doorOffset: 9, floorType: 'stone', label: 'Hyuga Compound' },

    // Uchiha Compound (north-east)
    { x: 105, y: 6, w: 20, h: 8, doorSide: 's', doorOffset: 10, floorType: 'stone', label: 'Uchiha Compound' },

    // Residential houses
    { x: 22, y: 108, w: 7, h: 6, doorSide: 's', doorOffset: 3, label: 'House' },
    { x: 31, y: 108, w: 7, h: 6, doorSide: 's', doorOffset: 3, label: 'House' },
    { x: 40, y: 108, w: 7, h: 6, doorSide: 's', doorOffset: 3, label: 'House' },
    { x: 22, y: 118, w: 7, h: 6, doorSide: 'n', doorOffset: 3, label: 'House' },
    { x: 31, y: 118, w: 7, h: 6, doorSide: 'n', doorOffset: 3, label: 'House' },
    { x: 40, y: 118, w: 7, h: 6, doorSide: 'n', doorOffset: 3, label: 'House' },
    { x: 22, y: 126, w: 7, h: 6, doorSide: 's', doorOffset: 3, label: 'House' },
    { x: 31, y: 126, w: 7, h: 6, doorSide: 's', doorOffset: 3, label: 'House' },

    // Gate guard posts
    { x: 72, y: 148, w: 5, h: 4, doorSide: 'e', doorOffset: 2, label: 'Guard Post' },
    { x: 84, y: 148, w: 5, h: 4, doorSide: 'w', doorOffset: 2, label: 'Guard Post' },
  ];

  for (const b of buildings) {
    stampBuilding(tileMap, b);
  }

  // Academy sand yard
  fillRect(tileMap, 58, 21, 16, 8, 'sand');

  // Main gate opening
  tileMap.setTile(79, 155, 'gate');
  tileMap.setTile(80, 155, 'gate');
  tileMap.setTile(81, 155, 'gate');

  // Memorial stone area (stone clearing near training grounds)
  fillRect(tileMap, 50, 32, 6, 5, 'stone');

  // ══════════════════════════════════════
  //  CREATE WORLD
  // ══════════════════════════════════════
  const world = new World(tileMap);
  world.gameTimeSeconds = GAME_START_HOUR * 3600;

  // ── Player ──
  const playerId = world.createEntity();
  world.playerEntityId = playerId;

  world.setPosition(playerId, { x: VILLAGE_PLAYER_START_X, y: VILLAGE_PLAYER_START_Y, facing: 'n' });
  world.renderables.set(playerId, {
    spriteId: `char_${playerGender}_s`,
    layer: 'character',
    offsetY: -16,
  });
  world.blockings.set(playerId, { blocksMovement: true, blocksSight: false });

  const playerSheet = devMode
    ? {
        class: 'shinobi' as const,
        rank: 'jounin' as const,
        title: 'Elite Shinobi',
        skills: { taijutsu: 70, bukijutsu: 70, ninjutsu: 70, genjutsu: 70, med: 70 },
        stats: { phy: 70, cha: 70, men: 70, soc: 70 },
        learnedJutsus: ['substitution'],
      }
    : { ...DEFAULT_SHINOBI_SHEET, title: 'Academy Graduate' };
  world.characterSheets.set(playerId, playerSheet);

  const maxHp = computeMaxHp(playerSheet.stats);
  const maxChakra = computeMaxChakra(playerSheet.stats);
  const maxWillpower = computeMaxWillpower(playerSheet.stats);
  const maxStamina = computeMaxStamina(playerSheet.stats);

  world.healths.set(playerId, { current: maxHp, max: maxHp });
  world.combatStats.set(playerId, {
    damage: BASE_PLAYER_DAMAGE,
    accuracy: BASE_PLAYER_ACCURACY,
    evasion: BASE_PLAYER_EVASION,
    attackVerb: 'strike',
  });
  world.playerControlled.set(playerId, { movementStance: 'walk' });
  world.resources.set(playerId, {
    chakra: maxChakra, maxChakra,
    willpower: maxWillpower, maxWillpower,
    stamina: maxStamina, maxStamina,
    staminaCeiling: maxStamina,
    lastExertionTick: 0,
    blood: 100, maxBlood: 100,
  });
  world.names.set(playerId, { display: playerName, article: '' });

  // ══════════════════════════════════════
  //  PASS 7: Objects + NPCs
  // ══════════════════════════════════════
  spawnVillageObjects(world, devMode);
  spawnVillageNpcs(world, devMode);

  world.log(`${playerName} stands at the gates of Konoha.`, 'system');
  world.log('The Hidden Leaf Village stretches before you.', 'info');

  return world;
}
