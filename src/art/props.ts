/**
 * Prop art. Each prop is drawn procedurally (deterministic per variant) and anchored on its
 * tile's center. Connected props (fences, palisades) take a neighbor mask; animated ones a frame.
 */

import { hex, shade, ramp, OUTLINE, type RGB } from './color.ts';
import { hash2 } from '../core/rng.ts';
import {
  sprite, iso, groundShadow, foliage, isoBox, boxColors, cylinder, rampAt, type ArtSprite,
} from './draw.ts';

/** Mask bits for connected props: neighbor present at +x, +y, −x, −y (grid). */
export const MASK = { E: 1, S: 2, W: 4, N: 8 } as const;

/** How many visual variants a prop has (the renderer picks one per cell by hash). */
export const PROP_VARIANTS: Record<string, number> = {
  tree_pine: 4, tree_broad: 4, tree_sakura: 3, tree_dead: 2, bush: 4, tall_grass: 4, reeds: 3, flowers: 4,
  rock_small: 3, rock_large: 3, stump: 2, log: 2, crates: 2, barrel: 2,
};
export const ANIMATED: Record<string, number> = { torch: 3, campfire: 3, lantern: 1 };
export const CONNECTED = new Set(['fence', 'palisade']);

export function drawProp(art: string, variant: number, mask: number, frame: number): ArtSprite {
  const f = PROPS_ART[art];
  if (!f) return placeholder();
  return f(variant, mask, frame);
}

type PropFn = (variant: number, mask: number, frame: number) => ArtSprite;

const LEAF = ramp('#4f7f35');
const LEAF_DARK = ramp('#3d6a33');
const PINE = ramp('#3a6640');
const SAKURA = ramp('#e3a3b8');
const BARK = ramp('#6b4a33');
const STONE = ramp('#8b8780');
const WOOD = ramp('#8a5f3c');
const STRAW = ramp('#c9a95a');

function placeholder(): ArtSprite {
  const s = sprite(8, 8, 4, 6);
  s.pix.rect(0, 0, 8, 8, [255, 0, 255]);
  return s;
}

function trunk(s: ArtSprite, h: number, w = 3, r = BARK): void {
  const x0 = s.ax - Math.floor(w / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = x === 0 ? 0.75 : x === w - 1 ? 0.15 : 0.45;
    s.pix.set(x0 + x, s.ay - y, rampAt(r, t + ((hash2(x, y) % 10) - 5) / 60, x0 + x, s.ay - y));
  }
}

const PROPS_ART: Record<string, PropFn> = {
  tree_broad(v) {
    const s = sprite(36, 46, 18, 42);
    groundShadow(s, 11, 4, 90, 2, 0);
    trunk(s, 14, 4);
    const r = v % 2 ? LEAF : LEAF_DARK;
    const k = 1 + (v % 3) * 0.08;
    foliage(s, s.ax - 6, s.ay - 20, 9 * k, 8, r, v * 11 + 1);
    foliage(s, s.ax + 6, s.ay - 19, 9 * k, 8, r, v * 11 + 2);
    foliage(s, s.ax, s.ay - 28, 11 * k, 10, r, v * 11 + 3);
    foliage(s, s.ax - 3, s.ay - 33, 7, 6, r, v * 11 + 4);
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  tree_sakura(v) {
    const s = sprite(36, 46, 18, 42);
    groundShadow(s, 11, 4, 80, 2, 0);
    trunk(s, 15, 3, ramp('#5a3a32'));
    foliage(s, s.ax - 6, s.ay - 21, 9, 7, SAKURA, v * 7 + 1);
    foliage(s, s.ax + 6, s.ay - 20, 9, 7, SAKURA, v * 7 + 2);
    foliage(s, s.ax, s.ay - 28, 11, 9, SAKURA, v * 7 + 3);
    s.pix.outline(shade('#8a4a5a', -0.3), 220);
    // A few fallen petals.
    for (let i = 0; i < 6; i++) {
      const h = hash2(v, i);
      s.pix.set(s.ax - 12 + (h % 24), s.ay - 2 + ((h >> 5) % 5), SAKURA[3]);
    }
    return s;
  },
  tree_pine(v) {
    const s = sprite(28, 50, 14, 46);
    groundShadow(s, 9, 3, 90, 2, 0);
    trunk(s, 8, 3);
    const tiers = 4;
    const height = 36 + (v % 3) * 3;
    for (let t = 0; t < tiers; t++) {
      const baseY = s.ay - 6 - t * (height / tiers) * 0.85;
      const halfW = 11 - t * 2.3;
      const tierH = height / tiers + 4;
      for (let y = 0; y < tierH; y++) {
        const w = halfW * (y / tierH);
        for (let x = -Math.ceil(w); x <= Math.ceil(w); x++) {
          const px = s.ax + x, py = Math.round(baseY - tierH + y);
          const nx = x / (halfW || 1);
          const lt = 0.62 - nx * 0.4 - (1 - y / tierH) * 0.1 + (hash2(px + v, py) % 9) / 60;
          if (y === Math.floor(tierH) - 1 && hash2(px, v) % 3 === 0) continue;
          s.pix.set(px, py, rampAt(PINE, lt, px, py));
        }
      }
    }
    s.pix.outline(OUTLINE, 210);
    return s;
  },
  tree_dead(v) {
    const s = sprite(28, 40, 14, 37);
    groundShadow(s, 6, 2, 70);
    trunk(s, 22, 3, ramp('#6a5a4a'));
    const br = ramp('#6a5a4a');
    const branches: Array<[number, number, number, number]> = v % 2
      ? [[0, -16, -8, -26], [0, -12, 7, -22], [-4, -21, -9, -30], [3, -18, 6, -31]]
      : [[0, -14, -9, -22], [0, -18, 8, -28], [5, -24, 4, -33]];
    for (const [x0, y0, x1, y1] of branches) s.pix.line(s.ax + x0, s.ay + y0, s.ax + x1, s.ay + y1, br[1]);
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  bush(v) {
    const s = sprite(22, 16, 11, 13);
    groundShadow(s, 8, 3, 70);
    const r = v % 2 ? LEAF : LEAF_DARK;
    foliage(s, s.ax - 3, s.ay - 4, 6, 4.5, r, v * 3 + 1);
    foliage(s, s.ax + 3, s.ay - 4, 6, 4.5, r, v * 3 + 2);
    foliage(s, s.ax, s.ay - 7, 6, 4.5, r, v * 3 + 3);
    if (v % 4 === 3) for (let i = 0; i < 5; i++) {
      const h = hash2(v, i * 13);
      s.pix.set(s.ax - 6 + (h % 12), s.ay - 9 + ((h >> 4) % 6), hex('#c04050'));
    }
    s.pix.outline(OUTLINE, 180);
    return s;
  },
  tall_grass(v) {
    const s = sprite(30, 18, 15, 13);
    const greens = ramp('#6a9a40');
    for (let i = 0; i < 26; i++) {
      const h = hash2(v * 97 + i, i * 31);
      const gu = ((h % 100) / 100 - 0.5) * 0.9, gv = (((h >> 8) % 100) / 100 - 0.5) * 0.9;
      const [x, y] = iso(s, gu, gv);
      const tall = 5 + (h >> 16) % 6;
      const lean = ((h >> 12) % 3) - 1;
      for (let k = 0; k < tall; k++) {
        const px = Math.round(x + (k > tall / 2 ? lean : 0)), py = Math.round(y - k);
        s.pix.set(px, py, greens[k > tall - 2 ? 4 : k > tall / 2 ? 3 : 1 + (h % 2)]);
      }
    }
    return s;
  },
  reeds(v) {
    const s = sprite(26, 20, 13, 15);
    const g = ramp('#6a8a46');
    for (let i = 0; i < 14; i++) {
      const h = hash2(v * 53 + i, i * 7);
      const [x, y] = iso(s, ((h % 100) / 100 - 0.5) * 0.8, (((h >> 7) % 100) / 100 - 0.5) * 0.8);
      const tall = 8 + (h >> 14) % 6;
      for (let k = 0; k < tall; k++) s.pix.set(Math.round(x), Math.round(y - k), g[k > tall - 3 ? 3 : 1]);
      s.pix.set(Math.round(x), Math.round(y - tall), hex('#7a5a36'));
      s.pix.set(Math.round(x), Math.round(y - tall - 1), hex('#5a4026'));
    }
    return s;
  },
  flowers(v) {
    const s = sprite(26, 12, 13, 7);
    const cols = ['#e8e0c0', '#e0a040', '#d06080', '#a080e0'].map(hex);
    for (let i = 0; i < 9; i++) {
      const h = hash2(v * 19 + i, 3 + i);
      const [x, y] = iso(s, ((h % 100) / 100 - 0.5) * 0.85, (((h >> 7) % 100) / 100 - 0.5) * 0.85);
      s.pix.set(Math.round(x), Math.round(y), hex('#4a7a30'));
      s.pix.set(Math.round(x), Math.round(y - 1), cols[(h >> 12) % 4]);
    }
    return s;
  },
  rock_small(v) {
    const s = sprite(14, 10, 7, 7);
    groundShadow(s, 5, 2, 60);
    s.pix.ellipse(s.ax, s.ay - 2, 4 + (v % 2), 3, (nx, ny) => rampAt(STONE, 0.6 - nx * 0.3 - ny * 0.4, 0, 0));
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  rock_large(v) {
    const s = sprite(28, 24, 14, 19);
    groundShadow(s, 11, 4, 80, 2);
    const moss = ramp('#5a7a3a');
    s.pix.ellipse(s.ax, s.ay - 7, 10 + (v % 2), 8, (nx, ny) => {
      const x = Math.round(s.ax + nx * 10), y = Math.round(s.ay - 7 + ny * 8);
      const t = 0.58 - nx * 0.32 - ny * 0.45 + (hash2(x, y + v) % 10) / 70;
      if (ny < -0.45 && hash2(x + v, y) % 3 !== 0) return rampAt(moss, t, x, y);
      return rampAt(STONE, t, x, y);
    });
    s.pix.line(s.ax - 2, s.ay - 9, s.ax + 2, s.ay - 4, STONE[1]);
    s.pix.outline(OUTLINE, 220);
    return s;
  },
  stump() {
    const s = sprite(16, 14, 8, 11);
    groundShadow(s, 5, 2, 70);
    cylinder(s, 4, 5, BARK, hex('#b08a5a'));
    s.pix.set(s.ax, s.ay - 5, BARK[1]);
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  log(v) {
    const s = sprite(32, 16, 16, 10);
    groundShadow(s, 12, 3, 70);
    const dir = v % 2 ? 1 : -1;
    for (let k = -10; k <= 10; k++) {
      for (let r = -3; r <= 3; r++) {
        const x = s.ax + k, y = Math.round(s.ay - 3 + r + k * 0.5 * dir);
        s.pix.set(x, y, rampAt(BARK, 0.5 - r * 0.12, x, y));
      }
    }
    s.pix.ellipse(s.ax + 10 * (dir > 0 ? 1 : 1), s.ay - 3 + 5 * dir, 2, 3, () => hex('#b08a5a'));
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  fence(_v, mask) {
    const s = sprite(34, 26, 17, 19);
    const [, side, dark] = boxColors('#8a6a44');
    const rail = (gu: number, gv: number) => {
      const [x1, y1] = iso(s, gu * 0.5, gv * 0.5, 0);
      for (const z of [5, 9]) s.pix.line(s.ax, s.ay - z, Math.round(x1), Math.round(y1 - z), side);
      for (const z of [6, 10]) s.pix.line(s.ax, s.ay - z, Math.round(x1), Math.round(y1 - z), dark);
    };
    if (mask & MASK.N) rail(0, -1);
    if (mask & MASK.W) rail(-1, 0);
    // Post
    isoBox(s, 0.06, 0.06, 13, shade('#8a6a44', 0.2), hex('#8a6a44'), shade('#8a6a44', -0.3));
    if (mask & MASK.E) rail(1, 0);
    if (mask & MASK.S) rail(0, 1);
    s.pix.outline(OUTLINE, 160);
    return s;
  },
  palisade(_v, mask) {
    const s = sprite(36, 44, 18, 35);
    const logs = ramp('#7a5a3a');
    const drawLog = (gu: number, gv: number) => {
      const [x, y] = iso(s, gu, gv);
      const h = 22 + (hash2(Math.round(x * 3), Math.round(y)) % 4);
      for (let z = 0; z < h; z++) for (let dx = -1; dx <= 1; dx++) {
        const px = Math.round(x) + dx, py = Math.round(y) - z;
        s.pix.set(px, py, logs[dx === -1 ? 3 : dx === 0 ? 2 : 1]);
      }
      s.pix.set(Math.round(x), Math.round(y) - h - 1, logs[3]);
      s.pix.set(Math.round(x), Math.round(y) - h + 4, logs[0]);
    };
    const segs: Array<[number, number]> = [];
    if (mask & MASK.N) segs.push([0, -1]);
    if (mask & MASK.W) segs.push([-1, 0]);
    const back = segs.flatMap(([u, v]) => [0.33, 0.16].map(t => [u * t, v * t] as [number, number]));
    const front: Array<[number, number]> = [];
    if (mask & MASK.E) front.push(...[0.16, 0.33].map(t => [t, 0] as [number, number]));
    if (mask & MASK.S) front.push(...[0.16, 0.33].map(t => [0, t] as [number, number]));
    for (const [u, v] of back) drawLog(u, v);
    drawLog(0, 0);
    for (const [u, v] of front) drawLog(u, v);
    // Lashing
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  lantern() {
    const s = sprite(16, 26, 8, 22);
    groundShadow(s, 5, 2, 70);
    const [top, side, dark] = boxColors('#8c8a84');
    isoBox(s, 0.16, 0.16, 3, top, side, dark);
    isoBox(s, 0.07, 0.07, 8, top, side, dark, 3);
    isoBox(s, 0.14, 0.14, 5, hex('#f0d080'), hex('#e8b050'), hex('#c08030'), 11);
    isoBox(s, 0.22, 0.22, 2, top, side, dark, 16);
    s.pix.set(s.ax, s.ay - 19, side);
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  torch(_v, _m, frame) {
    const s = sprite(12, 26, 6, 22);
    groundShadow(s, 3, 1, 60);
    for (let y = 0; y < 15; y++) { s.pix.set(s.ax, s.ay - y, BARK[2]); s.pix.set(s.ax + 1, s.ay - y, BARK[1]); }
    flame(s, s.ax, s.ay - 16, frame, 1);
    s.pix.outline(OUTLINE, 160);
    return s;
  },
  campfire(_v, _m, frame) {
    const s = sprite(24, 22, 12, 15);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const [x, y] = iso(s, Math.cos(a) * 0.32, Math.sin(a) * 0.32);
      s.pix.ellipse(x, y - 1, 1.6, 1.2, () => STONE[1 + (i % 2)]);
    }
    s.pix.line(s.ax - 5, s.ay - 1, s.ax + 4, s.ay - 3, BARK[1]);
    s.pix.line(s.ax - 4, s.ay - 3, s.ax + 5, s.ay - 1, BARK[2]);
    flame(s, s.ax, s.ay - 3, frame, 1.6);
    return s;
  },
  barrel(v) {
    const s = sprite(14, 18, 7, 14);
    groundShadow(s, 5, 2, 70);
    cylinder(s, 4, 10, WOOD, v % 2 ? hex('#4f7fa0') : hex('#6a4a30'));
    s.pix.line(s.ax - 4, s.ay - 3, s.ax + 4, s.ay - 3, hex('#3a3a40'));
    s.pix.line(s.ax - 4, s.ay - 8, s.ax + 4, s.ay - 8, hex('#3a3a40'));
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  crates(v) {
    const s = sprite(30, 28, 15, 21);
    groundShadow(s, 11, 4, 70);
    const c = boxColors('#a07a4a');
    isoBox(s, 0.3, 0.28, 10, ...c);
    if (v % 2) isoBox(s, 0.18, 0.16, 8, ...c, 10);
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  tent() {
    const s = sprite(40, 32, 20, 26);
    groundShadow(s, 15, 6, 80);
    const canvas = ramp('#a89a78');
    const P = (u: number, v: number, z: number) => iso(s, u, v, z);
    s.pix.poly([P(-0.45, 0.45, 0), P(0.45, 0.45, 0), P(0.45, 0, 18), P(-0.45, 0, 18)], canvas[2]);
    s.pix.poly([P(-0.45, -0.45, 0), P(-0.45, 0.45, 0), P(-0.45, 0, 18)], canvas[1]);
    s.pix.poly([P(0.45, -0.45, 0), P(0.45, 0.45, 0), P(0.45, 0, 18)], canvas[0]);
    s.pix.poly([P(-0.45, 0.45, 0), P(-0.45, 0.05, 0), P(-0.45, 0, 14)], canvas[0]);
    s.pix.line(...P(-0.45, 0, 18), ...P(0.45, 0, 18), canvas[4]);
    s.pix.outline(OUTLINE, 220);
    return s;
  },
  bedroll() {
    const s = sprite(30, 14, 15, 7);
    const c = ramp('#6a5a8a');
    const P = (u: number, v: number) => iso(s, u, v, 1);
    s.pix.poly([P(-0.35, -0.15), P(0.35, -0.15), P(0.35, 0.15), P(-0.35, 0.15)], c[2]);
    s.pix.poly([P(-0.35, -0.15), P(-0.2, -0.15), P(-0.2, 0.15), P(-0.35, 0.15)], c[4]);
    return s;
  },
  well() {
    const s = sprite(26, 34, 13, 25);
    groundShadow(s, 9, 4, 80);
    cylinder(s, 8, 7, STONE, hex('#2a3a50'));
    for (const u of [-0.32, 0.32]) {
      const [x, y] = iso(s, u, 0, 6);
      s.pix.line(Math.round(x), Math.round(y), Math.round(x), Math.round(y) - 13, BARK[1]);
    }
    const P = (u: number, v: number, z: number) => iso(s, u, v, z);
    s.pix.poly([P(-0.42, -0.25, 19), P(0.42, -0.25, 19), P(0.42, 0, 24), P(-0.42, 0, 24)], hex('#5a4a40'));
    s.pix.poly([P(-0.42, 0.25, 19), P(0.42, 0.25, 19), P(0.42, 0, 24), P(-0.42, 0, 24)], hex('#7a6050'));
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  bench() {
    const s = sprite(28, 16, 14, 11);
    groundShadow(s, 9, 3, 60);
    const c = boxColors('#8a6440');
    isoBox(s, 0.36, 0.1, 2, ...c, 4);
    for (const u of [-0.28, 0.28]) {
      const [x, y] = iso(s, u, 0.04);
      s.pix.line(Math.round(x), Math.round(y), Math.round(x), Math.round(y) - 4, c[2]);
    }
    s.pix.outline(OUTLINE, 180);
    return s;
  },
  post() {
    const s = sprite(14, 26, 7, 22);
    groundShadow(s, 4, 2, 70);
    isoBox(s, 0.1, 0.1, 18, ...boxColors('#8a6a44'));
    isoBox(s, 0.13, 0.13, 6, ...boxColors('#c9a95a'), 8);
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  target() {
    const s = sprite(20, 28, 10, 24);
    groundShadow(s, 5, 2, 60);
    s.pix.line(s.ax - 3, s.ay, s.ax, s.ay - 10, BARK[1]);
    s.pix.line(s.ax + 3, s.ay, s.ax, s.ay - 10, BARK[1]);
    s.pix.ellipse(s.ax, s.ay - 15, 6, 7, (nx, ny) => {
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d < 0.3) return hex('#b03030');
      if (d < 0.55) return STRAW[3];
      if (d < 0.75) return hex('#b03030');
      return rampAt(STRAW, 0.5 - nx * 0.3, 0, 0);
    });
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  sign() {
    const s = sprite(18, 24, 9, 20);
    groundShadow(s, 4, 2, 60);
    s.pix.line(s.ax, s.ay, s.ax, s.ay - 14, BARK[1]);
    const c = boxColors('#a07850');
    isoBox(s, 0.22, 0.04, 6, ...c, 9);
    s.pix.line(s.ax - 3, s.ay - 12, s.ax + 2, s.ay - 14, hex('#3a2a1a'));
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  stall(v) {
    const s = sprite(40, 38, 20, 28);
    groundShadow(s, 14, 6, 80);
    const c = boxColors('#8a6440');
    isoBox(s, 0.42, 0.28, 8, ...c);
    // goods
    for (let i = 0; i < 6; i++) {
      const [x, y] = iso(s, -0.3 + i * 0.12, -0.05, 9);
      s.pix.ellipse(x, y, 1.5, 1.2, () => ['#d0a040', '#a04030', '#60a040'].map(hex)[(i + v) % 3]);
    }
    for (const [u, vv] of [[-0.4, 0.26], [0.4, 0.26], [0.4, -0.26]] as const) {
      const [x, y] = iso(s, u, vv, 0);
      s.pix.line(Math.round(x), Math.round(y), Math.round(x), Math.round(y) - 20, BARK[1]);
    }
    const cloth = v % 2 ? ramp('#a83a3a') : ramp('#3a6aa8');
    const P = (u: number, vv: number, z: number) => iso(s, u, vv, z);
    s.pix.poly([P(-0.5, -0.36, 22), P(0.5, -0.36, 22), P(0.5, 0.36, 18), P(-0.5, 0.36, 18)], (x, y) => ((x + y) >> 2) % 2 ? cloth[2] : cloth[3]);
    s.pix.outline(OUTLINE, 210);
    return s;
  },
  planter() {
    const s = sprite(24, 22, 12, 16);
    groundShadow(s, 8, 3, 70);
    isoBox(s, 0.3, 0.3, 5, ...boxColors('#7a7064'));
    foliage(s, s.ax, s.ay - 9, 7, 4, LEAF, 5);
    s.pix.outline(OUTLINE, 200);
    return s;
  },
  cliff(v) {
    const s = sprite(34, 46, 17, 29);
    const r = ramp('#6e6a62');
    const P = (u: number, vv: number, z: number) => iso(s, u, vv, z);
    const h = 26 + (v % 3) * 3;
    s.pix.poly([P(-0.5, 0.5, 0), P(0.5, 0.5, 0), P(0.5, 0.5, h), P(-0.5, 0.5, h)], (x, y) => rampAt(r, 0.45 + (hash2(x, y) % 10) / 50, x, y));
    s.pix.poly([P(0.5, -0.5, 0), P(0.5, 0.5, 0), P(0.5, 0.5, h), P(0.5, -0.5, h)], (x, y) => rampAt(r, 0.2 + (hash2(x, y) % 10) / 50, x, y));
    s.pix.poly([P(-0.5, -0.5, h), P(0.5, -0.5, h), P(0.5, 0.5, h), P(-0.5, 0.5, h)], (x, y) => rampAt(ramp('#5f7a40'), 0.5 + (hash2(x, y) % 10) / 40, x, y));
    return s;
  },
  dummy() {
    const s = sprite(18, 30, 9, 26);
    groundShadow(s, 5, 2, 70);
    isoBox(s, 0.08, 0.08, 20, ...boxColors('#8a6a44'));
    s.pix.line(s.ax - 6, s.ay - 15, s.ax + 6, s.ay - 15, BARK[2]);
    s.pix.line(s.ax - 6, s.ay - 14, s.ax + 6, s.ay - 14, BARK[1]);
    isoBox(s, 0.14, 0.12, 9, ...boxColors('#c9a95a'), 10);
    s.pix.ellipse(s.ax, s.ay - 23, 3, 3, (nx, ny) => rampAt(STRAW, 0.6 - nx * 0.3 - ny * 0.3, 0, 0));
    s.pix.outline(OUTLINE, 220);
    return s;
  },
  item_kunai() {
    const s = sprite(12, 8, 6, 5);
    s.pix.line(s.ax - 4, s.ay, s.ax + 2, s.ay - 3, hex('#b8c0c8'));
    s.pix.line(s.ax - 4, s.ay + 1, s.ax + 2, s.ay - 2, hex('#7a8088'));
    s.pix.set(s.ax + 3, s.ay - 3, hex('#3a2a2a'));
    s.pix.set(s.ax + 4, s.ay - 4, hex('#c0a040'));
    return s;
  },
  item_shuriken() {
    const s = sprite(8, 6, 4, 4);
    const m = hex('#a8b0b8');
    s.pix.set(s.ax, s.ay - 1, hex('#3a3a40'));
    for (const [dx, dy] of [[-2, 0], [2, -2], [1, 1], [-1, -3]]) s.pix.line(s.ax, s.ay - 1, s.ax + dx, s.ay - 1 + dy, m);
    return s;
  },
  item_bandage() {
    const s = sprite(8, 6, 4, 4);
    s.pix.ellipse(s.ax, s.ay - 1, 2.5, 1.5, () => hex('#e8e0d0'));
    return s;
  },
  item_soldier_pill() {
    const s = sprite(6, 5, 3, 3);
    s.pix.ellipse(s.ax, s.ay - 1, 1.5, 1.5, () => hex('#6a8a40'));
    return s;
  },
  log_decoy() {
    const s = sprite(20, 14, 10, 10);
    for (let k = -6; k <= 6; k++) for (let r = -2; r <= 2; r++) s.pix.set(s.ax + k, s.ay - 3 + r + Math.round(k * 0.3), rampAt(BARK, 0.5 - r * 0.15, 0, 0));
    s.pix.outline(OUTLINE, 200);
    return s;
  },
};

function flame(s: ArtSprite, x: number, y: number, frame: number, scale: number): void {
  const cols: RGB[] = [hex('#8a2010'), hex('#d85020'), hex('#f0a030'), hex('#fff0a0')];
  const sway = [0, 1, -1][frame % 3];
  for (let k = 0; k < 4; k++) {
    const r = (3 - k) * 1.1 * scale;
    s.pix.ellipse(x + (k > 1 ? sway : 0), y - k * 1.6 * scale, Math.max(0.8, r * 0.75), Math.max(1, r), () => cols[k]);
  }
}
