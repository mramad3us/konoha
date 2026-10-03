/**
 * A* pathfinding on the 8-way grid. Diagonals may not squeeze between two solid cells.
 */

import type { Level } from '../ecs/level.ts';
import type { Vec } from '../core/geometry.ts';
import type { EntityId } from '../ecs/components.ts';

export interface PathOptions {
  /** Entities that block the way are treated as walls (except the goal cell). Default true. */
  avoidActors?: boolean;
  /** Entity doing the walking (ignored when checking blockers). */
  self?: EntityId;
  /** Max nodes to expand. */
  limit?: number;
  /** Stop when within this Chebyshev distance of the goal (0 = reach it). */
  near?: number;
  /** Allow deep water cells (swimmers, water walkers). */
  water?: boolean;
}

/** Terrain allows a step from a to b (adjacent). Ignores entities. */
export function terrainStep(level: Level, ax: number, ay: number, bx: number, by: number, water = false): boolean {
  const ok = (x: number, y: number) => level.isPassable(x, y) || (water && level.isSwimmable(x, y));
  if (!ok(bx, by)) return false;
  if (ax !== bx && ay !== by) {
    if (!ok(bx, ay) && !ok(ax, by)) return false;
  }
  return true;
}

export function findPath(level: Level, from: Vec, to: Vec, opts: PathOptions = {}): Vec[] | null {
  const { avoidActors = true, self, limit = 4000, near = 0, water = false } = opts;
  const w = level.width;
  if (!level.inBounds(to.x, to.y)) return null;
  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  if (start === goal) return [];

  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const open = new MinHeap();
  g.set(start, 0);
  open.push(start, h(from.x, from.y, to));
  let expanded = 0;

  const blocked = (x: number, y: number): boolean => {
    if (!avoidActors) return false;
    const b = level.blockerAt(x, y);
    return b !== null && b !== self;
  };

  while (open.size) {
    const cur = open.pop();
    const cx = cur % w, cy = (cur - cx) / w;
    if (cur === goal || (near > 0 && Math.max(Math.abs(cx - to.x), Math.abs(cy - to.y)) <= near)) {
      return reconstruct(came, cur, start, w);
    }
    if (++expanded > limit) break;
    const gc = g.get(cur)!;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!terrainStep(level, cx, cy, nx, ny, water)) continue;
        const ni = ny * w + nx;
        if (ni !== goal && blocked(nx, ny)) continue;
        const cost = gc + (dx && dy ? 1.001 : 1);
        const prev = g.get(ni);
        if (prev !== undefined && prev <= cost) continue;
        g.set(ni, cost);
        came.set(ni, cur);
        open.push(ni, cost + h(nx, ny, to));
      }
    }
  }
  return null;
}

function h(x: number, y: number, to: Vec): number {
  return Math.max(Math.abs(x - to.x), Math.abs(y - to.y));
}

function reconstruct(came: Map<number, number>, end: number, start: number, w: number): Vec[] {
  const out: Vec[] = [];
  let cur = end;
  while (cur !== start) {
    out.push({ x: cur % w, y: Math.floor(cur / w) });
    const p = came.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  return out.reverse();
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size(): number { return this.ids.length; }
  push(id: number, key: number): void {
    const ids = this.ids, keys = this.keys;
    ids.push(id); keys.push(key);
    let i = ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= keys[i]) break;
      [ids[p], ids[i]] = [ids[i], ids[p]];
      [keys[p], keys[i]] = [keys[i], keys[p]];
      i = p;
    }
  }
  pop(): number {
    const ids = this.ids, keys = this.keys;
    const top = ids[0];
    const lastId = ids.pop()!, lastKey = keys.pop()!;
    if (ids.length) {
      ids[0] = lastId; keys[0] = lastKey;
      let i = 0;
      const n = ids.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < n && keys[l] < keys[m]) m = l;
        if (r < n && keys[r] < keys[m]) m = r;
        if (m === i) break;
        [ids[m], ids[i]] = [ids[i], ids[m]];
        [keys[m], keys[i]] = [keys[i], keys[m]];
        i = m;
      }
    }
    return top;
  }
}
