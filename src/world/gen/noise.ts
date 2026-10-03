import { hash2 } from '../../core/rng.ts';

/** Smooth value noise in [0, 1] (seeded), sampled at (x / scale, y / scale). */
export function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const h = (i: number, j: number) => (hash2(i * 92821 + seed, j * 68917 - seed) % 10000) / 10000;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal noise: a few octaves of value noise, normalized to ~[0, 1]. */
export function fbm(x: number, y: number, scale: number, seed: number, octaves = 3): number {
  let sum = 0, amp = 1, norm = 0, s = scale;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x, y, s, seed + o * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    s /= 2;
  }
  return sum / norm;
}
