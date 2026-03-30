/**
 * Overmap pixel art renderer — draws the world map on a canvas.
 * Low-detail tile-based rendering with animations for travel.
 *
 * Features:
 * - Colored terrain regions (Land of Fire, Wind, etc.)
 * - Road lines connecting towns
 * - Town/village dots with labels
 * - Animated chibi pawn moving along roads
 * - Campfire animation at night
 * - Clouds drifting across the map
 * - Water shimmer on ocean areas
 */

import { OVERMAP_CANVAS_WIDTH, OVERMAP_CANVAS_HEIGHT } from '../core/constants.ts';
import { OVERMAP_REGIONS, OVERMAP_NODES, OVERMAP_EDGES, getOvermapNode, getEdge } from './overmapData.ts';
import type { OvermapTravelState } from '../types/overmap.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';

const W = OVERMAP_CANVAS_WIDTH;
const H = OVERMAP_CANVAS_HEIGHT;

// ── COLORS ──
const OCEAN_COLOR = '#2A3A5C';
const OCEAN_HIGHLIGHT = '#3A4A6C';
const ROAD_COLOR = '#7A6A5A';
const ROAD_HIGHLIGHT = '#9A8A7A';
const LABEL_COLOR = '#E8E0D0';
const LABEL_SHADOW = '#1A1A2A';
const HIDDEN_VILLAGE_COLOR = '#FFD700';
const TOWN_COLOR = '#C0C0C0';
const OUTPOST_COLOR = '#8A7A6A';
const BORDER_COLOR = '#6A8A6A';
const CAMPFIRE_COLORS = ['#FF6600', '#FF9933', '#FFCC00', '#FF4400'];
const CLOUD_COLOR = 'rgba(200, 200, 220, 0.15)';
const PAWN_BODY = '#E8C080';
const PAWN_HAIR = '#2A2A3A';
const PAWN_OUTLINE = '#1A1A2A';

/** Cloud state for animation */
interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export class OvermapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** Pre-rendered static background (terrain + roads + labels) */
  private bgCanvas: OffscreenCanvas;
  private bgCtx: OffscreenCanvasRenderingContext2D;
  private bgRendered = false;

  // Animation state
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
        x: (cellHash(i, 0) % W),
        y: 30 + (cellHash(i, 1) % (H - 100)),
        width: 40 + (cellHash(i, 2) % 60),
        height: 12 + (cellHash(i, 3) % 16),
        speed: 2 + (cellHash(i, 4) % 6),
      });
    }
  }

  /** Render one frame of the overmap */
  draw(travelState: OvermapTravelState | null, dt: number, isNight: boolean): void {
    this.animTime += dt;
    this.waterPhase += dt * 0.5;

    // Render static background once
    if (!this.bgRendered) {
      this.renderBackground();
      this.bgRendered = true;
    }

    // Blit background
    this.ctx.drawImage(this.bgCanvas, 0, 0);

    // Animated water shimmer
    this.drawWaterShimmer();

    // Draw clouds
    this.drawClouds(dt);

    // Draw travel route highlight if traveling
    if (travelState) {
      this.drawTravelRoute(travelState);
      this.drawPawn(travelState, isNight);
    }

    // Night overlay
    if (isNight) {
      this.ctx.fillStyle = 'rgba(10, 10, 30, 0.4)';
      this.ctx.fillRect(0, 0, W, H);
    }

    // Draw HUD overlay (distance, time)
    if (travelState) {
      this.drawTravelInfo(travelState, isNight);
    }
  }

  /** Render static elements to background canvas */
  private renderBackground(): void {
    const ctx = this.bgCtx;

    // Ocean fill
    ctx.fillStyle = OCEAN_COLOR;
    ctx.fillRect(0, 0, W, H);

    // Pixel-art ocean texture (scattered highlights)
    for (let x = 0; x < W; x += 4) {
      for (let y = 0; y < H; y += 4) {
        if (cellHash(x, y) % 12 === 0) {
          ctx.fillStyle = OCEAN_HIGHLIGHT;
          ctx.fillRect(x, y, 2, 1);
        }
      }
    }

    // Draw terrain regions
    for (const region of OVERMAP_REGIONS) {
      this.drawRegion(ctx, region);
    }

    // Draw roads
    for (const edge of OVERMAP_EDGES) {
      this.drawRoad(ctx, edge);
    }

    // Draw nodes (towns, villages)
    for (const node of OVERMAP_NODES) {
      this.drawNode(ctx, node);
    }
  }

  /** Draw a terrain region as a filled polygon with pixel-art texture */
  private drawRegion(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, region: typeof OVERMAP_REGIONS[0]): void {
    if (region.points.length < 3) return;

    // Fill polygon
    ctx.beginPath();
    ctx.moveTo(region.points[0].x, region.points[0].y);
    for (let i = 1; i < region.points.length; i++) {
      ctx.lineTo(region.points[i].x, region.points[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = region.color;
    ctx.fill();

    // Pixel texture overlay (noise within region)
    ctx.save();
    ctx.clip();
    const minX = Math.min(...region.points.map(p => p.x));
    const maxX = Math.max(...region.points.map(p => p.x));
    const minY = Math.min(...region.points.map(p => p.y));
    const maxY = Math.max(...region.points.map(p => p.y));

    for (let x = minX; x < maxX; x += 3) {
      for (let y = minY; y < maxY; y += 3) {
        const h = cellHash(x, y);
        if (h % 5 === 0) {
          // Lighter speckle
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(x, y, 2, 2);
        } else if (h % 7 === 0) {
          // Darker speckle
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    // Region border (1px darker line)
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(region.points[0].x, region.points[0].y);
    for (let i = 1; i < region.points.length; i++) {
      ctx.lineTo(region.points[i].x, region.points[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = LABEL_SHADOW;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(region.name, region.labelX + 1, region.labelY + 1);
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(region.name, region.labelX, region.labelY);
  }

  /** Draw a road as a dashed pixel line between two nodes */
  private drawRoad(ctx: OffscreenCanvasRenderingContext2D, edge: typeof OVERMAP_EDGES[0]): void {
    const from = getOvermapNode(edge.from);
    const to = getOvermapNode(edge.to);
    if (!from || !to) return;

    // Build point list: from → waypoints → to
    const points = [{ x: from.x, y: from.y }, ...edge.waypoints, { x: to.x, y: to.y }];

    ctx.strokeStyle = ROAD_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Draw a node (town dot + label) */
  private drawNode(ctx: OffscreenCanvasRenderingContext2D, node: typeof OVERMAP_NODES[0]): void {
    let color: string;
    let size: number;

    switch (node.type) {
      case 'hidden_village':
        color = HIDDEN_VILLAGE_COLOR;
        size = 4;
        break;
      case 'town':
        color = TOWN_COLOR;
        size = 2;
        break;
      case 'outpost':
        color = OUTPOST_COLOR;
        size = 2;
        break;
      case 'border_post':
        color = BORDER_COLOR;
        size = 2;
        break;
      default:
        color = TOWN_COLOR;
        size = 2;
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

  /** Draw animated water shimmer on ocean */
  private drawWaterShimmer(): void {
    const ctx = this.ctx;
    const phase = this.waterPhase;

    for (let i = 0; i < 30; i++) {
      const bx = cellHash(i, 100) % W;
      const by = cellHash(i, 200) % H;
      const offset = Math.sin(phase + i * 0.7) * 2;
      ctx.fillStyle = 'rgba(120, 160, 200, 0.12)';
      ctx.fillRect(bx + offset, by, 6, 1);
    }
  }

  /** Draw and animate clouds */
  private drawClouds(dt: number): void {
    const ctx = this.ctx;
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x > W + cloud.width) cloud.x = -cloud.width;

      // Draw cloud as a collection of pixel rectangles
      ctx.fillStyle = CLOUD_COLOR;
      const cx = Math.floor(cloud.x);
      const cy = Math.floor(cloud.y);
      // Main body
      ctx.fillRect(cx, cy, cloud.width, cloud.height);
      // Top bumps
      ctx.fillRect(cx + cloud.width * 0.2, cy - 4, cloud.width * 0.3, 6);
      ctx.fillRect(cx + cloud.width * 0.5, cy - 3, cloud.width * 0.25, 5);
    }
  }

  /** Draw the travel route highlighted */
  private drawTravelRoute(state: OvermapTravelState): void {
    const ctx = this.ctx;
    const path = state.path;
    if (path.length < 2) return;

    // Draw highlighted route
    ctx.strokeStyle = ROAD_HIGHLIGHT;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();

    const first = getOvermapNode(path[0]);
    if (!first) return;
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < path.length; i++) {
      const edge = getEdge(path[i - 1], path[i]);
      const node = getOvermapNode(path[i]);
      if (!node) continue;

      if (edge && edge.waypoints.length > 0) {
        // Draw through waypoints
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

    // Destination marker (pulsing ring)
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
  private drawPawn(state: OvermapTravelState, _isNight: boolean): void {
    const ctx = this.ctx;
    const pos = this.getPawnPosition(state);
    if (!pos) return;

    const px = Math.floor(pos.x);
    const py = Math.floor(pos.y);

    if (state.isCamped) {
      // Draw campfire
      this.drawCampfire(px, py + 4);
      // Draw sleeping pawn (horizontal)
      ctx.fillStyle = PAWN_OUTLINE;
      ctx.fillRect(px - 5, py - 1, 10, 4);
      ctx.fillStyle = PAWN_BODY;
      ctx.fillRect(px - 4, py, 8, 2);
      ctx.fillStyle = PAWN_HAIR;
      ctx.fillRect(px - 4, py, 2, 2);
    } else {
      // Walking pawn (vertical chibi)
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

      // Walking legs animation
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

  /** Calculate the pixel position of the pawn along the travel route */
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

    // Build segment points including waypoints
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

  /** Draw travel info overlay (distance, ETA) */
  private drawTravelInfo(state: OvermapTravelState, _isNight: boolean): void {
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

    // Top bar - origin
    ctx.fillStyle = 'rgba(10, 10, 20, 0.5)';
    ctx.fillRect(0, 0, W, 20);
    ctx.fillStyle = '#C0B090';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    const orig = getOvermapNode(state.origin);
    ctx.fillText(`${orig?.name ?? 'Unknown'} → ${destName}`, W / 2, 13);
  }

  /** Force re-render of static background */
  invalidateBackground(): void {
    this.bgRendered = false;
  }

  dispose(): void {
    // Nothing to clean up
  }
}
