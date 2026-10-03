/**
 * Procedural terrain textures. Colors are computed per pixel from grid-space coordinates so
 * patterns (cobbles, planks, furrows) follow the isometric axes and flow across tiles.
 * Soft terrains dither into each other along edges; built surfaces get a darker curb.
 */

import { hash2 } from '../core/rng.ts';
import { hex, shade, mix, type RGB } from './color.ts';
import { bayer } from './pix.ts';
import { T, TILES } from '../world/tiles.ts';

const C = {
  grass: hex('#5f8a3c'), grassDark: hex('#4a7231'), grassLight: hex('#78a44a'), grassDry: hex('#7d8d45'),
  lush: hex('#4c8238'), lushDark: hex('#3a6a2e'),
  dirt: hex('#8b6b45'), dirtDark: hex('#6f5236'), dirtLight: hex('#a3845a'),
  stone: hex('#8d877b'), stoneDark: hex('#5f5a52'), mortar: hex('#4e4943'),
  plaza: hex('#a89c88'), plazaGrout: hex('#7d7364'),
  sand: hex('#d3bd88'), sandDark: hex('#b9a172'),
  plank: hex('#8a5f3c'), plankDark: hex('#5e3f28'), plankLight: hex('#a3754c'),
  shallow: hex('#4f93ad'), deep: hex('#2b5b84'), deepDark: hex('#1f4466'), foam: hex('#cfe8ef'),
  field: hex('#7a5a36'), fieldRidge: hex('#93713f'), sprout: hex('#6a9a3e'),
  forest: hex('#3f5a2d'), leaf: hex('#5e4a2a'), leaf2: hex('#7a5a2e'),
  rock: hex('#7c7a74'), rockDark: hex('#5c5a56'),
};

/** Low-frequency value noise in grid space (cells of `scale` tiles). */
function vnoise(u: number, v: number, scale: number, seed: number): number {
  const x = u / scale, y = v / scale;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const h = (i: number, j: number) => (hash2(i * 7919 + seed, j * 104729 + seed * 31) % 1000) / 1000;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Color of one terrain pixel.
 * u, v: continuous grid coordinates; px, py: integer screen-pixel coordinates (for speckle).
 */
export function terrainColor(tile: number, u: number, v: number, px: number, py: number): RGB {
  const r = hash2(px, py) % 1000;
  switch (tile) {
    case T.grass: {
      const n = vnoise(u, v, 5, 1);
      let c = mix(C.grass, n > 0.6 ? C.grassDry : C.grassDark, Math.abs(n - 0.5) * 0.7);
      if (r < 70) c = C.grassDark;
      else if (r > 960) c = C.grassLight;
      return c;
    }
    case T.grass_lush: {
      const n = vnoise(u, v, 4, 2);
      let c = mix(C.lush, C.lushDark, n * 0.6);
      if (r < 90) c = C.lushDark;
      else if (r > 965) c = C.grassLight;
      return c;
    }
    case T.forest_floor: {
      const n = vnoise(u, v, 3, 3);
      let c = mix(C.forest, C.lushDark, n * 0.5);
      if (r < 60) c = C.leaf;
      else if (r < 85) c = C.leaf2;
      else if (r > 975) c = C.grassDark;
      return c;
    }
    case T.dirt: {
      const n = vnoise(u, v, 3, 4);
      let c = mix(C.dirt, C.dirtDark, n * 0.5);
      if (r < 50) c = C.dirtDark;
      else if (r > 950) c = C.dirtLight;
      return c;
    }
    case T.road: {
      // Cobbles: 3×3 per tile, offset every other row.
      const cu = u * 3, cv = v * 3;
      const row = Math.floor(cv);
      const su = cu + (row % 2) * 0.5;
      const fu = su - Math.floor(su), fv = cv - row;
      const stoneId = hash2(Math.floor(su), row);
      if (fu < 0.1 || fv < 0.12) return C.mortar;
      let c = mix(C.stone, C.stoneDark, (stoneId % 100) / 260);
      if (fu > 0.8 || fv > 0.82) c = shade(c, -0.18);
      else if (fu < 0.25 && fv < 0.35) c = shade(c, 0.12);
      if (r > 985) c = C.stoneDark;
      return c;
    }
    case T.plaza: {
      const fu = u - Math.floor(u), fv = v - Math.floor(v);
      if (fu < 0.05 || fv < 0.05) return C.plazaGrout;
      let c = mix(C.plaza, C.plazaGrout, (hash2(Math.floor(u), Math.floor(v)) % 100) / 500);
      if (r > 975) c = shade(c, -0.1);
      return c;
    }
    case T.sand: {
      let c = mix(C.sand, C.sandDark, vnoise(u, v, 4, 6) * 0.5);
      if (r < 40) c = C.sandDark;
      return c;
    }
    case T.planks: {
      const board = Math.floor(v * 4);
      const fv = v * 4 - board;
      const seam = (u * 1.5 + (hash2(board, 3) % 7) / 7) % 1;
      if (fv < 0.12) return C.plankDark;
      let c = mix(C.plank, C.plankLight, (hash2(board, 9) % 100) / 300);
      if (seam < 0.04) c = C.plankDark;
      if (r < 40) c = shade(c, -0.15);
      return c;
    }
    case T.shallow: {
      const n = vnoise(u, v, 3, 7);
      let c = mix(C.shallow, C.sand, 0.12 + n * 0.12);
      if (r > 980) c = C.foam;
      return c;
    }
    case T.deep: {
      const n = vnoise(u, v, 4, 8);
      return mix(C.deep, C.deepDark, n * 0.6);
    }
    case T.field: {
      const fv = (v * 3) % 1;
      let c = fv < 0.45 ? C.field : C.fieldRidge;
      if (fv > 0.55 && fv < 0.8 && (hash2(Math.floor(u * 4), Math.floor(v * 3)) % 3 === 0)) c = C.sprout;
      if (r < 40) c = shade(c, -0.15);
      return c;
    }
    case T.rock: {
      const n = vnoise(u, v, 2, 9);
      let c = mix(C.rock, C.rockDark, n * 0.6);
      if (r < 60) c = C.rockDark;
      return c;
    }
    default:
      return [10, 10, 14];
  }
}

/** Soft terrains dither into lower-priority neighbors. Built surfaces never blend. */
const PRIORITY: Partial<Record<number, number>> = {
  [T.deep]: 1, [T.shallow]: 2, [T.sand]: 3, [T.rock]: 4, [T.dirt]: 5, [T.field]: 5,
  [T.forest_floor]: 6, [T.grass]: 7, [T.grass_lush]: 8,
};
const HARD = new Set([T.road, T.plaza, T.planks]);

export function isWaterTile(t: number): boolean {
  return TILES[t]?.water > 0;
}

/**
 * Final pixel color for a tile including edge treatment.
 * `nb(dx, dy)` returns the neighboring tile type in grid space.
 */
export function tilePixel(
  tile: number, gx: number, gy: number, u: number, v: number, px: number, py: number,
  nb: (dx: number, dy: number) => number,
): RGB {
  const myP = PRIORITY[tile] ?? 0;
  const edges: Array<[number, number, number]> = [
    [1, 0, 0.5 - gx], [-1, 0, 0.5 + gx], [0, 1, 0.5 - gy], [0, -1, 0.5 + gy],
  ];
  // Blend soft neighbors in.
  if (!HARD.has(tile)) {
    for (const [dx, dy, d] of edges) {
      const n = nb(dx, dy);
      if (n === tile || HARD.has(n)) continue;
      const nP = PRIORITY[n] ?? 0;
      if (nP <= myP) continue;
      const width = 0.24;
      if (d < width && bayer(px, py) * 0.85 + (hash2(px, py) % 100) / 700 > d / width) {
        return terrainColor(n, u, v, px, py);
      }
    }
  }
  let c = terrainColor(tile, u, v, px, py);
  // Curbs on built surfaces; wet rims on water.
  if (HARD.has(tile)) {
    for (const [dx, dy, d] of edges) {
      if (d < 0.07 && nb(dx, dy) !== tile && !HARD.has(nb(dx, dy))) { c = shade(c, -0.3); break; }
    }
  } else if (tile === T.shallow) {
    for (const [dx, dy, d] of edges) {
      if (d < 0.08 && !isWaterTile(nb(dx, dy))) { c = C.foam; break; }
    }
  }
  return c;
}
