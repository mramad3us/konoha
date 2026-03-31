/**
 * Procedural mission map generator — creates forest/terrain maps for away missions.
 *
 * Generates dense forests with scattered assets (boulders, logs, ponds, rivers)
 * and optional bandit camp clearings. Trees are randomly peppered and pruned
 * to avoid aligned grids.
 *
 * The player spawns near one edge. The target spawns deeper in the map,
 * far enough to allow sneaking and strategizing.
 */

import { TileMap } from './tileMap.ts';
import { World } from '../engine/world.ts';
import { stampRiver } from './buildingStamper.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import { JUTSU_REGISTRY } from '../data/jutsus.ts';
import type { MissionMapConfig, CRankMissionData } from '../types/awayMission.ts';
import type { TileType } from '../types/tiles.ts';
import type { EntityId } from '../types/ecs.ts';
import {
  MISSION_MAP_EDGE_ZONE,
  BASE_PLAYER_DAMAGE, BASE_PLAYER_ACCURACY, BASE_PLAYER_EVASION,
  MAX_THROWN_AMMO,
} from '../core/constants.ts';
import { computeMaxHp, computeMaxChakra, computeMaxStamina, computeMaxWillpower } from '../engine/derivedStats.ts';
import type { CharacterAccents } from '../sprites/characters.ts';
import { generateCharacterSprites, CIVILIAN_BODIES, SIGNING_BODIES } from '../sprites/characters.ts';
import { spriteCache } from '../rendering/spriteCache.ts';
import type { SquadMember } from '../types/squad.ts';

/** Seeded pseudo-random number generator */
class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.state >>> 0) / 0xFFFFFFFF;
  }
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  nextBool(chance: number = 0.5): boolean {
    return this.next() < chance;
  }
}

// ── SPAWN CONFIG (reusable for mission maps) ──

interface TerrainSpawn {
  spriteId: string;
  offsetY: number;
  blocksMove: boolean;
  blocksSight: boolean;
  displayName: string;
  article: string;
  description: string;
}

const TREE_VARIANTS: TerrainSpawn[] = [
  { spriteId: 'obj_tree_small', offsetY: -28, blocksMove: true, blocksSight: true, displayName: 'tree', article: 'a', description: 'A sturdy tree with thick branches.' },
  { spriteId: 'obj_tree_large', offsetY: -36, blocksMove: true, blocksSight: true, displayName: 'large tree', article: 'a', description: 'A towering tree. Its canopy blocks out sunlight.' },
  { spriteId: 'obj_tree_willow', offsetY: -32, blocksMove: true, blocksSight: true, displayName: 'willow tree', article: 'a', description: 'A drooping willow, its branches like curtains.' },
];

const ROCK_VARIANTS: TerrainSpawn[] = [
  { spriteId: 'obj_rock_small', offsetY: -4, blocksMove: true, blocksSight: false, displayName: 'stone', article: 'a', description: 'A smooth stone, worn by weather.' },
  { spriteId: 'obj_rock_medium', offsetY: -8, blocksMove: true, blocksSight: false, displayName: 'rock', article: 'a', description: 'A solid chunk of stone embedded in the earth.' },
  { spriteId: 'obj_rock_large', offsetY: -14, blocksMove: true, blocksSight: false, displayName: 'boulder', article: 'a', description: 'A massive boulder covered in moss.' },
  { spriteId: 'obj_rock_mossy', offsetY: -10, blocksMove: true, blocksSight: false, displayName: 'mossy boulder', article: 'a', description: 'Green moss clings to this old stone.' },
];

const BUSH_VARIANTS: TerrainSpawn[] = [
  { spriteId: 'obj_bush_small', offsetY: -16, blocksMove: false, blocksSight: false, displayName: 'bush', article: 'a', description: 'A low shrub.' },
  { spriteId: 'obj_bush_berry', offsetY: -16, blocksMove: false, blocksSight: false, displayName: 'berry bush', article: 'a', description: 'Dark berries grow among the leaves.' },
  { spriteId: 'obj_bush_flower', offsetY: -16, blocksMove: false, blocksSight: false, displayName: 'flowering bush', article: 'a', description: 'Bright flowers dot this bush.' },
  { spriteId: 'obj_bush_tall', offsetY: -20, blocksMove: true, blocksSight: false, displayName: 'tall bush', article: 'a', description: 'A dense thicket, tall enough to block your path.' },
];

const GROUND_COVER: TerrainSpawn[] = [
  { spriteId: 'obj_tall_grass', offsetY: -8, blocksMove: false, blocksSight: false, displayName: 'tall grass', article: '', description: 'Knee-high grass sways gently.' },
  { spriteId: 'obj_reeds', offsetY: -12, blocksMove: false, blocksSight: false, displayName: 'reeds', article: '', description: 'Tall reeds grow near the water\'s edge.' },
];

// ── BANDIT GENERATION ──

/** Random bandit name pools */
const BANDIT_FIRST_NAMES = [
  'Goro', 'Jiro', 'Saburo', 'Tetsu', 'Kenta', 'Ryu', 'Daisuke', 'Hiro',
  'Masa', 'Shin', 'Taro', 'Kenji', 'Yoshi', 'Nobu', 'Genji', 'Kaze',
  'Raiko', 'Bunta', 'Juzo', 'Sabu', 'Hachi', 'Roku', 'Go',
];

const BANDIT_EPITHETS = [
  'the Scarred', 'the Ruthless', 'Iron Fist', 'One-Eye', 'the Serpent',
  'Shadow Blade', 'the Butcher', 'Red Hand', 'the Viper', 'Stone Wall',
  'the Jackal', 'Blade Runner', 'the Fox', 'Thunderstrike',
];

let banditSpriteCounter = 0;

/** Register civilian-body sprites for bandits (no headband, ragged clothes) */
function registerBanditSprites(rng: SeededRng): string {
  const prefix = `bandit_${banditSpriteCounter++}`;
  const accents: CharacterAccents = {
    hair: [40 + Math.floor(rng.next() * 40), 30 + Math.floor(rng.next() * 20), 20 + Math.floor(rng.next() * 20)],
    headband: [80, 60, 50],      // dull brown — no village affiliation
    pupil: [30 + Math.floor(rng.next() * 30), 30 + Math.floor(rng.next() * 30), 30 + Math.floor(rng.next() * 30)],
    belt: [60 + Math.floor(rng.next() * 40), 50 + Math.floor(rng.next() * 30), 40 + Math.floor(rng.next() * 30)],
    beltHighlight: [100 + Math.floor(rng.next() * 40), 70 + Math.floor(rng.next() * 30), 50 + Math.floor(rng.next() * 30)],
    outfitDark: [60 + Math.floor(rng.next() * 30), 50 + Math.floor(rng.next() * 20), 40 + Math.floor(rng.next() * 20)],
    outfitMid: [80 + Math.floor(rng.next() * 30), 65 + Math.floor(rng.next() * 20), 50 + Math.floor(rng.next() * 20)],
  };
  const sprites = generateCharacterSprites(accents, CIVILIAN_BODIES);
  for (const [dir, pattern] of Object.entries(sprites)) {
    spriteCache.registerDynamic(`${prefix}_${dir}`, pattern, 48, 48, true);
  }
  return prefix;
}

/** Register ninja-body sprites for rogue/missing nin (headband + metal plate, dark combat gear) */
function registerNinjaEnemySprites(rng: SeededRng, type: 'rogue_nin' | 'missing_nin'): string {
  const prefix = `bandit_${banditSpriteCounter++}`;

  // Rogue nin: scratched headband in muted village colours; missing-nin: dark slashed headband
  const headband: [number, number, number] = type === 'missing_nin'
    ? [50 + Math.floor(rng.next() * 20), 15 + Math.floor(rng.next() * 15), 15 + Math.floor(rng.next() * 15)]  // dark red/black — defector
    : [40 + Math.floor(rng.next() * 30), 45 + Math.floor(rng.next() * 30), 55 + Math.floor(rng.next() * 30)]; // faded blue-grey — rogue

  const accents: CharacterAccents = {
    hair: [30 + Math.floor(rng.next() * 50), 25 + Math.floor(rng.next() * 30), 20 + Math.floor(rng.next() * 25)],
    headband,
    pupil: [25 + Math.floor(rng.next() * 35), 25 + Math.floor(rng.next() * 30), 25 + Math.floor(rng.next() * 30)],
    belt: [50 + Math.floor(rng.next() * 30), 45 + Math.floor(rng.next() * 25), 40 + Math.floor(rng.next() * 20)],
    beltHighlight: [75 + Math.floor(rng.next() * 30), 65 + Math.floor(rng.next() * 25), 55 + Math.floor(rng.next() * 20)],
    // Dark ninja outfit — black/charcoal tones
    outfitDark: [22 + Math.floor(rng.next() * 15), 22 + Math.floor(rng.next() * 12), 28 + Math.floor(rng.next() * 15)],
    outfitMid: [30 + Math.floor(rng.next() * 18), 30 + Math.floor(rng.next() * 15), 36 + Math.floor(rng.next() * 18)],
  };
  // No body overrides → uses default ninja body with headband + metal plate
  const sprites = generateCharacterSprites(accents);
  for (const [dir, pattern] of Object.entries(sprites)) {
    spriteCache.registerDynamic(`${prefix}_${dir}`, pattern, 48, 48, true);
  }
  // Signing sprites (hands joined pose)
  const signingSprites = generateCharacterSprites(accents, SIGNING_BODIES);
  for (const [dir, pattern] of Object.entries(signingSprites)) {
    if (dir === 'prone') continue;
    spriteCache.registerDynamic(`${prefix}_sign_${dir}`, pattern, 48, 48, true);
  }
  return prefix;
}

/** Return all jutsu IDs the NPC qualifies for based on ninjutsu skill */
function getAccessibleJutsus(ninjutsuSkill: number): string[] {
  const jutsus: string[] = [];
  for (const [id, def] of Object.entries(JUTSU_REGISTRY)) {
    if (def.category === 'ninjutsu' && ninjutsuSkill >= def.minNinjutsuSkill) {
      jutsus.push(id);
    }
  }
  return jutsus;
}

function randomBanditName(rng: SeededRng): string {
  return BANDIT_FIRST_NAMES[rng.nextInt(0, BANDIT_FIRST_NAMES.length - 1)];
}

function randomBanditLeaderName(rng: SeededRng): string {
  const first = BANDIT_FIRST_NAMES[rng.nextInt(0, BANDIT_FIRST_NAMES.length - 1)];
  const epithet = BANDIT_EPITHETS[rng.nextInt(0, BANDIT_EPITHETS.length - 1)];
  return `${first} ${epithet}`;
}

// ── MAP GENERATION ──

export interface MissionMapResult {
  world: World;
  playerEntityId: EntityId;
  targetEntityId: EntityId;
  banditEntityIds: EntityId[];
  squadEntityIds: EntityId[];
  playerSpawnX: number;
  playerSpawnY: number;
}

/**
 * Generate a complete mission map world with terrain, objects, and NPCs.
 */
export function generateMissionMap(
  config: MissionMapConfig,
  missionData: CRankMissionData,
  playerName: string,
  playerGender: 'shinobi' | 'kunoichi',
  playerSheet: import('../types/character.ts').CharacterSheet,
  gameTimeSeconds: number,
  squadMembers: SquadMember[] = [],
): MissionMapResult {
  const W = config.width;
  const H = config.height;
  const rng = new SeededRng(config.seed);
  const tileMap = new TileMap(W, H);

  // ── Layer 1: Base terrain (biome-aware) ──
  switch (config.terrainType) {
    case 'desert':
      fillBaseTerrainDesert(tileMap, W, H, rng);
      break;
    case 'rocky':
      fillBaseTerrainRocky(tileMap, W, H, rng);
      break;
    case 'plains':
      fillBaseTerrainPlains(tileMap, W, H, rng);
      break;
    case 'riverside':
      fillBaseTerrainForest(tileMap, W, H, rng);
      addRiver(tileMap, W, H, rng);
      break;
    default: // forest
      fillBaseTerrainForest(tileMap, W, H, rng);
      break;
  }

  // ── Layer 2: Water features ──
  if (config.terrainType !== 'desert' && config.terrainType !== 'riverside') {
    if (rng.nextBool(0.35)) addRiver(tileMap, W, H, rng);
  }
  if (config.terrainType !== 'desert') {
    addPonds(tileMap, W, H, rng, rng.nextInt(0, config.terrainType === 'rocky' ? 2 : 4));
  }

  // ── Layer 3: Clearings ──
  const clearings: Array<{ cx: number; cy: number; radius: number }> = [];

  // Always add a few natural clearings
  for (let i = 0; i < rng.nextInt(2, 5); i++) {
    const cx = rng.nextInt(20, W - 20);
    const cy = rng.nextInt(20, H - 20);
    const r = rng.nextInt(4, 8);
    clearings.push({ cx, cy, radius: r });
  }

  // Bandit camp clearing (if applicable)
  let campCx = 0, campCy = 0;
  if (config.hasCamp) {
    // Place camp away from spawn edge, roughly center-ish but offset
    campCx = rng.nextInt(W * 0.3, W * 0.7);
    campCy = rng.nextInt(H * 0.3, H * 0.7);
    // Shift away from player spawn edge
    switch (config.playerSpawnEdge) {
      case 's': campCy = Math.min(campCy, H * 0.5); break;
      case 'n': campCy = Math.max(campCy, H * 0.5); break;
      case 'w': campCx = Math.max(campCx, W * 0.5); break;
      case 'e': campCx = Math.min(campCx, W * 0.5); break;
    }
    clearings.push({ cx: campCx, cy: campCy, radius: rng.nextInt(8, 12) });
  }

  // Create world
  const world = new World(tileMap);
  world.gameTimeSeconds = gameTimeSeconds;

  // ── Layer 4: Scatter terrain objects (biome-aware) ──
  scatterTerrainObjects(world, W, H, rng, clearings, config.terrainType);

  // ── Layer 5: Bandit camp objects ──
  if (config.hasCamp) {
    stampBanditCamp(world, campCx, campCy, rng);
  }

  // ── Layer 6: Player spawn ──
  const { spawnX, spawnY } = getPlayerSpawn(world, W, H, config.playerSpawnEdge, rng);
  const playerId = spawnPlayer(world, spawnX, spawnY, playerName, playerGender, playerSheet);

  // ── Layer 7: Enemy NPCs ──
  const targetX = config.hasCamp ? campCx : rng.nextInt(W * 0.3, W * 0.7);
  const targetY = config.hasCamp ? campCy : rng.nextInt(H * 0.3, H * 0.7);
  const { targetId, banditIds } = spawnBandits(
    world, rng, config, missionData,
    targetX, targetY,
  );

  // ── Layer 8: Squad members (allied NPCs near player) ──
  const squadEntityIds: EntityId[] = [];
  for (let i = 0; i < squadMembers.length; i++) {
    const member = squadMembers[i];
    // Place near player spawn in a spread formation
    const offsets = [
      { dx: -2, dy: 1 }, { dx: 2, dy: 1 }, { dx: -1, dy: 2 }, { dx: 1, dy: 2 },
    ];
    const off = offsets[i % offsets.length];
    let sx = spawnX + off.dx;
    let sy = spawnY + off.dy;

    // Find valid tile
    for (let attempt = 0; attempt < 10; attempt++) {
      if (world.tileMap.isWalkable(sx, sy) && !world.isBlockedByEntity(sx, sy)) break;
      sx += rng.nextInt(-1, 1);
      sy += rng.nextInt(-1, 1);
      sx = Math.max(4, Math.min(W - 4, sx));
      sy = Math.max(4, Math.min(H - 4, sy));
    }

    const squadId = spawnSquadMember(world, member, sx, sy);
    squadEntityIds.push(squadId);
  }

  return {
    world,
    playerEntityId: playerId,
    targetEntityId: targetId,
    banditEntityIds: banditIds,
    squadEntityIds,
    playerSpawnX: spawnX,
    playerSpawnY: spawnY,
  };
}

// ── TERRAIN GENERATION ──

function fillBaseTerrainForest(tileMap: TileMap, w: number, h: number, rng: SeededRng): void {
  // Fill with grass variants
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const variant = cellHash(x, y) % 3;
      const grassTypes: TileType[] = ['grass1', 'grass2', 'grass3'];
      tileMap.setTile(x, y, grassTypes[variant]);
    }
  }

  // Dirt paths (winding trails through the forest)
  const pathCount = rng.nextInt(2, 4);
  for (let p = 0; p < pathCount; p++) {
    let px = rng.nextInt(0, w - 1);
    let py = rng.nextBool() ? 0 : h - 1;
    const targetX = rng.nextInt(0, w - 1);
    const targetY = py === 0 ? h - 1 : 0;

    for (let step = 0; step < w + h; step++) {
      tileMap.setTile(px, py, 'dirt');
      // Sometimes widen the path
      if (rng.nextBool(0.3)) {
        if (px > 0) tileMap.setTile(px - 1, py, 'dirt');
        if (px < w - 1) tileMap.setTile(px + 1, py, 'dirt');
      }

      // Move toward target with some randomness
      const dx = targetX - px;
      const dy = targetY - py;
      if (rng.nextBool(0.6)) {
        if (Math.abs(dy) > Math.abs(dx) || rng.nextBool(0.3)) {
          py += dy > 0 ? 1 : -1;
        } else {
          px += dx > 0 ? 1 : -1;
        }
      } else {
        // Random drift
        const dir = rng.nextInt(0, 3);
        if (dir === 0 && px > 0) px--;
        else if (dir === 1 && px < w - 1) px++;
        else if (dir === 2 && py > 0) py--;
        else if (dir === 3 && py < h - 1) py++;
      }

      px = Math.max(0, Math.min(w - 1, px));
      py = Math.max(0, Math.min(h - 1, py));

      if (px === targetX && py === targetY) break;
    }
  }
}

function fillBaseTerrainDesert(tileMap: TileMap, w: number, h: number, rng: SeededRng): void {
  // Fill with sand, occasional dirt patches
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const noise = cellHash(x * 3, y * 3) % 100;
      tileMap.setTile(x, y, noise < 85 ? 'sand' : 'dirt');
    }
  }
  // Rocky outcrops (stone clusters)
  const outcrops = rng.nextInt(3, 6);
  for (let i = 0; i < outcrops; i++) {
    const cx = rng.nextInt(10, w - 10);
    const cy = rng.nextInt(10, h - 10);
    const r = rng.nextInt(2, 5);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && tileMap.isInBounds(cx + dx, cy + dy)) {
          tileMap.setTile(cx + dx, cy + dy, 'stone');
        }
      }
    }
  }
}

function fillBaseTerrainRocky(tileMap: TileMap, w: number, h: number, rng: SeededRng): void {
  // Mix of stone, dirt, grass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const noise = cellHash(x * 2, y * 2) % 100;
      if (noise < 40) tileMap.setTile(x, y, 'stone');
      else if (noise < 70) tileMap.setTile(x, y, 'dirt');
      else tileMap.setTile(x, y, cellHash(x, y) % 2 === 0 ? 'grass1' : 'grass2');
    }
  }
  // Cliff ridges
  const ridges = rng.nextInt(1, 3);
  for (let r = 0; r < ridges; r++) {
    let rx = rng.nextInt(5, w - 5);
    let ry = rng.nextInt(5, h - 5);
    for (let step = 0; step < rng.nextInt(10, 25); step++) {
      if (tileMap.isInBounds(rx, ry)) tileMap.setTile(rx, ry, 'cliff');
      if (tileMap.isInBounds(rx + 1, ry)) tileMap.setTile(rx + 1, ry, 'cliff');
      rx += rng.nextInt(-1, 1);
      ry += rng.nextBool(0.7) ? 1 : -1;
      rx = Math.max(1, Math.min(w - 2, rx));
      ry = Math.max(1, Math.min(h - 2, ry));
    }
  }
}

function fillBaseTerrainPlains(tileMap: TileMap, w: number, h: number, rng: SeededRng): void {
  // Mostly grass with dirt paths — open terrain, fewer trees placed later
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const variant = cellHash(x, y) % 3;
      const grassTypes: TileType[] = ['grass1', 'grass2', 'grass3'];
      tileMap.setTile(x, y, grassTypes[variant]);
    }
  }
  // Wide dirt roads
  const roads = rng.nextInt(1, 3);
  for (let r = 0; r < roads; r++) {
    let px = rng.nextInt(0, w - 1);
    let py = rng.nextBool() ? 0 : h - 1;
    const targetX = rng.nextInt(0, w - 1);
    const targetY = py === 0 ? h - 1 : 0;
    for (let step = 0; step < w + h; step++) {
      // Wide road: 3 tiles
      for (let d = -1; d <= 1; d++) {
        if (tileMap.isInBounds(px + d, py)) tileMap.setTile(px + d, py, 'dirt');
      }
      const dx = targetX - px;
      const dy = targetY - py;
      if (rng.nextBool(0.65)) {
        if (Math.abs(dy) > Math.abs(dx)) py += dy > 0 ? 1 : -1;
        else px += dx > 0 ? 1 : -1;
      } else {
        const dir = rng.nextInt(0, 3);
        if (dir === 0 && px > 1) px--;
        else if (dir === 1 && px < w - 2) px++;
        else if (dir === 2 && py > 0) py--;
        else if (dir === 3 && py < h - 1) py++;
      }
      px = Math.max(1, Math.min(w - 2, px));
      py = Math.max(0, Math.min(h - 1, py));
      if (px === targetX && py === targetY) break;
    }
  }
}

function addRiver(tileMap: TileMap, w: number, h: number, rng: SeededRng): void {
  const riverY = rng.nextInt(h * 0.3, h * 0.7);
  const depth = rng.nextInt(3, 5);
  // No bridges on mission maps — player must swim or water walk
  stampRiver(tileMap, riverY, depth, w, [], 0);
}

function addPonds(tileMap: TileMap, w: number, h: number, rng: SeededRng, count: number): void {
  for (let i = 0; i < count; i++) {
    const cx = rng.nextInt(15, w - 15);
    const cy = rng.nextInt(15, h - 15);
    const radius = rng.nextInt(2, 5);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const px = cx + dx;
          const py = cy + dy;
          if (tileMap.isInBounds(px, py)) {
            tileMap.setTile(px, py, dist <= radius * 0.5 ? 'deep_water' : 'water');
          }
        }
      }
    }
  }
}

// ── OBJECT SCATTERING ──

/** Biome-aware terrain object scattering */
function scatterTerrainObjects(
  world: World, w: number, h: number, rng: SeededRng,
  clearings: Array<{ cx: number; cy: number; radius: number }>,
  terrainType: string,
): void {
  // Ratios: [tree, bush, rock, ground_cover, skip]
  // These define the probability bands for what gets placed at each grid point
  let treeChance: number, bushChance: number, rockChance: number, skipChance: number;
  switch (terrainType) {
    case 'desert':
      treeChance = 0.05; bushChance = 0.10; rockChance = 0.45; skipChance = 0.55; break;
    case 'rocky':
      treeChance = 0.15; bushChance = 0.10; rockChance = 0.50; skipChance = 0.35; break;
    case 'plains':
      treeChance = 0.15; bushChance = 0.15; rockChance = 0.10; skipChance = 0.45; break;
    default: // forest, riverside
      treeChance = 0.65; bushChance = 0.13; rockChance = 0.10; skipChance = 0.25; break;
  }
  scatterObjectsWithRatios(world, w, h, rng, clearings, treeChance, bushChance, rockChance, skipChance);
}

function scatterObjectsWithRatios(
  world: World, w: number, h: number, rng: SeededRng,
  clearings: Array<{ cx: number; cy: number; radius: number }>,
  treeChance: number, bushChance: number, rockChance: number, skipChance: number,
): void {
  scatterForestObjects(world, w, h, rng, clearings, treeChance, bushChance, rockChance, skipChance);
}

function scatterForestObjects(
  world: World, w: number, h: number, rng: SeededRng,
  clearings: Array<{ cx: number; cy: number; radius: number }>,
  treePct = 0.65, bushPct = 0.13, rockPct = 0.10, skipPct = 0.25,
): void {
  const tileMap = world.tileMap;

  /** Check if position is inside any clearing */
  const inClearing = (x: number, y: number): boolean => {
    for (const c of clearings) {
      const dx = x - c.cx;
      const dy = y - c.cy;
      if (dx * dx + dy * dy <= c.radius * c.radius) return true;
    }
    return false;
  };

  /** Check if position is in the edge zone (for player extraction) */
  const inEdgeZone = (x: number, y: number): boolean => {
    return x < MISSION_MAP_EDGE_ZONE || x >= w - MISSION_MAP_EDGE_ZONE ||
           y < MISSION_MAP_EDGE_ZONE || y >= h - MISSION_MAP_EDGE_ZONE;
  };

  // Dense tree coverage — use jittered grid to avoid alignment
  // Base grid = every 3 tiles, jittered by ±1-2 in each direction
  for (let gy = 4; gy < h - 4; gy += 3) {
    for (let gx = 4; gx < w - 4; gx += 3) {
      // Jitter position
      const jx = gx + rng.nextInt(-1, 1);
      const jy = gy + rng.nextInt(-1, 1);

      if (!tileMap.isInBounds(jx, jy)) continue;
      if (!tileMap.isWalkable(jx, jy)) continue;
      if (tileMap.isWater(jx, jy)) continue;
      if (inEdgeZone(jx, jy)) continue;
      if (inClearing(jx, jy)) continue;
      if (world.isBlockedByEntity(jx, jy)) continue;

      // Random pruning for organic feel
      if (rng.nextBool(skipPct)) continue;

      // Skip if on a dirt path
      if (tileMap.getTileType(jx, jy) === 'dirt') {
        if (rng.nextBool(0.85)) continue; // 85% chance to skip dirt tiles
      }

      // Decide what to place based on biome ratios
      const roll = rng.next();
      const bushThresh = treePct + bushPct;
      const rockThresh = bushThresh + rockPct;
      if (roll < treePct) {
        // Tree
        const variant = TREE_VARIANTS[rng.nextInt(0, TREE_VARIANTS.length - 1)];
        spawnTerrainObject(world, jx, jy, variant);
      } else if (roll < bushThresh) {
        // Bush
        const variant = BUSH_VARIANTS[rng.nextInt(0, BUSH_VARIANTS.length - 1)];
        spawnTerrainObject(world, jx, jy, variant);
      } else if (roll < rockThresh) {
        // Rock
        const variant = ROCK_VARIANTS[rng.nextInt(0, ROCK_VARIANTS.length - 1)];
        spawnTerrainObject(world, jx, jy, variant);
      } else {
        // Ground cover (tall grass, reeds near water)
        const nearWater = isNearWater(tileMap, jx, jy);
        if (nearWater) {
          spawnTerrainObject(world, jx, jy, GROUND_COVER[1]); // reeds
        } else {
          spawnTerrainObject(world, jx, jy, GROUND_COVER[0]); // tall grass
        }
      }
    }
  }

  // Extra bushes around clearing edges
  for (const clearing of clearings) {
    for (let a = 0; a < 20; a++) {
      const angle = rng.next() * Math.PI * 2;
      const dist = clearing.radius + rng.nextInt(1, 3);
      const bx = Math.floor(clearing.cx + Math.cos(angle) * dist);
      const by = Math.floor(clearing.cy + Math.sin(angle) * dist);
      if (tileMap.isInBounds(bx, by) && tileMap.isWalkable(bx, by) && !world.isBlockedByEntity(bx, by)) {
        const variant = BUSH_VARIANTS[rng.nextInt(0, BUSH_VARIANTS.length - 1)];
        spawnTerrainObject(world, bx, by, variant);
      }
    }
  }
}

function isNearWater(tileMap: TileMap, x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (tileMap.isWater(x + dx, y + dy)) return true;
    }
  }
  return false;
}

function spawnTerrainObject(world: World, x: number, y: number, cfg: TerrainSpawn): void {
  const id = world.createEntity();
  world.setPosition(id, { x, y, facing: 's' });
  world.renderables.set(id, { spriteId: cfg.spriteId, layer: 'object', offsetY: cfg.offsetY });
  if (cfg.blocksMove) {
    world.blockings.set(id, { blocksMovement: true, blocksSight: cfg.blocksSight });
  }
  world.names.set(id, { display: cfg.displayName, article: cfg.article as '' | 'a' | 'an' | 'the' });
  world.objectSheets.set(id, { description: cfg.description, category: 'terrain' });
}

// ── BANDIT CAMP ──

function stampBanditCamp(world: World, cx: number, cy: number, _rng: SeededRng): void {
  // Clear the area (make it dirt/sand)
  const campRadius = 8;
  for (let dy = -campRadius; dy <= campRadius; dy++) {
    for (let dx = -campRadius; dx <= campRadius; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= campRadius) {
        const px = cx + dx;
        const py = cy + dy;
        if (world.tileMap.isInBounds(px, py)) {
          world.tileMap.setTile(px, py, 'dirt');
        }
      }
    }
  }

  // Campfire in center (light source)
  const fireId = world.createEntity();
  world.setPosition(fireId, { x: cx, y: cy, facing: 's' });
  world.renderables.set(fireId, { spriteId: 'obj_torch_pillar', layer: 'object', offsetY: -20 });
  world.blockings.set(fireId, { blocksMovement: true, blocksSight: false });
  world.names.set(fireId, { display: 'campfire', article: 'a' });
  world.objectSheets.set(fireId, { description: 'A crackling campfire. The bandits have been here a while.', category: 'object' });
  world.lightSources.set(fireId, { radius: 6, activeAtNight: true });

  // Scatter camp objects around the fire
  const campObjects = [
    { dx: -3, dy: -2, sprite: 'obj_sleeping_bag', name: 'bedroll', desc: 'A dirty bedroll. Smells of sweat and road dust.' },
    { dx: 2, dy: -3, sprite: 'obj_sleeping_bag', name: 'bedroll', desc: 'A threadbare bedroll, hastily laid out.' },
    { dx: -2, dy: 3, sprite: 'obj_sleeping_bag', name: 'bedroll', desc: 'An unrolled sleeping bag.' },
    { dx: 4, dy: 1, sprite: 'obj_crate', name: 'supply crate', desc: 'Stolen goods piled carelessly. Marked crates from several villages.' },
    { dx: -4, dy: 0, sprite: 'obj_weapons_rack', name: 'weapon stash', desc: 'Crude weapons leaned against a rock. Axes, clubs, a rusty sword.' },
  ];

  for (const obj of campObjects) {
    const ox = cx + obj.dx;
    const oy = cy + obj.dy;
    if (world.tileMap.isInBounds(ox, oy) && !world.isBlockedByEntity(ox, oy)) {
      const oid = world.createEntity();
      world.setPosition(oid, { x: ox, y: oy, facing: 's' });
      world.renderables.set(oid, { spriteId: obj.sprite, layer: 'object', offsetY: -4 });
      world.names.set(oid, { display: obj.name, article: 'a' });
      world.objectSheets.set(oid, { description: obj.desc, category: 'object' });
    }
  }
}

// ── PLAYER SPAWN ──

function getPlayerSpawn(
  world: World, w: number, h: number,
  edge: 'n' | 's' | 'e' | 'w',
  rng: SeededRng,
): { spawnX: number; spawnY: number } {
  const margin = 5;
  let candidates: Array<{ x: number; y: number }> = [];

  switch (edge) {
    case 's':
      for (let x = margin; x < w - margin; x++) {
        for (let y = h - margin - 5; y < h - margin; y++) {
          if (world.tileMap.isWalkable(x, y) && !world.isBlockedByEntity(x, y)) {
            candidates.push({ x, y });
          }
        }
      }
      break;
    case 'n':
      for (let x = margin; x < w - margin; x++) {
        for (let y = margin; y < margin + 5; y++) {
          if (world.tileMap.isWalkable(x, y) && !world.isBlockedByEntity(x, y)) {
            candidates.push({ x, y });
          }
        }
      }
      break;
    case 'w':
      for (let y = margin; y < h - margin; y++) {
        for (let x = margin; x < margin + 5; x++) {
          if (world.tileMap.isWalkable(x, y) && !world.isBlockedByEntity(x, y)) {
            candidates.push({ x, y });
          }
        }
      }
      break;
    case 'e':
      for (let y = margin; y < h - margin; y++) {
        for (let x = w - margin - 5; x < w - margin; x++) {
          if (world.tileMap.isWalkable(x, y) && !world.isBlockedByEntity(x, y)) {
            candidates.push({ x, y });
          }
        }
      }
      break;
  }

  if (candidates.length === 0) {
    // Fallback
    return { spawnX: Math.floor(w / 2), spawnY: h - 10 };
  }

  const pick = candidates[rng.nextInt(0, candidates.length - 1)];
  return { spawnX: pick.x, spawnY: pick.y };
}

function spawnPlayer(
  world: World,
  x: number, y: number,
  playerName: string,
  playerGender: 'shinobi' | 'kunoichi',
  sourceSheet: import('../types/character.ts').CharacterSheet,
): EntityId {
  const playerId = world.createEntity();
  world.playerEntityId = playerId;

  world.setPosition(playerId, { x, y, facing: 'n' });
  world.renderables.set(playerId, {
    spriteId: `char_${playerGender}_s`,
    layer: 'character',
    offsetY: -16,
  });
  world.blockings.set(playerId, { blocksMovement: true, blocksSight: false });

  // Copy character sheet from village world
  world.characterSheets.set(playerId, JSON.parse(JSON.stringify(sourceSheet)));

  const maxHp = computeMaxHp(sourceSheet.stats);
  const maxChakra = computeMaxChakra(sourceSheet.stats);
  const maxWillpower = computeMaxWillpower(sourceSheet.stats);
  const maxStamina = computeMaxStamina(sourceSheet.stats);

  world.healths.set(playerId, { current: maxHp, max: maxHp });
  world.combatStats.set(playerId, {
    damage: BASE_PLAYER_DAMAGE,
    accuracy: BASE_PLAYER_ACCURACY,
    evasion: BASE_PLAYER_EVASION,
    attackVerb: 'strike',
  });
  world.playerControlled.set(playerId, { movementStance: 'walk' });
  world.resources.set(playerId, {
    chakra: maxChakra,
    maxChakra,
    chakraCeiling: maxChakra,
    lastChakraExertionTick: 0,
    willpower: maxWillpower,
    maxWillpower,
    stamina: maxStamina,
    maxStamina,
    staminaCeiling: maxStamina,
    lastExertionTick: 0,
    blood: 100,
    maxBlood: 100,
  });
  world.names.set(playerId, { display: playerName, article: '' });

  // Give player thrown weapon ammo (carry over from village or default)
  if (!world.thrownAmmo.has(playerId)) {
    world.thrownAmmo.set(playerId, { kunai: MAX_THROWN_AMMO, shuriken: MAX_THROWN_AMMO });
  }

  return playerId;
}

// ── BANDIT SPAWNING ──

/**
 * Enemy rank tiers — used for all away mission enemy types.
 *
 * Bandit tiers (C-rank — genin level):
 * - Thug: low genin-level hand-to-hand, cannon fodder
 * - Enforcer: mid genin-level technique, very physically strong
 * - Boss: high genin-level hand-to-hand, toughest bandit but not a ninja
 *
 * Rogue Nin tiers (B-rank — chuunin level):
 * - Rogue Nin: low-mid chuunin, trained ninja gone rogue
 * - Rogue Chuunin: solid chuunin, experienced fighter with ninjutsu
 * - Rogue Leader: strong chuunin, top of chuunin range
 *
 * Missing-Nin tiers (A-rank — jonin level):
 * - Missing-Nin Operative: low-mid jonin, lethal and disciplined
 * - Missing-Nin Elite: solid jonin, dangerous ninjutsu user
 * - Missing-Nin Commander: strong jonin, top of jonin range
 */
type EnemyRank = 'thug' | 'enforcer' | 'boss'
  | 'rogue_genin' | 'rogue_chuunin' | 'rogue_leader'
  | 'missing_operative' | 'missing_elite' | 'missing_commander';

function spawnBandits(
  world: World,
  rng: SeededRng,
  config: MissionMapConfig,
  missionData: CRankMissionData,
  campX: number,
  campY: number,
): { targetId: EntityId; banditIds: EntityId[] } {
  const banditIds: EntityId[] = [];
  const enemyType = missionData.enemyType ?? 'bandit';

  // Determine leader and underling ranks based on enemy type
  let leaderRank: EnemyRank;
  let getUnderlingRank: (i: number) => EnemyRank;

  switch (enemyType) {
    case 'rogue_nin':
      leaderRank = 'rogue_leader';
      getUnderlingRank = (i) => (i % 3 === 0) ? 'rogue_chuunin' : 'rogue_genin';
      break;
    case 'missing_nin':
      leaderRank = 'missing_commander';
      getUnderlingRank = (i) => (i % 2 === 0) ? 'missing_elite' : 'missing_operative';
      break;
    default: // bandit
      leaderRank = 'boss';
      getUnderlingRank = (i) => (i % 3 === 0) ? 'enforcer' : 'thug';
      break;
  }

  // Pick sprite generator based on enemy type
  const makeSprite = (enemyType === 'rogue_nin' || enemyType === 'missing_nin')
    ? () => registerNinjaEnemySprites(rng, enemyType)
    : () => registerBanditSprites(rng);

  // Spawn the leader/target first
  const leaderPrefix = makeSprite();
  const leaderId = spawnEnemy(
    world, rng,
    missionData.banditLeaderName || randomBanditLeaderName(rng),
    campX, campY,
    leaderPrefix,
    leaderRank,
    true,
  );
  banditIds.push(leaderId);

  // Spawn underlings
  for (let i = 0; i < config.banditCount - 1; i++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = rng.nextInt(3, 10);
    let bx = Math.floor(campX + Math.cos(angle) * dist);
    let by = Math.floor(campY + Math.sin(angle) * dist);

    // Find walkable tile near target
    for (let attempt = 0; attempt < 10; attempt++) {
      if (world.tileMap.isWalkable(bx, by) && !world.isBlockedByEntity(bx, by)) break;
      bx += rng.nextInt(-2, 2);
      by += rng.nextInt(-2, 2);
      bx = Math.max(4, Math.min(config.width - 4, bx));
      by = Math.max(4, Math.min(config.height - 4, by));
    }

    const rank = getUnderlingRank(i);
    const prefix = makeSprite();
    const bid = spawnEnemy(world, rng, randomBanditName(rng), bx, by, prefix, rank, false);
    banditIds.push(bid);
  }

  return { targetId: leaderId, banditIds };
}

function spawnEnemy(
  world: World,
  rng: SeededRng,
  name: string,
  x: number, y: number,
  spritePrefix: string,
  rank: EnemyRank,
  isMissionTarget: boolean,
): EntityId {
  const id = world.createEntity();

  let tai: number;
  let buki: number;
  let nin: number;
  let phy: number;
  let men: number;
  let cha: number;
  let title: string;
  let description: string;
  let attackVerb: string;
  let isNinja = false;

  switch (rank) {
    // ── Bandit tiers (C-rank) ──
    case 'thug':
      tai = rng.nextInt(5, 15);
      buki = rng.nextInt(3, 10);
      nin = 0;
      phy = rng.nextInt(8, 16);
      men = rng.nextInt(3, 8);
      cha = rng.nextInt(2, 6);
      title = 'Thug';
      description = `A common thug. Relies on brute force rather than skill.`;
      attackVerb = 'swing';
      break;

    case 'enforcer':
      tai = rng.nextInt(15, 25);
      buki = rng.nextInt(8, 18);
      nin = 0;
      phy = rng.nextInt(20, 30);
      men = rng.nextInt(8, 15);
      cha = rng.nextInt(2, 6);
      title = 'Enforcer';
      description = `A seasoned enforcer. Powerfully built, with real fighting experience.`;
      attackVerb = 'slam';
      break;

    case 'boss':
      // High genin-level — toughest bandit but not trained ninja
      tai = rng.nextInt(18, 25);
      buki = rng.nextInt(12, 22);
      nin = 0;
      phy = rng.nextInt(16, 28);
      men = rng.nextInt(10, 18);
      cha = rng.nextInt(2, 6);
      title = 'Boss';
      description = `${name}. ${isMissionTarget ? 'The target of your mission. ' : ''}A dangerous gang leader who fights with brutal precision.`;
      attackVerb = 'slash';
      break;

    // ── Rogue Nin tiers (B-rank — chuunin level) ──
    case 'rogue_genin':
      // Low chuunin underlings — trained ninja, but not elite
      tai = rng.nextInt(20, 30);
      buki = rng.nextInt(12, 22);
      nin = rng.nextInt(10, 20);
      phy = rng.nextInt(14, 22);
      men = rng.nextInt(12, 20);
      cha = rng.nextInt(10, 18);
      title = 'Rogue Nin';
      description = `A rogue ninja. Trained shinobi who abandoned their village.`;
      attackVerb = 'strike';
      isNinja = true;
      break;

    case 'rogue_chuunin':
      // Solid chuunin — experienced, reliable fighter
      tai = rng.nextInt(28, 40);
      buki = rng.nextInt(18, 30);
      nin = rng.nextInt(20, 32);
      phy = rng.nextInt(18, 26);
      men = rng.nextInt(16, 24);
      cha = rng.nextInt(14, 22);
      title = 'Rogue Chuunin';
      description = `A dangerous rogue chuunin. Experienced in real combat and ninjutsu.`;
      attackVerb = 'slash';
      isNinja = true;
      break;

    case 'rogue_leader':
      // Strong chuunin — top of chuunin range, commands the group
      tai = rng.nextInt(35, 48);
      buki = rng.nextInt(22, 35);
      nin = rng.nextInt(25, 38);
      phy = rng.nextInt(20, 30);
      men = rng.nextInt(20, 28);
      cha = rng.nextInt(16, 26);
      title = 'Rogue Leader';
      description = `${name}. ${isMissionTarget ? 'The target of your mission. ' : ''}A veteran chuunin-level rogue who commands through fear and skill.`;
      attackVerb = 'slash';
      isNinja = true;
      break;

    // ── Missing-Nin tiers (A-rank — jonin level) ──
    case 'missing_operative':
      // Low jonin underlings — former village shinobi, dangerous
      tai = rng.nextInt(42, 55);
      buki = rng.nextInt(30, 42);
      nin = rng.nextInt(35, 48);
      phy = rng.nextInt(25, 34);
      men = rng.nextInt(24, 32);
      cha = rng.nextInt(22, 32);
      title = 'Missing-Nin';
      description = `A missing-nin operative. Jonin-level combat training, lethal and disciplined.`;
      attackVerb = 'strike';
      isNinja = true;
      break;

    case 'missing_elite':
      // Solid jonin — high-level ninjutsu user
      tai = rng.nextInt(50, 62);
      buki = rng.nextInt(35, 48);
      nin = rng.nextInt(45, 58);
      phy = rng.nextInt(28, 36);
      men = rng.nextInt(28, 36);
      cha = rng.nextInt(26, 36);
      title = 'Elite Missing-Nin';
      description = `An elite missing-nin. Extremely dangerous — fights with precision and deadly ninjutsu.`;
      attackVerb = 'slash';
      isNinja = true;
      break;

    case 'missing_commander':
      // Strong jonin — top of jonin range
      tai = rng.nextInt(58, 70);
      buki = rng.nextInt(40, 52);
      nin = rng.nextInt(52, 65);
      phy = rng.nextInt(30, 40);
      men = rng.nextInt(30, 40);
      cha = rng.nextInt(28, 40);
      title = 'Missing-Nin Commander';
      description = `${name}. ${isMissionTarget ? 'The target of your mission. ' : ''}A feared jonin-level missing-nin. Approach with extreme caution.`;
      attackVerb = 'slash';
      isNinja = true;
      break;
  }

  const stats = { phy, cha, men };
  const skills = { taijutsu: tai, bukijutsu: buki, ninjutsu: nin, genjutsu: 0, med: 0 };
  const hp = computeMaxHp(stats);

  const facings = ['n', 's', 'e', 'w'] as const;
  const facing = facings[rng.nextInt(0, 3)];

  world.setPosition(id, { x, y, facing });
  world.renderables.set(id, { spriteId: `${spritePrefix}_${facing}`, layer: 'character', offsetY: -16 });
  world.blockings.set(id, { blocksMovement: true, blocksSight: false });
  world.healths.set(id, { current: hp, max: hp });
  world.combatStats.set(id, {
    damage: Math.max(3, Math.floor(tai * 0.4 + phy * 0.1 + nin * 0.15)),
    accuracy: 35 + tai + Math.floor(nin * 0.2),
    evasion: Math.max(5, Math.floor(tai * 0.15 + phy * 0.05 + nin * 0.1)),
    attackVerb,
  });
  // Determine class and shinobi rank from enemy tier
  let charClass: 'shinobi' | 'civilian' = isNinja ? 'shinobi' : 'civilian';
  let shinobiRank: import('../types/character.ts').ShinobiRank = 'civilian';
  if (isNinja) {
    switch (rank) {
      case 'rogue_genin':       shinobiRank = 'genin';   break;
      case 'rogue_chuunin':     shinobiRank = 'chuunin'; break;
      case 'rogue_leader':      shinobiRank = 'chuunin'; break;
      case 'missing_operative': shinobiRank = 'jounin';  break;
      case 'missing_elite':     shinobiRank = 'jounin';  break;
      case 'missing_commander': shinobiRank = 'jounin';  break;
      default:                  shinobiRank = 'genin';   break;
    }
  }

  world.characterSheets.set(id, {
    class: charClass,
    rank: shinobiRank,
    title,
    skills,
    stats,
    learnedJutsus: isNinja ? getAccessibleJutsus(nin) : [],
  });
  world.names.set(id, { display: name, article: '' });

  // Give ninja enemies chakra resources so they can use jutsu
  if (isNinja) {
    const maxChakra = 20 + Math.floor(nin * 0.8);
    const maxStam = 30 + Math.floor(phy * 0.5);
    const maxWill = 20 + Math.floor(men * 0.6);
    world.resources.set(id, {
      chakra: maxChakra,
      maxChakra,
      chakraCeiling: maxChakra,
      lastChakraExertionTick: 0,
      willpower: maxWill,
      maxWillpower: maxWill,
      stamina: maxStam,
      maxStamina: maxStam,
      staminaCeiling: maxStam,
      lastExertionTick: 0,
      blood: 100,
      maxBlood: 100,
    });
  }

  world.aiControlled.set(id, {
    behavior: isMissionTarget ? 'static' : 'wander',
  });
  world.objectSheets.set(id, { description, category: 'npc' });

  // Proximity dialogue varies by enemy type
  const banditBossLines = [
    `"You picked the wrong camp to wander into."`,
    `"A Konoha ninja? Out here? How bold."`,
    `"You'll make a fine hostage."`,
  ];
  const banditEnforcerLines = [
    `"You don't want to be here."`,
    `"Boss doesn't like visitors."`,
    `"Turn around. Last warning."`,
  ];
  const banditThugLines = [
    `"Hey! Who are you?!"`,
    `"Intruder! Get 'em!"`,
    `"Wrong place, wrong time."`,
  ];
  const rogueLeaderLines = [
    `"A Konoha dog, all the way out here? Interesting."`,
    `"They sent one shinobi? That's insulting."`,
    `"You won't leave this forest alive."`,
  ];
  const rogueChuuninLines = [
    `"Konoha headband... You're far from home."`,
    `"Another one who thinks they can stop us."`,
    `"I left the village for a reason. Don't test me."`,
  ];
  const rogueGeninLines = [
    `"A Leaf ninja?! Stay back!"`,
    `"I didn't sign up for this..."`,
    `"You'll pay for coming here!"`,
  ];
  const missingCommanderLines = [
    `"Konoha sends children to fight me now?"`,
    `"I've killed shinobi far stronger than you."`,
    `"You have no idea what you've walked into."`,
  ];
  const missingEliteLines = [
    `"Another one from the Leaf? How tedious."`,
    `"Your jutsu won't save you here."`,
    `"I'll add your headband to my collection."`,
  ];
  const missingOperativeLines = [
    `"Konoha scum. You're already dead."`,
    `"Nothing personal. Just business."`,
    `"The commander will be pleased with your head."`,
  ];

  let dialogueLines: string[];
  switch (rank) {
    case 'boss': dialogueLines = banditBossLines; break;
    case 'enforcer': dialogueLines = banditEnforcerLines; break;
    case 'thug': dialogueLines = banditThugLines; break;
    case 'rogue_leader': dialogueLines = rogueLeaderLines; break;
    case 'rogue_chuunin': dialogueLines = rogueChuuninLines; break;
    case 'rogue_genin': dialogueLines = rogueGeninLines; break;
    case 'missing_commander': dialogueLines = missingCommanderLines; break;
    case 'missing_elite': dialogueLines = missingEliteLines; break;
    case 'missing_operative': dialogueLines = missingOperativeLines; break;
  }

  world.proximityDialogue.set(id, {
    lines: { neutral: dialogueLines },
    lastSpokeTick: -100,
    cooldownTicks: 20,
  });

  world.anchors.set(id, {
    anchorX: x,
    anchorY: y,
    wanderRadius: isMissionTarget ? 2 : isNinja ? 5 : 6,
    lastMoveTick: world.currentTick,
    moveIntervalTicks: rng.nextInt(3, 6),
    spritePrefix,
  });
  world.npcLifecycles.set(id, {
    category: 'fixed',
    isNinja,
    despawnAtNight: false,
  });

  // Aggro component for chase/flee behavior on mission maps
  world.aggros.set(id, {
    targetId: null,
    state: 'idle',
    fleeHpThreshold: isNinja ? 0.20 : 0.40,
  });

  return id;
}

// ── SQUAD MEMBER SPAWNING ──

let squadSpriteCounter = 0;

/** Spawn an allied squad member entity on the mission map */
function spawnSquadMember(
  world: World,
  member: SquadMember,
  x: number,
  y: number,
): EntityId {
  const id = world.createEntity();

  // Register unique sprites for this squad member (Konoha ninja body)
  const prefix = `squad_${squadSpriteCounter++}`;
  const bodyOverride = member.female ? undefined : undefined; // ninja body (default) for all
  const sprites = generateCharacterSprites(member.accents, bodyOverride);
  for (const [dir, pattern] of Object.entries(sprites)) {
    spriteCache.registerDynamic(`${prefix}_${dir}`, pattern, 48, 48, true);
  }
  // Signing sprites (hands joined pose)
  const signingSprites = generateCharacterSprites(member.accents, SIGNING_BODIES);
  for (const [dir, pattern] of Object.entries(signingSprites)) {
    if (dir === 'prone') continue;
    spriteCache.registerDynamic(`${prefix}_sign_${dir}`, pattern, 48, 48, true);
  }

  const stats = member.stats;
  const skills = member.skills;
  const hp = computeMaxHp(stats);

  world.setPosition(id, { x, y, facing: 'n' });
  world.renderables.set(id, { spriteId: `${prefix}_n`, layer: 'character', offsetY: -16 });
  world.blockings.set(id, { blocksMovement: true, blocksSight: false });
  world.healths.set(id, { current: hp, max: hp });
  world.combatStats.set(id, {
    damage: Math.max(3, Math.floor(skills.taijutsu * 0.4 + stats.phy * 0.1 + skills.ninjutsu * 0.15)),
    accuracy: 35 + skills.taijutsu + Math.floor(skills.ninjutsu * 0.2),
    evasion: Math.max(5, Math.floor(skills.taijutsu * 0.15 + stats.phy * 0.05 + skills.ninjutsu * 0.1)),
    attackVerb: 'strike',
  });
  world.characterSheets.set(id, {
    class: 'shinobi',
    rank: member.rank,
    title: member.title,
    skills,
    stats,
    learnedJutsus: getAccessibleJutsus(skills.ninjutsu),
  });
  world.names.set(id, { display: member.name, article: '' });

  // Resources (chakra, stamina, willpower)
  const maxChakra = 20 + Math.floor(skills.ninjutsu * 0.8);
  const maxStam = 30 + Math.floor(stats.phy * 0.5);
  const maxWill = 20 + Math.floor(stats.men * 0.6);
  world.resources.set(id, {
    chakra: maxChakra,
    maxChakra,
    chakraCeiling: maxChakra,
    lastChakraExertionTick: 0,
    willpower: maxWill,
    maxWillpower: maxWill,
    stamina: maxStam,
    maxStamina: maxStam,
    staminaCeiling: maxStam,
    lastExertionTick: 0,
    blood: 100,
    maxBlood: 100,
  });

  // AI: squad members use 'wander' behavior but are overridden by squadAI
  world.aiControlled.set(id, { behavior: 'static' });
  world.objectSheets.set(id, {
    description: `${member.name}, ${member.title}. A Konoha shinobi assigned to your squad for this mission.`,
    category: 'npc',
  });

  // Squad member tag
  world.squadMembers.set(id, {
    rosterId: member.id,
    personality: member.personality,
  });

  // Give squad member thrown weapon ammo (ninja with bukijutsu)
  if (member.skills.bukijutsu >= 1) {
    const kunai = 3 + Math.floor(Math.random() * 4);
    const shuriken = Math.min(10 - kunai, 3 + Math.floor(Math.random() * 4));
    world.thrownAmmo.set(id, { kunai, shuriken });
  }

  // Anchor (for sprite facing updates)
  world.anchors.set(id, {
    anchorX: x,
    anchorY: y,
    wanderRadius: 0,
    lastMoveTick: world.currentTick,
    moveIntervalTicks: 3,
    spritePrefix: prefix,
  });

  world.npcLifecycles.set(id, {
    category: 'fixed',
    isNinja: true,
    despawnAtNight: false,
  });

  // Squad members have proximity dialogue
  world.proximityDialogue.set(id, {
    lines: {
      neutral: [
        `"Ready when you are, team leader."`,
        `"I've got your back."`,
        `"Staying close."`,
        `"Let's move."`,
      ],
    },
    lastSpokeTick: -100,
    cooldownTicks: 30,
  });

  return id;
}
