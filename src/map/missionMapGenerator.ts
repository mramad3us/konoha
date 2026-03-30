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
import type { MissionMapConfig, CRankMissionData } from '../types/awayMission.ts';
import type { TileType } from '../types/tiles.ts';
import type { EntityId } from '../types/ecs.ts';
import {
  MISSION_MAP_EDGE_ZONE,
  BASE_PLAYER_DAMAGE, BASE_PLAYER_ACCURACY, BASE_PLAYER_EVASION,
} from '../core/constants.ts';
import { computeMaxHp, computeMaxChakra, computeMaxStamina, computeMaxWillpower } from '../engine/derivedStats.ts';
import type { CharacterAccents } from '../sprites/characters.ts';
import { generateCharacterSprites, CIVILIAN_BODIES } from '../sprites/characters.ts';
import { spriteCache } from '../rendering/spriteCache.ts';

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
  { spriteId: 'obj_bush_small', offsetY: -8, blocksMove: false, blocksSight: false, displayName: 'bush', article: 'a', description: 'A low shrub.' },
  { spriteId: 'obj_bush_berry', offsetY: -10, blocksMove: false, blocksSight: false, displayName: 'berry bush', article: 'a', description: 'Dark berries grow among the leaves.' },
  { spriteId: 'obj_bush_flower', offsetY: -10, blocksMove: false, blocksSight: false, displayName: 'flowering bush', article: 'a', description: 'Bright flowers dot this bush.' },
  { spriteId: 'obj_bush_tall', offsetY: -14, blocksMove: true, blocksSight: false, displayName: 'tall bush', article: 'a', description: 'A dense thicket, tall enough to block your path.' },
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
): MissionMapResult {
  const W = config.width;
  const H = config.height;
  const rng = new SeededRng(config.seed);
  const tileMap = new TileMap(W, H);

  // ── Layer 1: Base terrain ──
  fillBaseTerrainForest(tileMap, W, H, rng);

  // ── Layer 2: Water features ──
  if (config.terrainType === 'riverside' || rng.nextBool(0.4)) {
    addRiver(tileMap, W, H, rng);
  }
  addPonds(tileMap, W, H, rng, rng.nextInt(1, 4));

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

  // ── Layer 4: Scatter terrain objects (trees, rocks, bushes) ──
  scatterForestObjects(world, W, H, rng, clearings);

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

  return {
    world,
    playerEntityId: playerId,
    targetEntityId: targetId,
    banditEntityIds: banditIds,
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

function scatterForestObjects(
  world: World, w: number, h: number, rng: SeededRng,
  clearings: Array<{ cx: number; cy: number; radius: number }>,
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

      // Random pruning — skip ~25% of positions for organic feel
      if (rng.nextBool(0.25)) continue;

      // Skip if on a dirt path
      if (tileMap.getTileType(jx, jy) === 'dirt') {
        if (rng.nextBool(0.85)) continue; // 85% chance to skip dirt tiles
      }

      // Decide what to place: mostly trees, some rocks, some bushes
      const roll = rng.next();
      if (roll < 0.65) {
        // Tree
        const variant = TREE_VARIANTS[rng.nextInt(0, TREE_VARIANTS.length - 1)];
        spawnTerrainObject(world, jx, jy, variant);
      } else if (roll < 0.78) {
        // Bush
        const variant = BUSH_VARIANTS[rng.nextInt(0, BUSH_VARIANTS.length - 1)];
        spawnTerrainObject(world, jx, jy, variant);
      } else if (roll < 0.88) {
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
    { dx: 4, dy: 1, sprite: 'obj_rock_small', name: 'supply crate', desc: 'Stolen goods piled carelessly. Marked crates from several villages.' },
    { dx: -4, dy: 0, sprite: 'obj_rock_medium', name: 'weapon stash', desc: 'Crude weapons leaned against a rock. Axes, clubs, a rusty sword.' },
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

  return playerId;
}

// ── BANDIT SPAWNING ──

/**
 * Enemy rank tiers — used for all away mission enemy types.
 *
 * Bandit tiers (C-rank):
 * - Thug: low genin-level hand-to-hand, cannon fodder
 * - Enforcer: high genin-level technique, very physically strong
 * - Boss: chuunin-level hand-to-hand, strength varies
 *
 * Rogue Nin tiers (B-rank):
 * - Rogue Genin: trained ninja who went rogue, genin-level ninjutsu
 * - Rogue Chuunin: experienced rogue, chuunin-level all-around
 * - Rogue Leader: top-tier rogue, near-jonin combat ability
 *
 * Missing-Nin tiers (A-rank):
 * - Missing-Nin Operative: jonin-level combat, trained assassin
 * - Missing-Nin Elite: high jonin, dangerous ninjutsu user
 * - Missing-Nin Commander: elite combatant, near-kage potential
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

  // Spawn the leader/target first
  const leaderPrefix = registerBanditSprites(rng);
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
    const prefix = registerBanditSprites(rng);
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
      tai = rng.nextInt(25, 40);
      buki = rng.nextInt(15, 25);
      nin = 0;
      phy = rng.nextInt(15, 30);
      men = rng.nextInt(12, 22);
      cha = rng.nextInt(2, 6);
      title = 'Boss';
      description = `${name}. ${isMissionTarget ? 'The target of your mission. ' : ''}A dangerous gang leader who fights with brutal precision.`;
      attackVerb = 'slash';
      break;

    // ── Rogue Nin tiers (B-rank) ──
    case 'rogue_genin':
      tai = rng.nextInt(15, 25);
      buki = rng.nextInt(10, 20);
      nin = rng.nextInt(8, 18);
      phy = rng.nextInt(12, 20);
      men = rng.nextInt(10, 18);
      cha = rng.nextInt(8, 15);
      title = 'Rogue Genin';
      description = `A rogue ninja. Trained but turned to crime.`;
      attackVerb = 'strike';
      isNinja = true;
      break;

    case 'rogue_chuunin':
      tai = rng.nextInt(25, 40);
      buki = rng.nextInt(15, 28);
      nin = rng.nextInt(15, 30);
      phy = rng.nextInt(18, 28);
      men = rng.nextInt(15, 25);
      cha = rng.nextInt(12, 22);
      title = 'Rogue Chuunin';
      description = `A dangerous rogue chuunin. Experienced in real combat and ninjutsu.`;
      attackVerb = 'slash';
      isNinja = true;
      break;

    case 'rogue_leader':
      tai = rng.nextInt(35, 50);
      buki = rng.nextInt(20, 35);
      nin = rng.nextInt(25, 40);
      phy = rng.nextInt(22, 32);
      men = rng.nextInt(20, 30);
      cha = rng.nextInt(15, 28);
      title = 'Rogue Leader';
      description = `${name}. ${isMissionTarget ? 'The target of your mission. ' : ''}A near-jonin level rogue who commands through fear and skill.`;
      attackVerb = 'slash';
      isNinja = true;
      break;

    // ── Missing-Nin tiers (A-rank) ──
    case 'missing_operative':
      tai = rng.nextInt(35, 50);
      buki = rng.nextInt(25, 38);
      nin = rng.nextInt(30, 45);
      phy = rng.nextInt(25, 35);
      men = rng.nextInt(22, 32);
      cha = rng.nextInt(20, 32);
      title = 'Missing-Nin';
      description = `A missing-nin operative. Jonin-level combat training, lethal and disciplined.`;
      attackVerb = 'strike';
      isNinja = true;
      break;

    case 'missing_elite':
      tai = rng.nextInt(45, 60);
      buki = rng.nextInt(30, 45);
      nin = rng.nextInt(40, 55);
      phy = rng.nextInt(28, 38);
      men = rng.nextInt(28, 38);
      cha = rng.nextInt(25, 38);
      title = 'Elite Missing-Nin';
      description = `An elite missing-nin. Extremely dangerous — fights with precision and deadly ninjutsu.`;
      attackVerb = 'slash';
      isNinja = true;
      break;

    case 'missing_commander':
      tai = rng.nextInt(55, 70);
      buki = rng.nextInt(35, 50);
      nin = rng.nextInt(50, 65);
      phy = rng.nextInt(30, 42);
      men = rng.nextInt(32, 42);
      cha = rng.nextInt(30, 42);
      title = 'Missing-Nin Commander';
      description = `${name}. ${isMissionTarget ? 'The target of your mission. ' : ''}A feared missing-nin of near-legendary ability. Approach with extreme caution.`;
      attackVerb = 'slash';
      isNinja = true;
      break;
  }

  const stats = { phy, cha, men, soc: rng.nextInt(2, 6) };
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
  world.characterSheets.set(id, {
    class: 'civilian',
    rank: isNinja ? 'genin' : 'genin', // visual rank doesn't matter for enemies
    title,
    skills,
    stats,
    learnedJutsus: [],
  });
  world.names.set(id, { display: name, article: '' });
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

  return id;
}
