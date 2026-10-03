/**
 * Grid geometry. The map is a square grid (8-way movement) displayed isometrically:
 * screen x ∝ (x − y), screen y ∝ (x + y).
 */

export interface Vec { x: number; y: number }

/** Grid directions, named by compass on the *grid* (north = −y). */
export type Dir8 = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const DIRS: readonly Dir8[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export const DIR_VEC: Record<Dir8, Vec> = {
  n: { x: 0, y: -1 }, ne: { x: 1, y: -1 }, e: { x: 1, y: 0 }, se: { x: 1, y: 1 },
  s: { x: 0, y: 1 }, sw: { x: -1, y: 1 }, w: { x: -1, y: 0 }, nw: { x: -1, y: -1 },
};

export function dirFromDelta(dx: number, dy: number): Dir8 | null {
  const sx = Math.sign(dx), sy = Math.sign(dy);
  for (const d of DIRS) {
    const v = DIR_VEC[d];
    if (v.x === sx && v.y === sy) return d;
  }
  return null;
}

/** Direction from a to b (sign of delta). Returns null if same tile. */
export function dirTo(a: Vec, b: Vec): Dir8 | null {
  return dirFromDelta(b.x - a.x, b.y - a.y);
}

export function chebyshev(a: Vec, b: Vec): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function euclid(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isAdjacent(a: Vec, b: Vec): boolean {
  return chebyshev(a, b) === 1;
}

/** Angle (radians) of a grid direction measured in grid space. */
export function dirAngle(d: Dir8): number {
  const v = DIR_VEC[d];
  return Math.atan2(v.y, v.x);
}

/** Smallest absolute difference between two angles. */
export function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

export function opposite(d: Dir8): Dir8 {
  return DIRS[(DIRS.indexOf(d) + 4) % 8];
}

/**
 * Screen-relative movement → grid delta. "up" on screen is grid north-west.
 * Keys: screen directions as the player sees them.
 */
export type ScreenDir = 'up' | 'down' | 'left' | 'right' | 'upleft' | 'upright' | 'downleft' | 'downright';

export const SCREEN_TO_GRID: Record<ScreenDir, Vec> = {
  up: { x: -1, y: -1 },
  down: { x: 1, y: 1 },
  left: { x: -1, y: 1 },
  right: { x: 1, y: -1 },
  upleft: { x: -1, y: 0 },
  upright: { x: 0, y: -1 },
  downleft: { x: 0, y: 1 },
  downright: { x: 1, y: 0 },
};

/** Which way a sprite should face on screen for a grid facing: front/back and mirrored or not. */
export function screenFacing(d: Dir8): { back: boolean; flip: boolean } {
  const v = DIR_VEC[d];
  const sx = v.x - v.y;   // screen dx sign
  const sy = v.x + v.y;   // screen dy sign
  // Base art faces screen-left. Flip when looking right.
  return { back: sy < 0, flip: sx > 0 };
}

/** Bresenham line from a to b inclusive. */
export function line(a: Vec, b: Vec): Vec[] {
  const pts: Vec[] = [];
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - a.x), dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return pts;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
