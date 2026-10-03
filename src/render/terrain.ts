/**
 * Terrain chunk cache: 16×16-tile chunks rasterized once into canvases (with edge blending and
 * diorama-style cliff sides at the map border), redrawn only when the level marks them dirty.
 */

import type { Level } from '../ecs/level.ts';
import { Pix } from '../art/pix.ts';
import { tilePixel } from '../art/terrain.ts';
import { T } from '../world/tiles.ts';
import { CHUNK, TILE_W, TILE_H } from '../core/config.ts';
import { hash2 } from '../core/rng.ts';
import { hex, shade } from '../art/color.ts';

export interface Chunk { cv: OffscreenCanvas; x: number; y: number }

const HALF_W = TILE_W / 2, HALF_H = TILE_H / 2;
const SIDE = 10;
const EARTH = [hex('#5a4030'), hex('#4a3428'), hex('#3a2a22')];

export class TerrainCache {
  private chunks = new Map<number, Chunk>();
  private level: Level | null = null;

  bind(level: Level): void {
    if (this.level !== level) {
      this.chunks.clear();
      this.level = level;
    }
  }

  /** Chunks overlapping the given world-pixel rectangle. */
  visible(minX: number, minY: number, maxX: number, maxY: number): Chunk[] {
    const lv = this.level!;
    for (const k of lv.dirtyChunks) this.chunks.delete(k);
    lv.dirtyChunks.clear();
    const cw = Math.ceil(lv.width / CHUNK), ch = Math.ceil(lv.height / CHUNK);
    const out: Chunk[] = [];
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      const b = bounds(cx, cy);
      if (b.x1 < minX || b.x0 > maxX || b.y1 < minY || b.y0 > maxY) continue;
      const key = cy * cw + cx;
      let c = this.chunks.get(key);
      if (!c) { c = this.build(cx, cy); this.chunks.set(key, c); }
      out.push(c);
    }
    return out;
  }

  private build(cx: number, cy: number): Chunk {
    const lv = this.level!;
    const b = bounds(cx, cy);
    const pix = new Pix(b.x1 - b.x0, b.y1 - b.y0);
    const nb = (x: number, y: number) => (lv.inBounds(x, y) ? lv.tile(x, y) : T.void);
    for (let ty = cy * CHUNK; ty < Math.min(lv.height, (cy + 1) * CHUNK); ty++) {
      for (let tx = cx * CHUNK; tx < Math.min(lv.width, (cx + 1) * CHUNK); tx++) {
        const t = lv.tile(tx, ty);
        if (t === T.void) continue;
        const sx = (tx - ty) * HALF_W - HALF_W - b.x0;
        const sy = (tx + ty) * HALF_H - HALF_H - b.y0;
        for (let py = 0; py < TILE_H; py++) {
          const half = py < HALF_H ? 2 + py * 2 : 2 + (TILE_H - 1 - py) * 2;
          for (let px = HALF_W - half; px < HALF_W + half; px++) {
            const dx = px - HALF_W + 0.5, dy = py - HALF_H + 0.5;
            const gx = (dx / HALF_W + dy / HALF_H) / 2, gy = (dy / HALF_H - dx / HALF_W) / 2;
            const wx = sx + px + b.x0, wy = sy + py + b.y0;
            const c = tilePixel(t, gx, gy, tx + gx + 0.5, ty + gy + 0.5, wx, wy, (ddx, ddy) => {
              const n = nb(tx + ddx, ty + ddy);
              return n === T.void ? t : n;
            });
            pix.set(sx + px, sy + py, c);
          }
        }
        // Diorama sides where the map ends.
        if (nb(tx + 1, ty) === T.void) side(pix, sx, sy, true, tx, ty);
        if (nb(tx, ty + 1) === T.void) side(pix, sx, sy, false, tx, ty);
      }
    }
    return { cv: pix.toCanvas(), x: b.x0, y: b.y0 };
  }
}

function side(pix: Pix, sx: number, sy: number, east: boolean, tx: number, ty: number): void {
  // East side hangs under the lower-right edge, south side under the lower-left edge.
  for (let k = 0; k < HALF_W; k++) {
    const x = east ? sx + HALF_W + k : sx + k;
    const topY = east ? sy + TILE_H - 1 - Math.floor(k / 2) : sy + HALF_H + Math.floor(k / 2);
    for (let d = 1; d <= SIDE; d++) {
      const band = d < 3 ? 0 : d < 7 ? 1 : 2;
      let c = EARTH[band];
      if (hash2(x + tx * 3, topY + d + ty) % 7 === 0) c = shade(c, -0.15);
      if (!east) c = shade(c, 0.1);
      pix.set(x, topY + d, c);
    }
  }
}

function bounds(cx: number, cy: number) {
  const x0 = cx * CHUNK, y0 = cy * CHUNK, x1 = x0 + CHUNK - 1, y1 = y0 + CHUNK - 1;
  return {
    x0: (x0 - y1) * HALF_W - HALF_W,
    x1: (x1 - y0) * HALF_W + HALF_W,
    y0: (x0 + y0) * HALF_H - HALF_H,
    y1: (x1 + y1) * HALF_H + HALF_H + SIDE + 2,
  };
}
