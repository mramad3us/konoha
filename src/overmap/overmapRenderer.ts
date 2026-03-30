/**
 * Overmap pixel art renderer — tile-based world map on canvas.
 *
 * Approach (inspired by One-Party):
 * - Each tile = 1 fillRect, 4×4 pixel scale
 * - Terrain generated from elevation/moisture noise seeded to match Naruto geography
 * - Countries defined by center-point Voronoi assignment, NOT polygon borders
 * - Biome classification from nation + elevation + moisture → terrain color
 * - Rivers as blue tile overrides
 * - Roads as lighter tile paths between nodes
 * - Settlements as colored dots
 * - No polygon outlines, no hard borders — terrain blends naturally
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
  deep_water:    '#0f2942',
  shallow_water: '#1a4a70',
  beach:         '#c8b060',
  plains:        '#4a7a2a',
  forest:        '#2a5a1a',
  dense_forest:  '#1a3a10',
  hills:         '#8a7a4a',
  mountain:      '#6a6a6a',
  peak:          '#d0d0d0',
  desert:        '#c8a848',
  arid_plains:   '#9a8a40',
  swamp:         '#3a4a20',
  tundra:        '#8a9aa0',
  snow:          '#c8d8e0',
  rocky:         '#7a6a5a',
  volcanic:      '#6a2218',
  river:         '#2a6aaa',
  road:          '#7a6a5a',
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
const CLOUD_COLOR = 'rgba(200, 200, 220, 0.12)';

// ── NATION CENTERS (pixel coords on 800×600 map) ──
// Each defines the "heart" of a nation. Tiles are assigned to the nearest center.
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
  /** Whether this is ocean or land */
  isOcean?: boolean;
}

const NATION_CENTERS: NationCenter[] = [
  // Major nations — positioned to match canonical Naruto geography
  { id: 'fire',      name: 'Land of Fire',      cx: 490, cy: 260, biome: 'temperate', elevBias: 0,   moistBias: 30,  labelX: 490, labelY: 265 },
  { id: 'wind',      name: 'Land of Wind',       cx: 270, cy: 310, biome: 'desert',    elevBias: -20, moistBias: -60, labelX: 270, labelY: 310 },
  { id: 'earth',     name: 'Land of Earth',      cx: 340, cy: 110, biome: 'rocky',     elevBias: 40,  moistBias: -10, labelX: 340, labelY: 120 },
  { id: 'lightning', name: 'Land of Lightning',   cx: 650, cy: 90,  biome: 'cold',      elevBias: 30,  moistBias: 10,  labelX: 650, labelY: 95 },
  { id: 'water',     name: 'Land of Water',       cx: 730, cy: 240, biome: 'misty',     elevBias: -10, moistBias: 50,  labelX: 720, labelY: 235 },
  // Minor nations
  { id: 'rain',      name: 'Land of Rain',        cx: 400, cy: 180, biome: 'swamp',     elevBias: -5,  moistBias: 40,  labelX: 400, labelY: 180 },
  { id: 'grass',     name: 'Land of Grass',       cx: 380, cy: 140, biome: 'temperate', elevBias: -10, moistBias: 20,  labelX: 380, labelY: 140 },
  { id: 'sound',     name: 'Land of Sound',       cx: 510, cy: 180, biome: 'temperate', elevBias: 10,  moistBias: 0,   labelX: 505, labelY: 180 },
  { id: 'tea',       name: 'Land of Tea',          cx: 610, cy: 380, biome: 'tropical',  elevBias: -15, moistBias: 20,  labelX: 610, labelY: 380 },
  { id: 'rivers',    name: 'Land of Rivers',       cx: 425, cy: 355, biome: 'swamp',     elevBias: -10, moistBias: 50,  labelX: 425, labelY: 355 },
  // Ocean zones (to fill edges)
  { id: 'ocean_nw',  name: '', cx: 80,  cy: 80,  biome: 'temperate', elevBias: 0, moistBias: 0, labelX: 0, labelY: 0, isOcean: true },
  { id: 'ocean_sw',  name: '', cx: 80,  cy: 520, biome: 'temperate', elevBias: 0, moistBias: 0, labelX: 0, labelY: 0, isOcean: true },
  { id: 'ocean_se',  name: '', cx: 700, cy: 520, biome: 'temperate', elevBias: 0, moistBias: 0, labelX: 0, labelY: 0, isOcean: true },
  { id: 'ocean_ne',  name: '', cx: 780, cy: 100, biome: 'temperate', elevBias: 0, moistBias: 0, labelX: 0, labelY: 0, isOcean: true },
  { id: 'ocean_s',   name: '', cx: 400, cy: 580, biome: 'temperate', elevBias: 0, moistBias: 0, labelX: 0, labelY: 0, isOcean: true },
  { id: 'ocean_e',   name: '', cx: 790, cy: 350, biome: 'temperate', elevBias: 0, moistBias: 0, labelX: 0, labelY: 0, isOcean: true },
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

  // Smooth interpolation
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

  // Step 1: Assign each tile to nearest nation center
  const nationMap: string[] = new Array(COLS * ROWS);
  const nationBiome: Map<string, NationCenter> = new Map();
  for (const nc of NATION_CENTERS) {
    nationBiome.set(nc.id, nc);
  }

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const px = tx * TILE_SIZE + TILE_SIZE / 2;
      const py = ty * TILE_SIZE + TILE_SIZE / 2;

      let bestDist = Infinity;
      let bestNation = 'fire';
      for (const nc of NATION_CENTERS) {
        const dx = px - nc.cx;
        const dy = py - nc.cy;
        // Add noise to distance for organic borders
        const jitter = (cellHash(tx * 7 + 13, ty * 11 + 37) % 60) - 30;
        const dist = dx * dx + dy * dy + jitter * 40;
        if (dist < bestDist) {
          bestDist = dist;
          bestNation = nc.id;
        }
      }
      nationMap[ty * COLS + tx] = bestNation;
    }
  }

  // Step 2: Generate elevation and moisture via noise
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const idx = ty * COLS + tx;
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;
      const nationId = nationMap[idx];
      const nation = nationBiome.get(nationId)!;

      if (nation.isOcean) {
        tiles[idx] = {
          terrain: 'deep_water',
          nationId,
          elevation: 10,
          moisture: 100,
          isRoad: false,
          isRiver: false,
        };
        continue;
      }

      // Base elevation from noise
      let elevation = fbmNoise(px, py, 4, 40, 42) * 255;
      elevation += nation.elevBias;

      // Edge falloff — gradually lower terrain toward map edges for ocean
      const edgeDist = Math.min(px, py, W - px, H - py);
      if (edgeDist < 80) {
        elevation -= (80 - edgeDist) * 1.5;
      }

      // Moisture from different noise seed
      let moisture = fbmNoise(px, py, 3, 50, 137) * 255;
      moisture += nation.moistBias;

      elevation = Math.max(0, Math.min(255, elevation));
      moisture = Math.max(0, Math.min(255, moisture));

      // Classify terrain
      const terrain = classifyBiome(elevation, moisture, nation.biome);

      tiles[idx] = {
        terrain,
        nationId,
        elevation,
        moisture,
        isRoad: false,
        isRiver: false,
      };
    }
  }

  // Step 3: Stamp rivers — winding blue paths through terrain
  stampRivers(tiles);

  // Step 4: Stamp roads connecting nodes
  stampRoads(tiles);

  return tiles;
}

function classifyBiome(elev: number, moist: number, nationBiome: string): string {
  // Water at very low elevations
  if (elev < 35) return 'deep_water';
  if (elev < 50) return 'shallow_water';
  if (elev < 58) return 'beach';

  // Mountain at very high elevations
  if (elev > 220) return 'peak';
  if (elev > 190) return 'mountain';
  if (elev > 165) return 'hills';

  // Nation-specific biomes for mid elevations
  switch (nationBiome) {
    case 'desert':
      if (moist < 60) return 'desert';
      if (moist < 100) return 'arid_plains';
      return 'plains';

    case 'rocky':
      if (elev > 140) return 'rocky';
      if (moist > 150) return 'forest';
      return 'hills';

    case 'cold':
      if (elev > 140) return 'snow';
      if (moist > 120) return 'tundra';
      return 'hills';

    case 'misty':
      if (moist > 160) return 'dense_forest';
      if (moist > 100) return 'forest';
      return 'plains';

    case 'swamp':
      if (moist > 160) return 'swamp';
      if (moist > 100) return 'dense_forest';
      return 'forest';

    case 'tropical':
      if (moist > 140) return 'dense_forest';
      if (moist > 80) return 'forest';
      return 'plains';

    case 'volcanic':
      if (elev > 150) return 'volcanic';
      return 'rocky';

    default: // temperate
      if (moist > 170) return 'dense_forest';
      if (moist > 120) return 'forest';
      if (moist > 60) return 'plains';
      return 'arid_plains';
  }
}

/** Stamp winding river paths through the terrain */
function stampRivers(tiles: MapTile[]): void {
  // River seeds — start from mountain areas, flow toward low elevation
  const riverStarts = [
    { tx: 85, ty: 25 },  // From Earth mountains
    { tx: 105, ty: 50 }, // Through Fire
    { tx: 160, ty: 20 }, // From Lightning mountains
    { tx: 70, ty: 70 },  // Through Grass/Rain
  ];

  for (const start of riverStarts) {
    let tx = start.tx;
    let ty = start.ty;

    for (let step = 0; step < 80; step++) {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) break;
      const idx = ty * COLS + tx;
      if (!tiles[idx]) break;

      const terrain = tiles[idx].terrain;
      if (terrain === 'deep_water' || terrain === 'shallow_water') break;

      tiles[idx].isRiver = true;
      tiles[idx].terrain = 'river';

      // Flow toward lowest neighbor with some randomness
      let bestTx = tx;
      let bestTy = ty + 1; // default: flow south
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

    // Build pixel point path
    const points = [
      { x: from.x, y: from.y },
      ...edge.waypoints,
      { x: to.x, y: to.y },
    ];

    // Rasterize road along point segments
    for (let i = 0; i < points.length - 1; i++) {
      const ax = points[i].x;
      const ay = points[i].y;
      const bx = points[i + 1].x;
      const by = points[i + 1].y;
      const dist = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
      const steps = Math.ceil(dist / 2); // step every 2px

      for (let s = 0; s <= steps; s++) {
        const t = s / Math.max(1, steps);
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) continue;
        const idx = ty * COLS + tx;
        if (!tiles[idx]) continue;
        // Don't overwrite water
        if (tiles[idx].terrain === 'deep_water' || tiles[idx].terrain === 'shallow_water') continue;
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
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: cellHash(i, 0) % W,
        y: 30 + (cellHash(i, 1) % (H - 100)),
        width: 40 + (cellHash(i, 2) % 60),
        height: 12 + (cellHash(i, 3) % 16),
        speed: 2 + (cellHash(i, 4) % 6),
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

    // Draw each tile as a colored rect
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const tile = tiles[ty * COLS + tx];
        if (!tile) continue;

        let color: string;
        if (tile.isRoad && !tile.isRiver) {
          // Road tiles: lighter brown path
          color = '#8a7a60';
        } else {
          color = TERRAIN_COLORS[tile.terrain] ?? '#333';
        }

        ctx.fillStyle = color;
        ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // Pixel variation — subtle lighter/darker speckling within each tile
        const h = cellHash(tx, ty);
        if (tile.terrain !== 'deep_water' && tile.terrain !== 'shallow_water' && tile.terrain !== 'river') {
          if (h % 7 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, 2, 2);
          } else if (h % 11 === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.fillRect(tx * TILE_SIZE + 2, ty * TILE_SIZE + 2, 2, 2);
          }
        }
      }
    }

    // Draw nation labels (text over terrain, no borders)
    for (const nation of NATION_CENTERS) {
      if (!nation.name || nation.isOcean) continue;

      ctx.font = '7px monospace';
      ctx.textAlign = 'center';

      // Shadow
      ctx.fillStyle = LABEL_SHADOW;
      ctx.fillText(nation.name, nation.labelX + 1, nation.labelY + 1);
      // Text
      ctx.fillStyle = 'rgba(232, 224, 208, 0.5)';
      ctx.fillText(nation.name, nation.labelX, nation.labelY);
    }

    // Draw settlement nodes
    for (const node of OVERMAP_NODES) {
      this.drawNode(ctx, node);
    }
  }

  /** Draw a settlement node as a colored dot with label */
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

  /** Animated water shimmer on ocean and river tiles */
  private drawWaterShimmer(): void {
    const ctx = this.ctx;
    const phase = this.waterPhase;

    for (let i = 0; i < 40; i++) {
      const bx = cellHash(i, 100) % W;
      const by = cellHash(i, 200) % H;
      // Only shimmer on water tiles
      const tx = Math.floor(bx / TILE_SIZE);
      const ty = Math.floor(by / TILE_SIZE);
      if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) {
        const tile = this.tileMap?.[ty * COLS + tx];
        if (tile && (tile.terrain === 'deep_water' || tile.terrain === 'shallow_water' || tile.terrain === 'river')) {
          const offset = Math.sin(phase + i * 0.7) * 2;
          ctx.fillStyle = 'rgba(120, 160, 200, 0.15)';
          ctx.fillRect(bx + offset, by, 6, 1);
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
      ctx.fillRect(cx + cloud.width * 0.2, cy - 4, cloud.width * 0.3, 6);
      ctx.fillRect(cx + cloud.width * 0.5, cy - 3, cloud.width * 0.25, 5);
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
      ctx.arc(dest.x, dest.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Draw the chibi pawn at current travel position */
  private drawPawn(state: OvermapTravelState): void {
    const ctx = this.ctx;
    const pos = this.getPawnPosition(state);
    if (!pos) return;

    const px = Math.floor(pos.x);
    const py = Math.floor(pos.y);

    if (state.isCamped) {
      // Campfire
      this.drawCampfire(px, py + 4);
      // Sleeping pawn
      ctx.fillStyle = PAWN_OUTLINE;
      ctx.fillRect(px - 5, py - 1, 10, 4);
      ctx.fillStyle = PAWN_BODY;
      ctx.fillRect(px - 4, py, 8, 2);
      ctx.fillStyle = PAWN_HAIR;
      ctx.fillRect(px - 4, py, 2, 2);
    } else {
      // Walking pawn
      const bobY = Math.floor(Math.sin(this.animTime * 6) * 1);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(px - 2, py + 5, 5, 2);
      // Body outline
      ctx.fillStyle = PAWN_OUTLINE;
      ctx.fillRect(px - 3, py - 7 + bobY, 7, 12);
      // Body
      ctx.fillStyle = PAWN_BODY;
      ctx.fillRect(px - 2, py - 6 + bobY, 5, 10);
      // Hair
      ctx.fillStyle = PAWN_HAIR;
      ctx.fillRect(px - 2, py - 6 + bobY, 5, 3);
      // Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(px - 1, py - 3 + bobY, 1, 1);
      ctx.fillRect(px + 1, py - 3 + bobY, 1, 1);
      // Headband
      ctx.fillStyle = '#3366AA';
      ctx.fillRect(px - 2, py - 4 + bobY, 5, 1);

      // Walking legs
      const legPhase = Math.floor(this.animTime * 4) % 2;
      ctx.fillStyle = PAWN_OUTLINE;
      if (legPhase === 0) {
        ctx.fillRect(px - 1, py + 4 + bobY, 1, 2);
        ctx.fillRect(px + 1, py + 3 + bobY, 1, 2);
      } else {
        ctx.fillRect(px - 1, py + 3 + bobY, 1, 2);
        ctx.fillRect(px + 1, py + 4 + bobY, 1, 2);
      }
    }
  }

  /** Draw a small animated campfire */
  private drawCampfire(x: number, y: number): void {
    const ctx = this.ctx;
    const frame = Math.floor(this.animTime * 8) % 4;

    // Fire glow
    ctx.fillStyle = 'rgba(255, 120, 20, 0.15)';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Logs
    ctx.fillStyle = '#5A3A1A';
    ctx.fillRect(x - 3, y + 1, 6, 2);
    ctx.fillRect(x - 2, y + 2, 4, 1);

    // Flame
    ctx.fillStyle = CAMPFIRE_COLORS[frame];
    ctx.fillRect(x - 1, y - 2, 3, 3);
    ctx.fillStyle = CAMPFIRE_COLORS[(frame + 1) % 4];
    ctx.fillRect(x, y - 4, 1, 2);

    // Sparks
    if (frame % 2 === 0) {
      ctx.fillStyle = '#FFCC00';
      const sparkY = y - 5 - (cellHash(frame, Math.floor(this.animTime)) % 3);
      ctx.fillRect(x + (frame % 3) - 1, sparkY, 1, 1);
    }
  }

  /** Calculate pawn pixel position along travel route */
  private getPawnPosition(state: OvermapTravelState): { x: number; y: number } | null {
    const path = state.path;
    if (path.length < 2) {
      const node = getOvermapNode(path[0] ?? state.origin);
      return node ? { x: node.x, y: node.y } : null;
    }

    const edgeIdx = Math.min(state.currentEdgeIndex, path.length - 2);
    const fromNode = getOvermapNode(path[edgeIdx]);
    const toNode = getOvermapNode(path[edgeIdx + 1]);
    if (!fromNode || !toNode) return null;

    const edge = getEdge(path[edgeIdx], path[edgeIdx + 1]);
    const t = state.progressOnEdge;

    const allPts = [
      { x: fromNode.x, y: fromNode.y },
      ...(edge?.waypoints ?? []),
      { x: toNode.x, y: toNode.y },
    ];

    // Interpolate along segments
    const totalLen = allPts.reduce((sum, pt, i) => {
      if (i === 0) return 0;
      const dx = pt.x - allPts[i - 1].x;
      const dy = pt.y - allPts[i - 1].y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0);

    const targetDist = t * totalLen;
    let accumulated = 0;

    for (let i = 1; i < allPts.length; i++) {
      const dx = allPts[i].x - allPts[i - 1].x;
      const dy = allPts[i].y - allPts[i - 1].y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (accumulated + segLen >= targetDist || i === allPts.length - 1) {
        const segT = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
        return {
          x: allPts[i - 1].x + dx * Math.min(1, segT),
          y: allPts[i - 1].y + dy * Math.min(1, segT),
        };
      }
      accumulated += segLen;
    }

    return { x: toNode.x, y: toNode.y };
  }

  /** Draw travel HUD overlay */
  private drawTravelInfo(state: OvermapTravelState): void {
    const ctx = this.ctx;

    // Bottom bar
    ctx.fillStyle = 'rgba(10, 10, 20, 0.7)';
    ctx.fillRect(0, H - 40, W, 40);

    ctx.font = '8px monospace';
    ctx.textAlign = 'left';

    const dest = getOvermapNode(state.destination);
    const destName = dest?.name ?? 'Unknown';
    const remaining = Math.max(0, state.totalDistanceKm - state.distanceCoveredKm);

    ctx.fillStyle = '#C0B090';
    ctx.fillText(`Destination: ${destName}`, 8, H - 26);
    ctx.fillText(`Distance: ${remaining.toFixed(0)} km remaining`, 8, H - 14);

    if (state.isCamped) {
      ctx.fillStyle = '#FFAA44';
      ctx.textAlign = 'right';
      ctx.fillText('Making camp for the night...', W - 8, H - 20);
    } else {
      const hoursLeft = remaining / state.travelSpeedKmPerHour;
      ctx.fillStyle = '#90A090';
      ctx.textAlign = 'right';
      ctx.fillText(`~${hoursLeft.toFixed(1)} hours remaining`, W - 8, H - 20);
    }

    // Top bar
    ctx.fillStyle = 'rgba(10, 10, 20, 0.5)';
    ctx.fillRect(0, 0, W, 20);
    ctx.fillStyle = '#C0B090';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    const orig = getOvermapNode(state.origin);
    ctx.fillText(`${orig?.name ?? 'Unknown'} → ${destName}`, W / 2, 13);
  }

  /** Force re-render of background */
  invalidateBackground(): void {
    this.bgRendered = false;
    this.tileMap = null;
  }

  dispose(): void {
    // Nothing to clean up
  }
}
