/**
 * Travel: an ink-on-washi map of the Land of Fire. The route is drawn in vermilion as you go;
 * your little figure walks it while the clock turns. Any key speeds it up.
 */

import type { Game } from '../sim/game.ts';
import type { Journey } from '../sim/journey.ts';
import { PLACES, place, TRAVEL_KMH } from '../content/world.ts';
import { Pix } from '../art/pix.ts';
import { hex, shade, mix, type RGB } from '../art/color.ts';
import { hash2 } from '../core/rng.ts';
import { fbm } from '../world/gen/noise.ts';
import { renderText } from '../art/font.ts';
import { atlas } from '../render/atlas.ts';
import { h, seal, wait } from './kit.ts';
import { TICKS_PER_HOUR, TICKS_PER_DAY } from '../core/config.ts';

const W = 320, H = 200;
const PAPER = hex('#e6d8b8'), PAPER_D = hex('#d2c29c'), INK = hex('#2a2420'), INK_L = hex('#6a5e50');
const FOREST = hex('#5f7a44'), FOREST_D = hex('#465e34'), WATER = hex('#3e5878'), RED = hex('#b3302a');

let baseMap: OffscreenCanvas | null = null;

function drawBase(): OffscreenCanvas {
  const p = new Pix(W, H);
  // Paper with fibers and a darker rim.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = fbm(x, y, 18, 7, 3);
    const rim = Math.min(x, y, W - 1 - x, H - 1 - y);
    let c: RGB = mix(PAPER, PAPER_D, n * 0.6 + (rim < 8 ? (8 - rim) / 12 : 0));
    if (hash2(x, y) % 97 === 0) c = shade(c, -0.08);
    p.set(x, y, c);
  }
  // Mountains to the west and north: hatched ridges.
  for (let k = 0; k < 70; k++) {
    const hh = hash2(k, 991);
    const x = (hh % 90) + 18 + (k % 3) * 4, y = ((hh >> 8) % 120) + 20;
    if (fbm(x, y, 30, 5) < 0.45) continue;
    const s = 4 + (hh >> 16) % 4;
    for (let i = 0; i <= s; i++) { p.set(x - s + i, y - i, INK_L); p.set(x + s - i, y - i, INK); }
    for (let i = 1; i < s; i += 2) p.set(x + s - i - 1, y - i + 1, INK_L);
  }
  // Forest stipple.
  for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
    const f = fbm(x, y, 22, 11, 3);
    if (f > 0.55 && hash2(x * 3, y * 7) % (f > 0.66 ? 3 : 6) === 0) {
      p.set(x, y, hash2(x, y) % 3 ? FOREST : FOREST_D);
      if (hash2(x + 1, y) % 4 === 0) p.set(x, y + 1, FOREST_D);
    }
  }
  // Rivers: two meandering ink lines.
  const river = (x0: number, y0: number, dx: number, dy: number, seed: number) => {
    let x = x0, y = y0;
    for (let k = 0; k < 260; k++) {
      x += dx + (fbm(k, seed, 9, seed) - 0.5) * 1.6;
      y += dy + (fbm(seed, k, 9, seed + 1) - 0.5) * 1.6;
      p.set(Math.round(x), Math.round(y), WATER);
      p.set(Math.round(x) + 1, Math.round(y), shade(WATER, 0.2));
      if (x < 2 || y < 2 || x > W - 3 || y > H - 3) break;
    }
  };
  river(200, 4, 0.15, 0.9, 3);
  river(150, 196, 0.55, -0.35, 9);
  // Roads from Konoha to every place: dashed ink.
  const k = place('konoha');
  for (const pl of PLACES) {
    if (pl.id === 'konoha') continue;
    const pts = routePoints(k, pl);
    pts.forEach((q, i) => { if (i % 4 < 2) p.set(Math.round(q[0]), Math.round(q[1]), INK_L); });
  }
  // Place markers and names.
  for (const pl of PLACES) {
    const r = pl.id === 'konoha' ? 3 : 2;
    p.ellipse(pl.x, pl.y, r + 0.5, r + 0.5, () => INK);
    p.ellipse(pl.x, pl.y, r - 0.5, r - 0.5, () => (pl.id === 'konoha' ? RED : PAPER));
    const t = renderText(pl.name, INK, PAPER);
    const tx = Math.min(W - t.w - 3, Math.max(3, pl.x - t.w / 2));
    p.blit(t, Math.round(tx), pl.y + 4);
  }
  // Border of the map.
  for (let x = 2; x < W - 2; x++) { p.set(x, 2, INK); p.set(x, H - 3, INK); }
  for (let y = 2; y < H - 2; y++) { p.set(2, y, INK); p.set(W - 3, y, INK); }
  return p.toCanvas();
}

/** A gently curved path between two places, as pixel points. */
function routePoints(a: { x: number; y: number }, b: { x: number; y: number }): Array<[number, number]> {
  const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.12, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
  const out: Array<[number, number]> = [];
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 1.3);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([(1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x, (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y]);
  }
  return out;
}

function clockText(tick: number): string {
  const day = Math.floor(tick / TICKS_PER_DAY) + 1;
  const hr = Math.floor((tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
  const mn = Math.floor(((tick % TICKS_PER_HOUR) / TICKS_PER_HOUR) * 60);
  return `Day ${day}, ${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

export class TravelView {
  private el: HTMLDivElement;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private info: HTMLDivElement;
  private stampBox: HTMLDivElement;
  private fast = false;
  private readonly onKey = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); this.fast = true; };

  constructor(root: HTMLElement) {
    this.el = h('div', 'travel');
    this.cv = document.createElement('canvas');
    this.cv.width = W; this.cv.height = H;
    this.cv.className = 'travel__map';
    this.ctx = this.cv.getContext('2d')!;
    this.info = h('div', 'travel__info');
    this.stampBox = h('div', 'travel__stamp');
    const frame = h('div', 'travel__frame', this.cv, this.stampBox);
    this.el.append(frame, this.info);
    root.appendChild(this.el);
    window.addEventListener('keydown', this.onKey, true);
    this.el.addEventListener('mousedown', () => { this.fast = true; });
    requestAnimationFrame(() => this.el.classList.add('travel--in'));
    const fit = () => {
      const s = Math.max(1, Math.floor(Math.min((window.innerWidth - 40) / W, (window.innerHeight - 140) / H)));
      this.cv.style.width = `${W * s}px`; this.cv.style.height = `${H * s}px`;
    };
    fit();
  }

  close(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
  }

  async show(g: Game, j: Journey, fromKm: number, toKm: number): Promise<void> {
    baseMap ??= drawBase();
    this.fast = false;
    const dest = place(j.dest), home = place('konoha');
    const a = j.dir === 'out' ? home : dest, b = j.dir === 'out' ? dest : home;
    const pts = routePoints(a, b);
    const endClock = g.clock;
    const startClock = endClock - Math.round(((toKm - fromKm) / TRAVEL_KMH) * TICKS_PER_HOUR);
    const dur = Math.min(3200, 1200 + (toKm - fromKm) * 45);
    const fig = atlas.character(g.player.appearance, 'walkA', false, j.dir === 'out' ? dest.x > home.x : home.x > dest.x);
    const fig2 = atlas.character(g.player.appearance, 'walkB', false, j.dir === 'out' ? dest.x > home.x : home.x > dest.x);
    const t0 = performance.now();
    for (;;) {
      const now = performance.now();
      const t = Math.min(1, (now - t0) / (this.fast ? dur / 6 : dur));
      const km = fromKm + (toKm - fromKm) * t;
      const frac = km / j.km;
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(baseMap, 0, 0);
      // Route so far, in vermilion.
      const upto = Math.floor(frac * (pts.length - 1));
      ctx.fillStyle = '#b3302a';
      for (let i = 0; i <= upto; i++) ctx.fillRect(Math.round(pts[i][0]), Math.round(pts[i][1]), 1, 1);
      for (let i = 0; i <= upto; i += 2) ctx.fillRect(Math.round(pts[i][0]), Math.round(pts[i][1]) + 1, 1, 1);
      // Night tint.
      const tick = startClock + (endClock - startClock) * t;
      const hour = (tick % TICKS_PER_DAY) / TICKS_PER_HOUR;
      const night = hour >= 20 || hour < 5 ? 0.3 : hour >= 18 || hour < 7 ? 0.15 : 0;
      if (night) { ctx.fillStyle = `rgba(20,24,60,${night})`; ctx.fillRect(0, 0, W, H); }
      // Walker.
      const [px, py] = pts[Math.min(pts.length - 1, upto)];
      const f = Math.floor(now / 180) % 2 ? fig : fig2;
      ctx.drawImage(f.cv, Math.round(px - f.ax / 2), Math.round(py - f.ay / 2), f.w / 2, f.h / 2);
      const left = Math.max(0, j.km - km);
      this.info.textContent = '';
      this.info.append(
        h('span', 'travel__where', j.dir === 'out' ? `To ${dest.name}` : `Home to Konohagakure`),
        h('span', 'travel__clock', clockText(tick)),
        h('span', 'travel__left', left > 0.5 ? `${Math.round(left)} km to go` : 'Arriving'),
        h('span', 'travel__hint', 'Any key to hurry'),
      );
      if (t >= 1) break;
      await new Promise(r => requestAnimationFrame(r));
    }
    await wait(this.fast ? 80 : 300);
  }

  async stamp(text: string): Promise<void> {
    this.stampBox.innerHTML = '';
    this.stampBox.append(seal(text, { tilt: -8 }));
    this.stampBox.classList.add('travel__stamp--on');
    await wait(900);
  }
}
