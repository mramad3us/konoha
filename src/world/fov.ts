/**
 * Symmetric shadowcasting (Albert Ford). If A sees B, B sees A. Walls are visible.
 * Generic over an opacity test so the sim (perception) and the player's FOV share it.
 */

import type { Level } from '../ecs/level.ts';

type Opaque = (x: number, y: number) => boolean;
type Mark = (x: number, y: number) => void;

interface Row { depth: number; start: number; end: number }

const QUADRANTS: Array<(ox: number, oy: number, row: number, col: number) => [number, number]> = [
  (ox, oy, r, c) => [ox + c, oy - r], // north
  (ox, oy, r, c) => [ox + r, oy + c], // east
  (ox, oy, r, c) => [ox + c, oy + r], // south
  (ox, oy, r, c) => [ox - r, oy + c], // west
];

function roundTiesUp(n: number): number { return Math.floor(n + 0.5); }
function roundTiesDown(n: number): number { return Math.ceil(n - 0.5); }

export function shadowcast(ox: number, oy: number, radius: number, opaque: Opaque, mark: Mark): void {
  mark(ox, oy);
  const r2 = (radius + 0.5) * (radius + 0.5);
  for (const transform of QUADRANTS) {
    const stack: Row[] = [{ depth: 1, start: -1, end: 1 }];
    while (stack.length) {
      const row = stack.pop()!;
      if (row.depth > radius) continue;
      let prevWall: boolean | null = null;
      const minCol = roundTiesUp(row.depth * row.start);
      const maxCol = roundTiesDown(row.depth * row.end);
      let start = row.start;
      for (let col = minCol; col <= maxCol; col++) {
        const [x, y] = transform(ox, oy, row.depth, col);
        const wall = opaque(x, y);
        const inRadius = row.depth * row.depth + col * col <= r2;
        const symmetric = col >= row.depth * start && col <= row.depth * row.end;
        if (inRadius && (wall || symmetric)) mark(x, y);
        if (prevWall === true && !wall) start = (2 * col - 1) / (2 * row.depth);
        if (prevWall === false && wall) {
          stack.push({ depth: row.depth + 1, start, end: (2 * col - 1) / (2 * row.depth) });
        }
        prevWall = wall;
      }
      if (prevWall === false) stack.push({ depth: row.depth + 1, start, end: row.end });
    }
  }
}

/** Recompute the player's visible set on a level; explored only grows. */
export function computePlayerFov(level: Level, ox: number, oy: number, radius: number): void {
  level.visible.fill(0);
  const w = level.width;
  shadowcast(ox, oy, radius, (x, y) => level.isOpaque(x, y), (x, y) => {
    if (!level.inBounds(x, y)) return;
    const i = y * w + x;
    level.visible[i] = 1;
    level.explored[i] = 1;
  });
}

/** Line-of-sight between two cells (Bresenham, endpoints excluded from opacity test). */
export function hasLos(level: Level, x0: number, y0: number, x1: number, y1: number): boolean {
  let x = x0, y = y0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0) && level.isOpaque(x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
