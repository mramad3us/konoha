/**
 * Procedural buildings: timber-framed plaster walls, lattice windows, a curtained doorway,
 * tiled gable roof, optional emblem. Footprint w×d tiles anchored on tile (x0, y0)'s center.
 */

import { hex, shade, ramp, OUTLINE, mix, type RGB } from './color.ts';
import { sprite, iso, type ArtSprite } from './draw.ts';
import { hash2 } from '../core/rng.ts';
import { TILE_W, TILE_H } from '../core/config.ts';

export interface BuildingStyle {
  wall: string;
  beam: string;
  roof: string;
  /** Wall height in px. */
  wallH: number;
  roofH: number;
  /** Door: which visible face and offset (tiles from the face's left end). */
  door: { face: 'sw' | 'se'; at: number } | null;
  curtain?: string;
  emblem?: keyof typeof EMBLEMS;
  /** Extra story band (taller buildings). */
  stories?: number;
}

export const BUILDING_STYLES: Record<string, BuildingStyle> = {
  house: { wall: '#d8cbb0', beam: '#5a4030', roof: '#3d4a5e', wallH: 22, roofH: 12, door: { face: 'sw', at: 1 } },
  house_red: { wall: '#d2c3a6', beam: '#5a3a2a', roof: '#7a3a2e', wallH: 22, roofH: 12, door: { face: 'sw', at: 1 } },
  house_green: { wall: '#dcd2bc', beam: '#4a4030', roof: '#4a5e3e', wallH: 22, roofH: 12, door: { face: 'se', at: 1 } },
  shop: { wall: '#e0d4b8', beam: '#5a4030', roof: '#3d4a5e', wallH: 24, roofH: 13, door: { face: 'sw', at: 1 }, curtain: '#2a4a8a', emblem: 'kunai' },
  ramen: { wall: '#dccaa8', beam: '#6a3a24', roof: '#8a3a2a', wallH: 22, roofH: 12, door: { face: 'sw', at: 1 }, curtain: '#c84a30', emblem: 'bowl' },
  hospital: { wall: '#e8e4dc', beam: '#7a7268', roof: '#5a6a78', wallH: 26, roofH: 13, door: { face: 'sw', at: 2 }, curtain: '#e8e4dc', emblem: 'cross', stories: 2 },
  tower: { wall: '#c8503c', beam: '#6a2a20', roof: '#9a3a2a', wallH: 40, roofH: 16, door: { face: 'sw', at: 2 }, curtain: '#e8e0d0', emblem: 'fire', stories: 2 },
  academy: { wall: '#d8b888', beam: '#6a4a30', roof: '#5a3a2e', wallH: 26, roofH: 13, door: { face: 'sw', at: 2 }, curtain: '#3a5a8a', emblem: 'scroll' },
  home: { wall: '#d4c8b0', beam: '#5a4030', roof: '#4a3e5a', wallH: 22, roofH: 12, door: { face: 'sw', at: 1 }, curtain: '#6a4a8a', emblem: 'leaf' },
  gatehouse: { wall: '#b8a888', beam: '#4a3828', roof: '#3a4250', wallH: 26, roofH: 12, door: null },
  shed: { wall: '#a88a64', beam: '#4a3828', roof: '#5a4a3a', wallH: 16, roofH: 9, door: { face: 'sw', at: 0 } },
};

/** 7×7 emblem glyphs. */
const EMBLEMS = {
  fire: ['...1...', '..1.1..', '.1...1.', '...1...', '..111..', '.1.1.1.', '1..1..1'],
  cross: ['..111..', '..111..', '1111111', '1111111', '1111111', '..111..', '..111..'],
  kunai: ['......1', '.....1.', '....1..', '...1...', '..1....', '11.....', '11.....'],
  bowl: ['.1.1.1.', '.......', '1111111', '1111111', '.11111.', '..111..', '.11111.'],
  scroll: ['1111111', '1.....1', '1.111.1', '1.....1', '1.111.1', '1.....1', '1111111'],
  leaf: ['...11..', '..1..1.', '.1.11.1', '.1.1..1', '..1..1.', '.1.11..', '1......'],
} as const;

export function buildingSize(w: number, d: number, st: BuildingStyle): { width: number; height: number; ax: number; ay: number } {
  const width = (w + d) * (TILE_W / 2) + 8;
  const top = st.wallH * (st.stories ?? 1) + st.roofH + TILE_H / 2 + 6;
  const height = top + (w + d - 1) * (TILE_H / 2) + 4;
  return { width, height, ax: d * (TILE_W / 2) + 4, ay: top };
}

export function drawBuilding(styleKey: string, w: number, d: number): ArtSprite {
  const st = BUILDING_STYLES[styleKey] ?? BUILDING_STYLES.house;
  const sz = buildingSize(w, d, st);
  const s = sprite(sz.width, sz.height, sz.ax, sz.ay);
  const P = (u: number, v: number, z: number): [number, number] => iso(s, u, v, z);
  const H = st.wallH * (st.stories ?? 1);
  const u0 = -0.5, u1 = w - 0.5, v0 = -0.5, v1 = d - 0.5;

  const wallL = ramp(st.wall), beam = ramp(st.beam), roof = ramp(st.roof);
  const leftLit = wallL[2], rightLit = shade(st.wall, -0.18);

  // Ground shadow (cast to the lower right).
  s.pix.poly([P(u1, v0, 0), P(u1 + 0.6, v0 + 0.2, 0), P(u1 + 0.6, v1 + 0.6, 0), P(u0 + 0.2, v1 + 0.6, 0), P(u0, v1, 0)], [10, 12, 20], 70);

  // ── Walls ──
  const face = (which: 'sw' | 'se') => {
    const len = which === 'sw' ? w : d;
    const base: RGB = which === 'sw' ? leftLit : rightLit;
    const at = (t: number, z: number) => (which === 'sw' ? P(u0 + t, v1, z) : P(u1, v0 + t, z));
    s.pix.poly([at(0, 0), at(len, 0), at(len, H), at(0, H)], (x, y) => {
      const n = hash2(x, y) % 100;
      return n < 6 ? shade(base, -0.06) : base;
    });
    // Stone foundation
    s.pix.poly([at(0, 0), at(len, 0), at(len, 3), at(0, 3)], (x, y) => (hash2(x, y) % 4 ? hex('#7a746a') : hex('#5f5a52')));
    // Timber frame: corner posts, studs every tile, beams at story lines and the top.
    const beamC = which === 'sw' ? beam[2] : beam[1];
    for (let t = 0; t <= len; t++) {
      const [x0, y0] = at(t, 3), [, y1] = at(t, H);
      for (let y = Math.round(y1); y <= Math.round(y0); y++) s.pix.set(Math.round(x0) - (t === len ? 1 : 0), y, beamC);
    }
    for (let k = 1; k <= (st.stories ?? 1); k++) {
      const z = k * st.wallH - 1;
      const [ax, ay] = at(0, z), [bx, by] = at(len, z);
      s.pix.line(Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by), beamC);
      s.pix.line(Math.round(ax), Math.round(ay) + 1, Math.round(bx), Math.round(by) + 1, beam[0]);
    }
    // Windows (one per tile, upper half), skipping the door slot.
    for (let story = 0; story < (st.stories ?? 1); story++) {
      for (let t = 0; t < len; t++) {
        const isDoor = st.door && st.door.face === which && t === st.door.at && story === 0;
        if (isDoor) continue;
        if (hash2(t * 7 + (which === 'sw' ? 1 : 2), story + w * 13 + d) % 4 === 0 && story === 0 && len > 1) continue;
        const zb = story * st.wallH + Math.round(st.wallH * 0.38), zt = story * st.wallH + Math.round(st.wallH * 0.78);
        const a = 0.28, b = 0.72;
        s.pix.poly([at(t + a, zb), at(t + b, zb), at(t + b, zt), at(t + a, zt)], hex('#2a2a36'));
        // lattice
        const [mx0, my0] = at(t + 0.5, zb), [, my1] = at(t + 0.5, zt);
        for (let y = Math.round(my1); y <= Math.round(my0); y++) s.pix.set(Math.round(mx0), y, beam[1]);
        const [lx, ly] = at(t + a, (zb + zt) / 2), [rx, ry] = at(t + b, (zb + zt) / 2);
        s.pix.line(Math.round(lx), Math.round(ly), Math.round(rx), Math.round(ry), beam[1]);
        // warm glow pixel
        const [gx, gy] = at(t + a + 0.08, zb + 2);
        s.pix.set(Math.round(gx), Math.round(gy), hex('#c8a060'));
      }
    }
    // Door
    if (st.door && st.door.face === which) {
      const t = st.door.at;
      const dz = Math.min(st.wallH - 4, 16);
      s.pix.poly([at(t + 0.18, 0), at(t + 0.82, 0), at(t + 0.82, dz), at(t + 0.18, dz)], hex('#2e2420'));
      s.pix.poly([at(t + 0.24, 0), at(t + 0.5, 0), at(t + 0.5, dz - 2), at(t + 0.24, dz - 2)], hex('#4a3a2e'));
      if (st.curtain) {
        const cc = ramp(st.curtain);
        s.pix.poly([at(t + 0.14, dz - 6), at(t + 0.86, dz - 6), at(t + 0.86, dz + 1), at(t + 0.14, dz + 1)], (x) => (Math.floor(x / 3) % 2 ? cc[2] : cc[3]));
      }
      if (st.emblem) {
        const [ex, ey] = at(t + 0.5, dz + 3);
        const g = EMBLEMS[st.emblem];
        const ec = st.emblem === 'cross' ? hex('#c83a3a') : st.emblem === 'fire' ? hex('#e8e0d0') : hex('#2a2a30');
        for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (g[j][i] === '1') s.pix.set(Math.round(ex) - 3 + i, Math.round(ey) - 9 + j, ec);
      }
    }
  };
  face('sw');
  face('se');

  // ── Roof (gable, ridge along the longer axis) ──
  const o = 0.32; // eave overhang in tiles
  const alongU = w >= d;
  const ridgeZ = H + st.roofH;
  const tileLines = (pts: Array<[number, number]>, base: RGB, dark: RGB, light: RGB) => {
    s.pix.poly(pts, (x, y) => {
      const k = (y + (alongU ? 0 : x >> 1)) % 4;
      return k === 0 ? dark : (hash2(x, y) % 23 === 0 ? light : base);
    });
  };
  if (alongU) {
    const vm = (v0 + v1) / 2;
    // back plane (−v side), then front plane (+v side), then the +u gable end
    tileLines([P(u0 - o, v0 - o, H - 2), P(u1 + o, v0 - o, H - 2), P(u1 + o, vm, ridgeZ), P(u0 - o, vm, ridgeZ)], roof[1], roof[0], roof[2]);
    tileLines([P(u0 - o, vm, ridgeZ), P(u1 + o, vm, ridgeZ), P(u1 + o, v1 + o, H - 2), P(u0 - o, v1 + o, H - 2)], roof[3], roof[1], roof[4]);
    s.pix.poly([P(u1, v0, H), P(u1, v1, H), P(u1, vm, ridgeZ - 2)], rightLit);
    s.pix.line(...P(u1, v0, H).map(Math.round) as [number, number], ...P(u1, vm, ridgeZ - 2).map(Math.round) as [number, number], beam[1]);
    s.pix.line(...P(u0 - o, vm, ridgeZ).map(Math.round) as [number, number], ...P(u1 + o, vm, ridgeZ).map(Math.round) as [number, number], roof[4]);
    // eave edges
    s.pix.line(...P(u0 - o, v1 + o, H - 2).map(Math.round) as [number, number], ...P(u1 + o, v1 + o, H - 2).map(Math.round) as [number, number], roof[0]);
    s.pix.line(...P(u1 + o, v1 + o, H - 2).map(Math.round) as [number, number], ...P(u1 + o, vm, ridgeZ).map(Math.round) as [number, number], mix(roof[0], roof[1], 0.5));
  } else {
    const um = (u0 + u1) / 2;
    tileLines([P(u0 - o, v0 - o, H - 2), P(u0 - o, v1 + o, H - 2), P(um, v1 + o, ridgeZ), P(um, v0 - o, ridgeZ)], roof[2], roof[0], roof[3]);
    tileLines([P(um, v0 - o, ridgeZ), P(um, v1 + o, ridgeZ), P(u1 + o, v1 + o, H - 2), P(u1 + o, v0 - o, H - 2)], roof[1], roof[0], roof[2]);
    s.pix.poly([P(u0, v1, H), P(u1, v1, H), P(um, v1, ridgeZ - 2)], leftLit);
    s.pix.line(...P(um, v0 - o, ridgeZ).map(Math.round) as [number, number], ...P(um, v1 + o, ridgeZ).map(Math.round) as [number, number], roof[4]);
    s.pix.line(...P(u0 - o, v1 + o, H - 2).map(Math.round) as [number, number], ...P(um, v1 + o, ridgeZ).map(Math.round) as [number, number], roof[0]);
    s.pix.line(...P(um, v1 + o, ridgeZ).map(Math.round) as [number, number], ...P(u1 + o, v1 + o, H - 2).map(Math.round) as [number, number], roof[0]);
  }
  s.pix.outline(OUTLINE, 230);
  return s;
}
