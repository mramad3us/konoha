import type { World } from './world.ts';

/**
 * Symmetric Recursive Shadowcasting (Albert Ford variant).
 * Guarantees: if A sees B, then B sees A.
 * Processes 8 octants independently from the origin.
 */

type TransformFn = (row: number, col: number) => { x: number; y: number };

function isBlocking(world: World, x: number, y: number): boolean {
  if (!world.tileMap.isInBounds(x, y)) return true;
  if (!world.tileMap.isTransparent(x, y)) return true;

  // Check for sight-blocking entities
  for (const eid of world.getEntitiesAt(x, y)) {
    const blocking = world.blockings.get(eid);
    if (blocking?.blocksSight) return true;
  }
  return false;
}

function computeOctant(
  world: World,
  originX: number,
  originY: number,
  radius: number,
  transform: TransformFn,
  visible: Set<string>,
  explored: Set<string>,
): void {
  const revealTile = (x: number, y: number) => {
    const key = world.fovKey(x, y);
    visible.add(key);
    explored.add(key);
  };

  type Shadow = { start: number; end: number };
  const shadows: Shadow[] = [];

  const isInShadow = (col: number, halfCols: number): boolean => {
    const tileStart = col / halfCols;
    const tileEnd = (col + 1) / halfCols;
    for (const s of shadows) {
      if (s.start <= tileStart && s.end >= tileEnd) return true;
    }
    return false;
  };

  const addShadow = (col: number, halfCols: number) => {
    const newStart = col / halfCols;
    const newEnd = (col + 1) / halfCols;
    const newShadow: Shadow = { start: newStart, end: newEnd };

    // Merge overlapping shadows
    let merged = false;
    for (const s of shadows) {
      if (s.start <= newEnd && s.end >= newStart) {
        s.start = Math.min(s.start, newShadow.start);
        s.end = Math.max(s.end, newShadow.end);
        merged = true;
        break;
      }
    }
    if (!merged) {
      shadows.push(newShadow);
    }

    // Consolidate after merge
    shadows.sort((a, b) => a.start - b.start);
    for (let i = shadows.length - 1; i > 0; i--) {
      if (shadows[i - 1].end >= shadows[i].start) {
        shadows[i - 1].end = Math.max(shadows[i - 1].end, shadows[i].end);
        shadows.splice(i, 1);
      }
    }
  };

  const isFullShadow = (): boolean => {
    return shadows.length === 1 && shadows[0].start <= 0 && shadows[0].end >= 1;
  };

  for (let row = 1; row <= radius; row++) {
    if (isFullShadow()) break;

    for (let col = 0; col <= row; col++) {
      const { x, y } = transform(row, col);
      const absX = originX + x;
      const absY = originY + y;

      if (!world.tileMap.isInBounds(absX, absY)) continue;

      const halfCols = row + 0.5;

      if (!isInShadow(col, halfCols)) {
        revealTile(absX, absY);
      }

      if (isBlocking(world, absX, absY) && !isInShadow(col, halfCols)) {
        addShadow(col, halfCols);
      }
    }
  }
}

/** 8-octant transforms */
const OCTANT_TRANSFORMS: TransformFn[] = [
  (row, col) => ({ x:  col, y: -row }),
  (row, col) => ({ x:  row, y: -col }),
  (row, col) => ({ x:  row, y:  col }),
  (row, col) => ({ x:  col, y:  row }),
  (row, col) => ({ x: -col, y:  row }),
  (row, col) => ({ x: -row, y:  col }),
  (row, col) => ({ x: -row, y: -col }),
  (row, col) => ({ x: -col, y: -row }),
];

/**
 * Compute field of view from origin.
 * Updates world.fovVisible (rebuilt) and world.fovExplored (only grows).
 */
export function computeFOV(world: World, originX: number, originY: number, radius: number): void {
  world.fovVisible.clear();

  // Origin is always visible
  const originKey = world.fovKey(originX, originY);
  world.fovVisible.add(originKey);
  world.fovExplored.add(originKey);

  for (const transform of OCTANT_TRANSFORMS) {
    computeOctant(world, originX, originY, radius, transform, world.fovVisible, world.fovExplored);
  }
}
