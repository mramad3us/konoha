/**
 * Shared drawing helpers for props, buildings and effects: anchored sprites, iso projection,
 * shaded volumes. Light comes from the upper left.
 */

import { Pix, bayer } from './pix.ts';
import { hash2 } from '../core/rng.ts';
import { shade, hex, type RGB } from './color.ts';
import { TILE_W, TILE_H } from '../core/config.ts';

/** A sprite and the pixel that sits on the tile's center point. */
export interface ArtSprite { pix: Pix; ax: number; ay: number }

export function sprite(w: number, h: number, ax: number, ay: number): ArtSprite {
  return { pix: new Pix(w, h), ax, ay };
}

/** Screen offset of a grid-space offset (gu, gv) from the anchor, raised by z pixels. */
export function iso(s: ArtSprite, gu: number, gv: number, z = 0): [number, number] {
  return [s.ax + (gu - gv) * (TILE_W / 2), s.ay + (gu + gv) * (TILE_H / 2) - z];
}

export function groundShadow(s: ArtSprite, rx: number, ry: number, a = 80, dx = 1, dy = 0): void {
  s.pix.ellipse(s.ax + dx, s.ay + dy, rx, ry, () => [10, 12, 20], a);
}

/** Quantized ramp lookup with dithering between steps; t in [0, 1]. */
export function rampAt(r: readonly RGB[], t: number, x: number, y: number): RGB {
  const f = Math.max(0, Math.min(0.999, t)) * (r.length - 1);
  const i = Math.floor(f);
  const frac = f - i;
  return frac > bayer(x, y) && i + 1 < r.length ? r[i + 1] : r[i];
}

/** Light intensity for a sphere-ish normal (nx, ny in [-1,1], screen space). */
export function lightOf(nx: number, ny: number): number {
  return 0.55 - nx * 0.3 - ny * 0.42;
}

/** A leafy, shaded blob (tree canopy, bush). */
export function foliage(s: ArtSprite, cx: number, cy: number, rx: number, ry: number, r: readonly RGB[], seed: number): void {
  s.pix.ellipse(cx, cy, rx, ry, (nx, ny) => {
    const x = Math.round(cx + nx * rx), y = Math.round(cy + ny * ry);
    const edge = nx * nx + ny * ny;
    const h = hash2(x * 3 + seed, y * 5 + seed);
    if (edge > 0.82 && h % 3 === 0) return null;             // ragged leafy edge
    let t = lightOf(nx, ny) + ((h % 100) / 100 - 0.5) * 0.25;
    if (h % 17 === 0) t += 0.25;                              // leaf highlights
    return rampAt(r, t, x, y);
  });
}

/** Iso box: footprint ±a (grid x) by ±b (grid y), height h px, from z0. Faces: top, left (+y face), right (+x face). */
export function isoBox(s: ArtSprite, a: number, b: number, h: number, top: RGB, left: RGB, right: RGB, z0 = 0): void {
  const P = (u: number, v: number, z: number) => iso(s, u, v, z);
  // Left face (facing +y, screen down-left)
  s.pix.poly([P(-a, b, z0), P(a, b, z0), P(a, b, z0 + h), P(-a, b, z0 + h)], left);
  // Right face (facing +x, screen down-right)
  s.pix.poly([P(a, -b, z0), P(a, b, z0), P(a, b, z0 + h), P(a, -b, z0 + h)], right);
  // Top
  s.pix.poly([P(-a, -b, z0 + h), P(a, -b, z0 + h), P(a, b, z0 + h), P(-a, b, z0 + h)], top);
}

export function boxColors(c: string): [RGB, RGB, RGB] {
  return [shade(c, 0.18), hex(c), shade(c, -0.3)];
}

/** Vertical cylinder seen in iso (barrel, stump, well). */
export function cylinder(s: ArtSprite, rx: number, h: number, body: readonly RGB[], top: RGB, z0 = 0): void {
  const ry = rx / 2;
  const cx = s.ax, base = s.ay - z0;
  for (let y = 0; y < h; y++) {
    for (let x = -rx; x <= rx; x++) {
      const nx = x / rx;
      const yy = base - y + Math.sqrt(Math.max(0, 1 - nx * nx)) * ry;
      s.pix.set(cx + x, Math.round(yy), rampAt(body, 0.5 - nx * 0.45, cx + x, Math.round(yy)));
    }
  }
  s.pix.ellipse(cx, base - h, rx + 0.5, ry + 0.5, () => top);
}
