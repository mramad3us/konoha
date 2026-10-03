/**
 * Overmap pixel art renderer — tile-based world map on canvas.
 *
 * Uses a continent mask approach for organic coastlines:
 * 1. Define landmass shape via distance-from-center + warped noise
 * 2. Smooth coastal transitions: deep ocean → shallow → beach → land
 * 3. Nations influence biome tendency via soft gradient (no hard borders)
 * 4. Rivers flow from high to low elevation
 * 5. Roads connect settlement nodes
 */

import { OVERMAP_CANVAS_WIDTH, OVERMAP_CANVAS_HEIGHT } from '../core/constants.ts';
import { OVERMAP_NODES, OVERMAP_EDGES, getOvermapNode, getEdge } from './overmapData.ts';
import type { OvermapTravelState } from '../types/overmap.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';

const W = OVERMAP_CANVAS_WIDTH;
const H = OVERMAP_CANVAS_HEIGHT;

// Tile grid dimensions (4px per tile → 200×150 tiles)
const TILE_SIZE = 4;
const COLS = Math.floor(W / TILE_SIZE);
const ROWS = Math.floor(H / TILE_SIZE);

// ── TERRAIN COLORS ──
const TERRAIN_COLORS: Record<string, string> = {
  deep_water:    '#1a3355',
  shallow_water: '#2a5580',
  beach:         '#c8b868',
  dry_grass:     '#8a9a48',
  plains:        '#5a8a30',
  light_forest:  '#3a7a22',
  forest:        '#2a6018',
  dense_forest:  '#1a4210',
  hills:         '#7a7a42',
  mountain:      '#6a6a6a',
  peak:          '#c8c8c8',
  desert:        '#c8a848',
  arid_plains:   '#9a8a40',
  swamp:         '#3a4a20',
  tundra:        '#8a9aa0',
  snow:          '#c0d0d8',
  rocky:         '#7a6a5a',
  volcanic:      '#5a2218',
  river:         '#2a6aaa',
};

// Settlement rendering
const HIDDEN_VILLAGE_COLOR = '#FFD700';
const TOWN_COLOR = '#C0C0C0';
const OUTPOST_COLOR = '#8A7A6A';
const BORDER_COLOR = '#6A8A6A';
const LABEL_COLOR = '#E8E0D0';
const LABEL_SHADOW = '#1A1A2A';
const CAMPFIRE_COLORS = ['#FF6600', '#FF9933', '#FFCC00', '#FF4400'];
const PAWN_BODY = '#E8C080';
const PAWN_HAIR = '#2A2A3A';
const PAWN_OUTLINE = '#1A1A2A';
const CLOUD_COLOR = 'rgba(200, 200, 220, 0.10)';

// ── NATION CENTERS (pixel coords on 800×600 map) ──
// Each defines the "heart" of a nation. Tiles blend toward the nearest center's biome.
interface NationCenter {
  id: string;
  name: string;
  cx: number; cy: number;
  /** Primary biome tendency */
  biome: 'temperate' | 'desert' | 'rocky' | 'tropical' | 'misty' | 'cold' | 'swamp' | 'volcanic';
  /** Elevation offset (higher = more mountainous) */
  elevBias: number;
  /** Moisture offset */
  moistBias: number;
  /** Label position (pixel coords) */
  labelX: number; labelY: number;
}

const NATION_CENTERS: NationCenter[] = [
  { id: 'fire',      name: 'Land of Fire',       cx: 490, cy: 260, biome: 'temperate', elevBias: 0,   moistBias: 30,  labelX: 490, labelY: 265 },
  { id: 'wind',      name: 'Land of Wind',       cx: 270, cy: 310, biome: 'desert',    elevBias: -20, moistBias: -60, labelX: 270, labelY: 310 },
  { id: 'earth',     name: 'Land of Earth',      cx: 340, cy: 110, biome: 'rocky',     elevBias: 40,  moistBias: -10, labelX: 340, labelY: 120 },
  { id: 'lightning', name: 'Land of Lightning',   cx: 650, cy: 90,  biome: 'cold',      elevBias: 30,  moistBias: 10,  labelX: 650, labelY: 95 },
  { id: 'water',     name: 'Land of Water',       cx: 730, cy: 240, biome: 'misty',     elevBias: -10, moistBias: 50,  labelX: 720, labelY: 235 },
  { id: 'rain',      name: 'Land of Rain',        cx: 400, cy: 180, biome: 'swamp',     elevBias: -5,  moistBias: 40,  labelX: 400, labelY: 180 },
  { id: 'grass',     name: 'Land of Grass',       cx: 380, cy: 140, biome: 'temperate', elevBias: -10, moistBias: 20,  labelX: 380, labelY: 140 },
  { id: 'sound',     name: 'Land of Sound',       cx: 510, cy: 180, biome: 'temperate', elevBias: 10,  moistBias: 0,   labelX: 505, labelY: 180 },
  { id: 'tea',       name: 'Land of Tea',         cx: 610, cy: 380, biome: 'tropical',  elevBias: -15, moistBias: 20,  labelX: 610, labelY: 380 },
  { id: 'rivers',    name: 'Land of Rivers',      cx: 425, cy: 355, biome: 'swamp',     elevBias: -10, moistBias: 50,  labelX: 425, labelY: 355 },
];

// ── CONTINENT SHAPE ──
// The continent is defined by anchor points that form the rough outline.
// The continent mask uses distance-to-nearest-anchor + warped noise for organic edges.

/** Anchor points that define the landmass extent */
const CONTINENT_ANCHORS = [
  // Main continent body
  { x: 400, y: 260, r: 220 },  // Center of the continent (large radius)
  { x: 490, y: 240, r: 180 },  // Fire country heart
  { x: 340, y: 150, r: 140 },  // Earth country
  { x: 540, y: 200, r: 120 },  // Sound/Fire border area
  { x: 650, y: 100, r: 100 },  // Lightning — a peninsula
  { x: 400, y: 350, r: 130 },  // Rivers/Tea direction
  { x: 310, y: 280, r: 110 },  // Wind country edge
  { x: 580, y: 340, r: 100 },  // Tea peninsula
  { x: 270, y: 200, r: 80 },   // Wind north edge
  // Peninsulas and extensions
  { x: 680, y: 130, r: 60 },   // Lightning peninsula tip
  { x: 620, y: 380, r: 70 },   // Tea peninsula tip
  { x: 240, y: 340, r: 60 },   // Wind south coast
  { x: 450, y: 400, r: 60 },   // South coast
  { x: 500, y: 130, r: 60 },   // North fire
];

/** Small island patches for additional landmass detail */
const ISLANDS = [
  { x: 730, y: 230, r: 35 },   // Water country — island nation
  { x: 750, y: 250, r: 25 },   // Water country island
  { x: 710, y: 210, r: 20 },   // Small island
  { x: 180, y: 240, r: 18 },   // Western islet
  { x: 160, y: 370, r: 22 },   // Southwest island
  { x: 550, y: 430, r: 15 },   // Southern islet
  { x: 690, y: 300, r: 16 },   // Eastern islet
];

// ── NOISE GENERATION ──

/** Simple 2D value noise using cellHash for deterministic results */
function noise2d(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;

  // Smooth interpolation (cubic hermite)
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const n00 = (cellHash(ix + seed, iy) % 1000) / 1000;
  const n10 = (cellHash(ix + 1 + seed, iy) % 1000) / 1000;
  const n01 = (cellHash(ix + seed, iy + 1) % 1000) / 1000;
  const n11 = (cellHash(ix + 1 + seed, iy + 1) % 1000) / 1000;

  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return nx0 + (nx1 - nx0) * uy;
}

/** Multi-octave noise for natural-looking terrain */
function fbmNoise(x: number, y: number, octaves: number, scale: number, seed: number): number {
  let value = 0;
  let amplitude = 1;
  let totalAmp = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += noise2d(x * freq, y * freq, scale, seed + i * 1000) * amplitude;
    totalAmp += amplitude;
    amplitude *= 0.5;
    freq *= 2;
  }
  return value / totalAmp;
}

// ── CONTINENT MASK ──

/**
 * Compute the "landness" of a pixel position (0 = deep ocean, 1 = solid land).
 * Uses distance to continent anchors + domain-warped noise for organic edges.
 */
function continentMask(px: number, py: number): number {
  // Domain warp — shift sample position by noise for organic coastlines
  const warpScale = 80;
  const warpAmt = 35;
  const wx = px + (fbmNoise(px, py, 3, warpScale, 500) - 0.5) * warpAmt * 2;
  const wy = py + (fbmNoise(px, py, 3, warpScale, 700) - 0.5) * warpAmt * 2;

  // Find best contribution from continent anchors
  let bestVal = 0;
  for (const a of CONTINENT_ANCHORS) {
    const dx = wx - a.x;
    const dy = wy - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Smooth falloff from anchor center
    const val = Math.max(0, 1 - dist / a.r);
    if (val > bestVal) bestVal = val;
  }

  // Islands contribute separately with smaller influence
  for (const isl of ISLANDS) {
    const dx = wx - isl.x;
    const dy = wy - isl.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const val = Math.max(0, 1 - dist / isl.r);
    if (val > bestVal) bestVal = val;
  }

  // Add fine noise to the mask for rough coastlines
  const coastNoise = fbmNoise(px, py, 4, 25, 300) * 0.35;
  bestVal += coastNoise - 0.15;

  return Math.max(0, Math.min(1, bestVal));
}

// ── TILE MAP GENERATION ──

interface MapTile {
  terrain: string;
  nationId: string;
  elevation: number;
  moisture: number;
  isRoad: boolean;
  isRiver: boolean;
}

function generateTileMap(): MapTile[] {
  const tiles: MapTile[] = new Array(COLS * ROWS);

  // Step 1: Generate continent mask, elevation, moisture, and assign nations
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const idx = ty * COLS + tx;
      const px = tx * TILE_SIZE + TILE_SIZE / 2;
      const py = ty * TILE_SIZE + TILE_SIZE / 2;

      const landVal = continentMask(px, py);

      // Ocean tiles
      if (landVal < 0.15) {
        tiles[idx] = {
          terrain: landVal < 0.05 ? 'deep_water' : 'shallow_water',
          nationId: 'ocean',
          elevation: landVal * 100,
          moisture: 100,
          isRoad: false,
          isRiver: false,
        };
        continue;
      }

      // Beach transition
      if (landVal < 0.22) {
        tiles[idx] = {
          terrain: 'beach',
          nationId: 'coast',
          elevation: 50 + landVal * 50,
          moisture: 60,
          isRoad: false,
          isRiver: false,
        };
        continue;
      }

      // Determine nation influence (soft blend, not hard Voronoi)
      let bestNation = NATION_CENTERS[0];
      let bestScore = Infinity;
      for (const nc of NATION_CENTERS) {
        const dx = px - nc.cx;
        const dy = py - nc.cy;
        // Jitter distance for softer boundaries
        const jitter = (cellHash(tx * 7 + 13, ty * 11 + 37) % 40) - 20;
        const dist = Math.sqrt(dx * dx + dy * dy) + jitter;
        if (dist < bestScore) {
          bestScore = dist;
          bestNation = nc;
        }
      }

      // Elevation from noise + nation bias
      let elevation = fbmNoise(px, py, 5, 45, 42) * 200 + 55;
      elevation += bestNation.elevBias;
      // Terrain is naturally higher in the interior
      elevation += landVal * 30;

      // Moisture from different noise seed + nation bias
      let moisture = fbmNoise(px, py, 4, 55, 137) * 255;
      moisture += bestNation.moistBias;

      elevation = Math.max(60, Math.min(255, elevation));
      moisture = Math.max(0, Math.min(255, moisture));

      const terrain = classifyBiome(elevation, moisture, bestNation.biome, landVal);

      tiles[idx] = {
        terrain,
        nationId: bestNation.id,
        elevation,
        moisture,
        isRoad: false,
        isRiver: false,
      };
    }
  }

  // Step 2: Rivers
  stampRivers(tiles);

  // Step 3: Roads
  stampRoads(tiles);

  return tiles;
}

function classifyBiome(elev: number, moist: number, nationBiome: string, landVal: number): string {
  // Near-coast areas tend to be lighter/drier
  if (landVal < 0.3) {
    if (moist > 140) return 'plains';
    return 'dry_grass';
  }

  // Mountain at very high elevations
  if (elev > 220) return 'peak';
  if (elev > 195) return 'mountain';
  if (elev > 170) return 'hills';

  // Nation-specific biomes
  switch (nationBiome) {
    case 'desert':
      if (moist < 60) return 'desert';
      if (moist < 100) return 'arid_plains';
      return 'dry_grass';

    case 'rocky':
      if (elev > 145) return 'rocky';
      if (moist > 150) return 'forest';
      return 'hills';

    case 'cold':
      if (elev > 145) return 'snow';
      if (moist > 120) return 'tundra';
      return 'hills';

    case 'misty':
      if (moist > 160) return 'dense_forest';
      if (moist > 100) return 'forest';
      return 'light_forest';

    case 'swamp':
      if (moist > 160) return 'swamp';
      if (moist > 100) return 'dense_forest';
      return 'forest';

    case 'tropical':
      if (moist > 140) return 'dense_forest';
      if (moist > 80) return 'forest';
      return 'light_forest';

    case 'volcanic':
      if (elev > 155) return 'volcanic';
      return 'rocky';

    default: // temperate
      if (moist > 170) return 'dense_forest';
      if (moist > 130) return 'forest';
      if (moist > 90) return 'light_forest';
      if (moist > 50) return 'plains';
      return 'dry_grass';
  }
}

/** Stamp winding river paths through the terrain */
function stampRivers(tiles: MapTile[]): void {
  const riverStarts = [
    { tx: 85, ty: 25 },  // From Earth mountains
    { tx: 105, ty: 50 }, // Through Fire
    { tx: 160, ty: 20 }, // From Lightning mountains
    { tx: 70, ty: 70 },  // Through Grass/Rain
    { tx: 120, ty: 65 }, // Fire interior
  ];

  for (const start of riverStarts) {
    let tx = start.tx;
    let ty = start.ty;

    for (let step = 0; step < 100; step++) {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) break;
      const idx = ty * COLS + tx;
      if (!tiles[idx]) break;

      const terrain = tiles[idx].terrain;
      if (terrain === 'deep_water' || terrain === 'shallow_water') break;

      tiles[idx].isRiver = true;
      tiles[idx].terrain = 'river';

      // Also set adjacent tile for wider river in places
      if (step % 3 === 0) {
        const side = (cellHash(tx + step, ty) % 2 === 0) ? 1 : -1;
        const adjIdx = ty * COLS + (tx + side);
        if (tx + side >= 0 && tx + side < COLS && tiles[adjIdx]) {
          const adjTerr = tiles[adjIdx].terrain;
          if (adjTerr !== 'deep_water' && adjTerr !== 'shallow_water' && adjTerr !== 'beach') {
            tiles[adjIdx].isRiver = true;
            tiles[adjIdx].terrain = 'river';
          }
        }
      }

      // Flow toward lowest neighbor with some randomness
      let bestTx = tx;
      let bestTy = ty + 1;
      let bestElev = Infinity;

      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        const ni = ny * COLS + nx;
        if (!tiles[ni]) continue;
        const jitter = (cellHash(nx + step * 7, ny + step * 3) % 20) - 5;
        const neighborElev = tiles[ni].elevation + jitter;
        if (neighborElev < bestElev) {
          bestElev = neighborElev;
          bestTx = nx;
          bestTy = ny;
        }
      }

      tx = bestTx;
      ty = bestTy;
    }
  }
}

/** Stamp roads as tile-width paths between overmap nodes */
function stampRoads(tiles: MapTile[]): void {
  for (const edge of OVERMAP_EDGES) {
    const from = getOvermapNode(edge.from);
    const to = getOvermapNode(edge.to);
    if (!from || !to) continue;

    const points = [
      { x: from.x, y: from.y },
      ...edge.waypoints,
      { x: to.x, y: to.y },
    ];

    for (let i = 0; i < points.length - 1; i++) {
      const ax = points[i].x;
      const ay = points[i].y;
      const bx = points[i + 1].x;
      const by = points[i + 1].y;
      const dist = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
      const steps = Math.ceil(dist / 2);

      for (let s = 0; s <= steps; s++) {
        const t = s / Math.max(1, steps);
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        const ttx = Math.floor(px / TILE_SIZE);
        const tty = Math.floor(py / TILE_SIZE);
        if (ttx < 0 || ttx >= COLS || tty < 0 || tty >= ROWS) continue;
        const idx = tty * COLS + ttx;
        if (!tiles[idx]) continue;
        if (tiles[idx].terrain === 'deep_water' || tiles[idx].terrain === 'shallow_water' || tiles[idx].terrain === 'river') continue;
        tiles[idx].isRoad = true;
      }
    }
  }
}

// ── ANIMATION STATE ──

interface Cloud {
  x: number; y: number;
  width: number; height: number;
  speed: number;
}

// ── RENDERER ──

export class OvermapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgCanvas: OffscreenCanvas;
  private bgCtx: OffscreenCanvasRenderingContext2D;
  private bgRendered = false;

  private tileMap: MapTile[] | null = null;
  private clouds: Cloud[] = [];
  private animTime = 0;
  private waterPhase = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.bgCanvas = new OffscreenCanvas(W, H);
    this.bgCtx = this.bgCanvas.getContext('2d')!;
    this.bgCtx.imageSmoothingEnabled = false;

    // Generate clouds
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: cellHash(i, 0) % W,
        y: 30 + (cellHash(i, 1) % (H - 100)),
        width: 50 + (cellHash(i, 2) % 80),
        height: 10 + (cellHash(i, 3) % 14),
        speed: 1.5 + (cellHash(i, 4) % 4),
      });
    }
  }

  /** Render one frame */
  draw(travelState: OvermapTravelState | null, dt: number, isNight: boolean): void {
    this.animTime += dt;
    this.waterPhase += dt * 0.5;

    if (!this.bgRendered) {
      this.tileMap = generateTileMap();
      this.renderBackground();
      this.bgRendered = true;
    }

    // Blit static background
    this.ctx.drawImage(this.bgCanvas, 0, 0);

    // Animated water shimmer
    this.drawWaterShimmer();

    // Clouds
    this.drawClouds(dt);

    // Travel route + pawn
    if (travelState) {
      this.drawTravelRoute(travelState);
      this.drawPawn(travelState);
    }

    // Night overlay
    if (isNight) {
      this.ctx.fillStyle = 'rgba(10, 10, 30, 0.4)';
      this.ctx.fillRect(0, 0, W, H);
    }

    // HUD overlays
    if (travelState) {
      this.drawTravelInfo(travelState);
    }
  }

  /** Render the static tile-based background to an offscreen canvas */
  private renderBackground(): void {
    const ctx = this.bgCtx;
    const tiles = this.tileMap!;

    // Draw each tile
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const tile = tiles[ty * COLS + tx];
        if (!tile) continue;

        let color: string;
        if (tile.isRoad && !tile.isRiver) {
          color = '#8a7a60';
        } else {
          color = TERRAIN_COLORS[tile.terrain] ?? '#333';
        }

        ctx.fillStyle = color;
        ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // Subtle pixel variation for non-water tiles
        const h = cellHash(tx, ty);
        if (tile.terrain !== 'deep_water' && tile.terrain !== 'shallow_water' && tile.terrain !== 'river') {
          if (h % 7 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, 2, 2);
          } else if (h % 11 === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE + 2, 2, 2);
          }
        }
      }
    }

    // Nation labels (subtle, over terrain)
    for (const nation of NATION_CENTERS) {
      if (!nation.name) continue;

      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = LABEL_SHADOW;
      ctx.fillText(nation.name, nation.labelX + 1, nation.labelY + 1);
      ctx.fillStyle = 'rgba(232, 224, 208, 0.45)';
      ctx.fillText(nation.name, nation.labelX, nation.labelY);
    }

    // Settlement nodes
    for (const node of OVERMAP_NODES) {
      this.drawNode(ctx, node);
    }
  }

  private drawNode(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, node: typeof OVERMAP_NODES[0]): void {
    let color: string;
    let size: number;

    switch (node.type) {
      case 'hidden_village': color = HIDDEN_VILLAGE_COLOR; size = 4; break;
      case 'town': color = TOWN_COLOR; size = 2; break;
      case 'outpost': color = OUTPOST_COLOR; size = 2; break;
      case 'border_post': color = BORDER_COLOR; size = 2; break;
      default: color = TOWN_COLOR; size = 2;
    }

    // Dot outline
    ctx.fillStyle = '#1A1A2A';
    ctx.fillRect(node.x - size - 1, node.y - size - 1, size * 2 + 2, size * 2 + 2);
    // Dot fill
    ctx.fillStyle = color;
    ctx.fillRect(node.x - size, node.y - size, size * 2, size * 2);

    // Label
    const fontSize = node.type === 'hidden_village' ? 6 : 5;
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = LABEL_SHADOW;
    ctx.fillText(node.name, node.x + 1, node.y + size + fontSize + 2);
    ctx.fillStyle = node.type === 'hidden_village' ? HIDDEN_VILLAGE_COLOR : LABEL_COLOR;
    ctx.fillText(node.name, node.x, node.y + size + fontSize + 1);
  }

  /** Animated water shimmer */
  private drawWaterShimmer(): void {
    const ctx = this.ctx;
    const phase = this.waterPhase;

    for (let i = 0; i < 50; i++) {
      const bx = cellHash(i, 100) % W;
      const by = cellHash(i, 200) % H;
      const tx = Math.floor(bx / TILE_SIZE);
      const ty = Math.floor(by / TILE_SIZE);
      if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) {
        const tile = this.tileMap?.[ty * COLS + tx];
        if (tile && (tile.terrain === 'deep_water' || tile.terrain === 'shallow_water' || tile.terrain === 'river')) {
          const offset = Math.sin(phase + i * 0.7) * 2;
          ctx.fillStyle = 'rgba(120, 160, 200, 0.12)';
          ctx.fillRect(bx + offset, by, 5, 1);
        }
      }
    }
  }

  /** Draw and animate clouds */
  private drawClouds(dt: number): void {
    const ctx = this.ctx;
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x > W + cloud.width) cloud.x = -cloud.width;

      ctx.fillStyle = CLOUD_COLOR;
      const cx = Math.floor(cloud.x);
      const cy = Math.floor(cloud.y);
      ctx.fillRect(cx, cy, cloud.width, cloud.height);
      ctx.fillRect(cx + cloud.width * 0.2, cy - 4, cloud.width * 0.3, 5);
      ctx.fillRect(cx + cloud.width * 0.5, cy - 3, cloud.width * 0.25, 4);
    }
  }

  /** Draw the highlighted travel route */
  private drawTravelRoute(state: OvermapTravelState): void {
    const ctx = this.ctx;
    const path = state.path;
    if (path.length < 2) return;

    ctx.strokeStyle = 'rgba(200, 168, 78, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();

    const first = getOvermapNode(path[0]);
    if (!first) return;
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < path.length; i++) {
      const edge = getEdge(path[i - 1], path[i]);
      const node = getOvermapNode(path[i]);
      if (!node) continue;

      if (edge && edge.waypoints.length > 0) {
        const prev = getOvermapNode(path[i - 1])!;
        const allPts = [{ x: prev.x, y: prev.y }, ...edge.waypoints, { x: node.x, y: node.y }];
        for (let j = 1; j < allPts.length; j++) {
          ctx.lineTo(allPts[j].x, allPts[j].y);
        }
      } else {
        ctx.lineTo(node.x, node.y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Destination pulsing ring
    const dest = getOvermapNode(state.destination);
    if (dest) {
      const pulse = 3 + Math.sin(this.animTime * 3) * 2;
      ctx.strokeStyle = '#FF6644';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(dest.x, dest.y, pulse + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Compute the pixel position of the pawn along its current travel edge */
  private computePawnPosition(state: OvermapTravelState): { x: number; y: number } | null {
    if (state.currentEdgeIndex < 0 || state.currentEdgeIndex >= state.path.length - 1) return null;

    const fromId = state.path[state.currentEdgeIndex];
    const toId = state.path[state.currentEdgeIndex + 1];
    const fromNode = getOvermapNode(fromId);
    const toNode = getOvermapNode(toId);
    if (!fromNode || !toNode) return null;

    const edge = getEdge(fromId, toId);
    // Build the full list of points along this edge segment
    const points: Array<{ x: number; y: number }> = [{ x: fromNode.x, y: fromNode.y }];
    if (edge && edge.waypoints.length > 0) {
      // If edge is stored in reverse direction, flip waypoints
      const isReversed = edge.from === toId;
      const wps = isReversed ? [...edge.waypoints].reverse() : edge.waypoints;
      for (const wp of wps) {
        points.push({ x: wp.x, y: wp.y });
      }
    }
    points.push({ x: toNode.x, y: toNode.y });

    // Calculate cumulative segment lengths
    const segLengths: number[] = [];
    let totalLen = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      segLengths.push(len);
      totalLen += len;
    }
    if (totalLen === 0) return points[0];

    // Find which segment progressOnEdge falls into
    const targetDist = state.progressOnEdge * totalLen;
    let accumulated = 0;
    for (let i = 0; i < segLengths.length; i++) {
      if (accumulated + segLengths[i] >= targetDist || i === segLengths.length - 1) {
        const segProgress = segLengths[i] > 0 ? (targetDist - accumulated) / segLengths[i] : 0;
        const t = Math.max(0, Math.min(1, segProgress));
        return {
          x: points[i].x + (points[i + 1].x - points[i].x) * t,
          y: points[i].y + (points[i + 1].y - points[i].y) * t,
        };
      }
      accumulated += segLengths[i];
    }
    return points[points.length - 1];
  }

  /** Draw the traveler pawn */
  private drawPawn(state: OvermapTravelState): void {
    const ctx = this.ctx;
    const pos = this.computePawnPosition(state);
    if (!pos) return;

    // Walking bob
    const bobY = Math.sin(this.animTime * 4) * 1.5;
    const px = Math.floor(pos.x);
    const py = Math.floor(pos.y + bobY);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(px - 3, py + 5, 6, 2);

    // Body
    ctx.fillStyle = PAWN_OUTLINE;
    ctx.fillRect(px - 4, py - 8, 8, 14);
    ctx.fillStyle = PAWN_BODY;
    ctx.fillRect(px - 3, py - 7, 6, 12);

    // Head
    ctx.fillStyle = PAWN_OUTLINE;
    ctx.fillRect(px - 3, py - 12, 6, 6);
    ctx.fillStyle = PAWN_BODY;
    ctx.fillRect(px - 2, py - 11, 4, 4);
    // Hair
    ctx.fillStyle = PAWN_HAIR;
    ctx.fillRect(px - 2, py - 12, 4, 2);
    // Headband
    ctx.fillStyle = '#4466AA';
    ctx.fillRect(px - 3, py - 10, 6, 1);

    // Campfire at night (if stopped)
    if (state.isCamped) {
      const fireColor = CAMPFIRE_COLORS[Math.floor(this.animTime * 5) % CAMPFIRE_COLORS.length];
      ctx.fillStyle = fireColor;
      ctx.fillRect(px + 6, py, 3, 3);
      ctx.fillRect(px + 7, py - 2, 1, 2);
      // Glow
      ctx.fillStyle = 'rgba(255, 120, 0, 0.15)';
      ctx.fillRect(px, py - 6, 16, 16);
    }
  }

  /** Draw travel info HUD */
  private drawTravelInfo(state: OvermapTravelState): void {
    const ctx = this.ctx;
    const dest = getOvermapNode(state.destination);
    if (!dest) return;

    const kmLeft = Math.max(0, state.totalDistanceKm - state.distanceCoveredKm);
    const hours = kmLeft / 5; // ~5 km/h walk speed
    const hoursDisp = hours < 1 ? 'Less than 1 hour' : `~${Math.ceil(hours)} hours`;

    // Semi-transparent info box at top
    ctx.fillStyle = 'rgba(10, 10, 20, 0.7)';
    ctx.fillRect(0, 0, W, 24);

    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#C0B090';
    ctx.fillText(`Destination: ${dest.name}`, 8, 10);
    ctx.fillText(`Distance: ${kmLeft.toFixed(0)} km  |  ETA: ${hoursDisp}`, 8, 20);

    if (state.isCamped) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFA040';
      ctx.fillText('Camping for the night...', W - 8, 15);
    }
  }
}
