/**
 * Pix: an RGBA pixel buffer with the handful of primitives pixel art needs. Pure JS (no canvas)
 * until `toCanvas()`, so art code is easy to reason about and fast to draw.
 */

import { OUTLINE, type RGB } from './color.ts';

export class Pix {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: RGB, a = 255): void {
    x |= 0; y |= 0;
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255) {
      this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
    } else if (a > 0) {
      const t = a / 255;
      const da = this.data[i + 3] / 255;
      const oa = t + da * (1 - t);
      for (let k = 0; k < 3; k++) {
        this.data[i + k] = (c[k] * t + this.data[i + k] * da * (1 - t)) / (oa || 1);
      }
      this.data[i + 3] = oa * 255;
    }
  }

  alpha(x: number, y: number): number {
    if (!this.inside(x, y)) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  get(x: number, y: number): RGB {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, a = 255): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }

  /** Filled ellipse; `color(dx, dy)` receives normalized offsets in [-1, 1] for shading. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: (nx: number, ny: number) => RGB | null, a = 255): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) {
          const c = color(nx, ny);
          if (c) this.set(x, y, c, a);
        }
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 255): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Scanline polygon fill (pixel centers). */
  poly(pts: ReadonlyArray<readonly [number, number]>, color: RGB | ((x: number, y: number) => RGB | null), a = 255): void {
    if (pts.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + (sy - y0) / (y1 - y0) * (x1 - x0));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
          const c = typeof color === 'function' ? color(x, y) : color;
          if (c) this.set(x, y, c, a);
        }
      }
    }
  }

  /** Paint a text pattern: each char maps through `pal`; '.' and unmapped chars are skipped. */
  pattern(x: number, y: number, rows: readonly string[], pal: Record<string, RGB | undefined>, flip = false): void {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (!c) continue;
        this.set(flip ? x + row.length - 1 - i : x + i, y + j, c);
      }
    }
  }

  /** Add a 1px outline around opaque pixels (4-neighborhood). */
  outline(c: RGB = OUTLINE, a = 255): this {
    const mark: number[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.alpha(x, y) > 0) continue;
      if (this.alpha(x - 1, y) > 128 || this.alpha(x + 1, y) > 128 || this.alpha(x, y - 1) > 128 || this.alpha(x, y + 1) > 128) {
        mark.push(x, y);
      }
    }
    for (let k = 0; k < mark.length; k += 2) this.set(mark[k], mark[k + 1], c, a);
    return this;
  }

  /** Copy another Pix onto this one at (x, y), optionally mirrored. */
  blit(src: Pix, x: number, y: number, flip = false): void {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const sx = flip ? src.w - 1 - i : i;
      const k = (j * src.w + sx) * 4;
      const a = src.data[k + 3];
      if (a) this.set(x + i, y + j, [src.data[k], src.data[k + 1], src.data[k + 2]], a);
    }
  }

  /** Multiply every pixel's color (for dimmed/fogged variants). */
  tinted(mul: RGB, add: RGB = [0, 0, 0]): Pix {
    const out = new Pix(this.w, this.h);
    for (let i = 0; i < this.data.length; i += 4) {
      out.data[i] = this.data[i] * mul[0] / 255 + add[0];
      out.data[i + 1] = this.data[i + 1] * mul[1] / 255 + add[1];
      out.data[i + 2] = this.data[i + 2] * mul[2] / 255 + add[2];
      out.data[i + 3] = this.data[i + 3];
    }
    return out;
  }

  /** Solid-color silhouette (for hit flashes). */
  silhouette(c: RGB): Pix {
    const out = new Pix(this.w, this.h);
    for (let i = 0; i < this.data.length; i += 4) {
      if (this.data[i + 3]) {
        out.data[i] = c[0]; out.data[i + 1] = c[1]; out.data[i + 2] = c[2]; out.data[i + 3] = this.data[i + 3];
      }
    }
    return out;
  }

  toCanvas(): OffscreenCanvas {
    const cv = new OffscreenCanvas(this.w, this.h);
    const ctx = cv.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0);
    return cv;
  }
}

/** Ordered 4×4 Bayer threshold in [0, 1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)] / 16;
}
