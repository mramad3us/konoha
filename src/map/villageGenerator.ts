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
  //  PASS 2: Border (cliff + trees)
  // ══════════════════════════════════════
  for (let x = 0; x < W; x++) {
    for (let d = 0; d < 4; d++) {
      tileMap.setTile(x, d, 'cliff');
      tileMap.setTile(x, H - 1 - d, 'cliff');
    }
  }
  for (let y = 0; y < H; y++) {
    for (let d = 0; d < 4; d++) {
      tileMap.setTile(d, y, 'cliff');
      tileMap.setTile(W - 1 - d, y, 'cliff');
    }
  }

  // ══════════════════════════════════════
  //  PASS 3: Training Grounds (copy existing 40x40 at offset)
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
  //  PASS 4: Buildings (BEFORE roads so roads connect to doors)
  // ══════════════════════════════════════
  const buildings: BuildingTemplate[] = [
    // Hokage Tower (large, south of E-W road)
    { x: 68, y: 82, w: 18, h: 14, doorSide: 's', doorOffset: 9, label: 'Hokage Tower' },
    // Mission Desk (south of tower)
    { x: 71, y: 98, w: 12, h: 5, doorSide: 's', doorOffset: 6, label: 'Mission Desk' },

    // Academy (north-center, well away from roads)
    { x: 56, y: 8, w: 18, h: 10, doorSide: 's', doorOffset: 9, label: 'Academy' },

    // Hospital (west side, south of river)
    { x: 20, y: 82, w: 14, h: 10, doorSide: 'e', doorOffset: 5, label: 'Hospital' },

    // Ramen Shop (east of center road)
    { x: 90, y: 108, w: 8, h: 6, doorSide: 'w', doorOffset: 3, label: 'Konoha Kitchen' },

    // Market stalls (east side, south of river, away from road)
    { x: 100, y: 84, w: 7, h: 5, doorSide: 's', doorOffset: 3, label: 'Weapons Shop' },
    { x: 110, y: 84, w: 7, h: 5, doorSide: 's', doorOffset: 3, label: 'Supply Shop' },
    { x: 120, y: 84, w: 7, h: 5, doorSide: 's', doorOffset: 3, label: 'Scroll Shop' },
    { x: 100, y: 92, w: 7, h: 5, doorSide: 'n', doorOffset: 3, label: 'Clothing Shop' },
    { x: 110, y: 92, w: 7, h: 5, doorSide: 'n', doorOffset: 3, label: 'Tea House' },

    // Hyuga Compound (northwest)
    { x: 10, y: 6, w: 20, h: 8, doorSide: 's', doorOffset: 10, floorType: 'stone', label: 'Hyuga Compound' },

    // Uchiha Compound (northeast)
    { x: 108, y: 6, w: 20, h: 8, doorSide: 's', doorOffset: 10, floorType: 'stone', label: 'Uchiha Compound' },

    // Residential houses (southwest, away from main road)
    { x: 14, y: 108, w: 7, h: 6, doorSide: 'e', doorOffset: 3, label: 'House' },
    { x: 14, y: 118, w: 7, h: 6, doorSide: 'e', doorOffset: 3, label: 'House' },
    { x: 14, y: 128, w: 7, h: 6, doorSide: 'e', doorOffset: 3, label: 'House' },
    { x: 26, y: 108, w: 7, h: 6, doorSide: 'w', doorOffset: 3, label: 'House' },
    { x: 26, y: 118, w: 7, h: 6, doorSide: 'w', doorOffset: 3, label: 'House' },
    { x: 26, y: 128, w: 7, h: 6, doorSide: 'w', doorOffset: 3, label: 'House' },
    { x: 38, y: 108, w: 7, h: 6, doorSide: 'e', doorOffset: 3, label: 'House' },
    { x: 38, y: 118, w: 7, h: 6, doorSide: 'e', doorOffset: 3, label: 'House' },
    { x: 50, y: 108, w: 7, h: 6, doorSide: 'w', doorOffset: 3, label: 'House' },
    { x: 50, y: 118, w: 7, h: 6, doorSide: 'w', doorOffset: 3, label: 'House' },

    // Gate guard posts (flanking the gate, not on the road)
    { x: 68, y: 148, w: 5, h: 4, doorSide: 'e', doorOffset: 2, label: 'Guard Post' },
    { x: 89, y: 148, w: 5, h: 4, doorSide: 'w', doorOffset: 2, label: 'Guard Post' },

    // Weapons forge (near market)
    { x: 130, y: 84, w: 8, h: 6, doorSide: 's', doorOffset: 4, label: 'Forge' },

    // Library (near academy)
    { x: 56, y: 22, w: 10, h: 7, doorSide: 's', doorOffset: 5, label: 'Library' },
  ];

  for (const b of buildings) {
    stampBuilding(tileMap, b);
  }

  // Academy sand yard
  fillRect(tileMap, 56, 19, 18, 3, 'sand');

  // Memorial stone area
  fillRect(tileMap, 50, 35, 6, 5, 'stone');

  // ══════════════════════════════════════
  //  PASS 5: Roads (after buildings so they don't get overwritten)
  // ══════════════════════════════════════

  // Main N-S road (center, x=76-78)
  stampRoad(tileMap, 76, 10, 76, 145, 3);
  // E-W main road (y=78-80, bridges over river handled separately)
  stampRoad(tileMap, 4, 78, 66, 78, 3);    // west segment
  stampRoad(tileMap, 88, 78, 155, 78, 3);   // east segment

  // Road from gate to center
  stampRoad(tileMap, 76, 145, 76, 155, 3);

  // Road to training grounds (from main road west)
  stampRoad(tileMap, 26, 56, 76, 56, 2);

  // Road to residential area
  stampRoad(tileMap, 22, 80, 22, 105, 2);

  // Road to market district
  stampRoad(tileMap, 88, 80, 100, 80, 2);

  // Residential cross-road
  stampRoad(tileMap, 12, 115, 58, 115, 2);

  // Academy approach road
  stampRoad(tileMap, 64, 20, 76, 20, 2);

  // ══════════════════════════════════════
  //  PASS 6: River (E-W at rows 68-73, with 3 bridges)
  // ══════════════════════════════════════
  stampRiver(tileMap, 68, 6, W, [22, 76, 125], 5);

  // Gate opening (south border)
  tileMap.setTile(77, 155, 'gate');
  tileMap.setTile(78, 155, 'gate');
  tileMap.setTile(79, 155, 'gate');
  // Clear cliff behind gate
  for (let d = 0; d < 4; d++) {
    tileMap.setTile(77, 156 + d, 'road');
    tileMap.setTile(78, 156 + d, 'road');
    tileMap.setTile(79, 156 + d, 'road');
  }

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
  world.log('Head north along the main road to reach the village center.', 'info');
  world.log('The training grounds are to the northwest, past the river.', 'info');

  return world;
}
