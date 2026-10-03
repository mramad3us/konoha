/** Dev-only: renders every art asset on one page for visual QA (tools/shot.mjs). */
import { drawProp, PROP_VARIANTS, CONNECTED, ANIMATED } from '../art/props.ts';
import { drawCharacter, POSES } from '../art/characters.ts';
import { tilePixel } from '../art/terrain.ts';
import { T } from '../world/tiles.ts';
import { Rng } from '../core/rng.ts';
import { leafLook, banditLook, rogueLook, anbuLook, civilianLook } from '../content/looks.ts';
import type { ArtSprite } from '../art/draw.ts';
import { drawBuilding } from '../art/buildings.ts';

const params = new URLSearchParams(location.search);
const section = params.get('s') ?? 'all';
const SCALE = Number(params.get('z') ?? 3);
const W = Math.floor(1600 / SCALE), H = Math.floor(900 / SCALE);
const cv = document.getElementById('c') as HTMLCanvasElement;
cv.width = W; cv.height = H;
cv.style.width = `${W * SCALE}px`; cv.style.height = `${H * SCALE}px`;
const ctx = cv.getContext('2d')!;
ctx.fillStyle = '#3a3f47'; ctx.fillRect(0, 0, W, H);

function blit(s: ArtSprite, x: number, y: number) {
  ctx.drawImage(s.pix.toCanvas(), Math.round(x - s.ax), Math.round(y - s.ay));
}

let cx = 20, cy = 40;
function next(w: number, rowH: number) { cx += w; if (cx > W - 30) { cx = 20; cy += rowH; } }

if (section === 'all' || section === 'chars') {
  const r = new Rng(5);
  const looks = [leafLook(r, 'm', false), leafLook(r, 'f', true), banditLook(r), rogueLook(r, true), anbuLook(r), civilianLook(r, 'f'), leafLook(r, 'f', false), civilianLook(r, 'm')];
  looks[0].hair = 'spiky'; looks[1].hair = 'ponytail'; looks[6].hair = 'buns';
  for (const a of looks) {
    for (const back of [false, true]) {
      for (const pose of POSES) {
        if (back && pose === 'prone') continue;
        blit(drawCharacter(a, pose, back), cx, cy);
        cx += 24;
      }
      cx += 8;
    }
    cx = 20; cy += 34;
  }
}
if (section === 'all' || section === 'props') {
  cx = 20; cy += 50;
  for (const [art, n] of Object.entries({ ...PROP_VARIANTS, lantern: 1, torch: 1, campfire: 1, tent: 1, bedroll: 1, well: 1, bench: 1, post: 1, target: 1, sign: 1, stall: 2, planter: 1, cliff: 2, dummy: 1, item_kunai: 1, item_shuriken: 1 })) {
    for (let v = 0; v < n; v++) {
      const s = drawProp(art, v, 0, 0);
      blit(s, cx + s.ax, cy);
      next(s.pix.w + 4, 54);
    }
  }
  for (const art of CONNECTED) for (const m of [1, 2, 5, 10, 15]) { const s = drawProp(art, 0, m, 0); blit(s, cx + s.ax, cy); next(s.pix.w + 4, 54); }
  void ANIMATED;
}
if (section === 'all' || section === 'terrain') {
  // A little 10×6 terrain patch per type pair to show textures and blending.
  const types = [T.grass, T.grass_lush, T.dirt, T.road, T.plaza, T.sand, T.planks, T.shallow, T.deep, T.field, T.forest_floor, T.rock];
  const ox = section === "terrain" ? 260 : 200, oy = section === "terrain" ? 40 : cy + 60;
  const map: number[][] = [];
  const N = 12;
  for (let y = 0; y < N; y++) { map.push([]); for (let x = 0; x < N; x++) map[y].push(types[(Math.floor(x / 3) + Math.floor(y / 3) * 4) % types.length]); }
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = ox + (x - y) * 16, sy = oy + (x + y) * 8;
    for (let py = 0; py < 16; py++) {
      const half = py < 8 ? 2 + py * 2 : 2 + (15 - py) * 2;
      for (let px = 16 - half; px < 16 + half; px++) {
        const dx = px - 16 + 0.5, dy = py - 8 + 0.5;
        const gx = (dx / 16 + dy / 8) / 2, gy = (dy / 8 - dx / 16) / 2;
        const X = sx - 16 + px, Y = sy - 8 + py;
        const c = tilePixel(map[y][x], gx, gy, x + gx + 0.5, y + gy + 0.5, X, Y, (ddx, ddy) => map[y + ddy]?.[x + ddx] ?? map[y][x]);
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const i = (Y * W + X) * 4;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
if (section === 'buildings') {
  const list: Array<[string, number, number]> = [['house', 3, 2], ['house_red', 2, 3], ['shop', 3, 3], ['ramen', 2, 2], ['hospital', 5, 3], ['tower', 4, 4], ['academy', 5, 3], ['home', 3, 2], ['shed', 2, 1]];
  let x = 80, y = 140;
  for (const [st, w, d] of list) {
    const b = drawBuilding(st, w, d);
    if (x + b.pix.w > W) { x = 80; y += 150; }
    blit(b, x + b.ax, y);
    x += b.pix.w + 20;
  }
}
console.log('[qa] art sheet ready');
