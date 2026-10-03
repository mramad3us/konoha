/**
 * The isometric renderer. Draws one Level at native pixel resolution into an offscreen buffer,
 * then scales it by an integer zoom onto the screen canvas.
 *
 * Order: terrain chunks → fog → decals → depth-sorted props/entities/building slices →
 * particles & projectiles → lighting → overlays (cones, icons, bars, floats, bubbles, cursor).
 */

import type { Game } from '../sim/game.ts';
import type { Level } from '../ecs/level.ts';
import type { EntityId } from '../ecs/components.ts';
import type { Vec } from '../core/geometry.ts';
import { screenFacing, DIR_VEC, dirFromDelta, chebyshev } from '../core/geometry.ts';
import { TILE_W, TILE_H, DEFAULT_ZOOM } from '../core/config.ts';
import { PROPS, T } from '../world/tiles.ts';
import { hash2 } from '../core/rng.ts';
import { TerrainCache } from './terrain.ts';
import { Visuals, type Vis } from './visuals.ts';
import { atlas, type Frame, type Variant } from './atlas.ts';
import { PROP_VARIANTS, CONNECTED, ANIMATED, MASK } from '../art/props.ts';
import { drawBuilding, BUILDING_STYLES } from '../art/buildings.ts';
import { iconPix, MOVE_COLOR } from '../art/icons.ts';
import { renderText } from '../art/font.ts';
import { Pix } from '../art/pix.ts';
import { hex, rgbCss, type RGB } from '../art/color.ts';
import type { Pose } from '../art/characters.ts';
import { ambientLight, lightSources, inCone, viewRange, lightAt } from '../sim/stealth.ts';
import { hasLos } from '../world/fov.ts';
import { isStanding } from '../sim/vitals.ts';
import { isHostile } from '../sim/factions.ts';

const HW = TILE_W / 2, HH = TILE_H / 2;

interface Drawable { depth: number; order: number; draw: () => void }

export interface Overlay {
  hover: Vec | null;
  aimTarget: EntityId | null;
  shadowStep: { range: number; cursor: Vec } | null;
  path: Vec[] | null;
  cones: boolean;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buf: OffscreenCanvas;
  private b: OffscreenCanvasRenderingContext2D;
  private light: OffscreenCanvas;
  private l: OffscreenCanvasRenderingContext2D;
  zoom = DEFAULT_ZOOM;
  bufW = 1;
  bufH = 1;
  camX = 0;
  camY = 0;
  private ox = 0;
  private oy = 0;
  private lastNow = 0;
  private snapped = false;
  readonly terrain = new TerrainCache();
  readonly visuals = new Visuals();
  overlay: Overlay = { hover: null, aimTarget: null, shadowStep: null, path: null, cones: false };
  /** Camera override (title screen fly-through); null follows the player. */
  focus: { x: number; y: number } | null = null;
  /** Hide HUD-like overlays (title screen). */
  bare = false;
  private diamond: OffscreenCanvas;
  private coneCache: { key: string; cells: Map<number, number> } = { key: '', cells: new Map() };
  private screenW = 1;
  private screenH = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.buf = new OffscreenCanvas(1, 1);
    this.b = this.buf.getContext('2d')!;
    this.light = new OffscreenCanvas(1, 1);
    this.l = this.light.getContext('2d')!;
    const d = new Pix(TILE_W, TILE_H);
    for (let py = 0; py < TILE_H; py++) {
      const half = py < HH ? 2 + py * 2 : 2 + (TILE_H - 1 - py) * 2;
      for (let px = HW - half; px < HW + half; px++) d.set(px, py, [255, 255, 255]);
    }
    this.diamond = d.toCanvas();
  }

  resize(cssW: number, cssH: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.screenW = Math.max(1, Math.floor(cssW * dpr));
    this.screenH = Math.max(1, Math.floor(cssH * dpr));
    this.canvas.width = this.screenW;
    this.canvas.height = this.screenH;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const z = this.zoom * dpr;
    this.bufW = Math.ceil(this.screenW / z);
    this.bufH = Math.ceil(this.screenH / z);
    this.buf.width = this.bufW; this.buf.height = this.bufH;
    this.light.width = this.bufW; this.light.height = this.bufH;
    this.b = this.buf.getContext('2d')!;
    this.l = this.light.getContext('2d')!;
  }

  setZoom(z: number): void {
    this.zoom = Math.max(2, Math.min(5, z));
    this.resize(this.screenW / (window.devicePixelRatio || 1), this.screenH / (window.devicePixelRatio || 1));
  }

  /** World pixel position of a (fractional) tile. */
  static iso(x: number, y: number): [number, number] {
    return [(x - y) * HW, (x + y) * HH];
  }

  /** Screen (CSS px relative to canvas) → tile. */
  screenToTile(cssX: number, cssY: number): Vec {
    const dpr = window.devicePixelRatio || 1;
    const bx = cssX * dpr / (this.zoom * dpr), by = cssY * dpr / (this.zoom * dpr);
    const wx = bx - this.ox, wy = by - this.oy;
    const fx = (wx / HW + wy / HH) / 2, fy = (wy / HH - wx / HW) / 2;
    return { x: Math.round(fx), y: Math.round(fy) };
  }

  snapCamera(): void { this.snapped = false; }

  draw(g: Game, now: number): void {
    const lv = g.level;
    const dt = Math.min(0.1, (now - (this.lastNow || now)) / 1000);
    this.lastNow = now;
    this.terrain.bind(lv);
    this.visuals.bind(lv);
    this.visuals.update(lv, now, dt);
    const V = this.visuals;
    const b = this.b;

    // ── Camera ──
    const pv = V.get(lv, lv.playerId);
    const [tx, ty] = this.focus ? Renderer.iso(this.focus.x, this.focus.y) : Renderer.iso(pv.x, pv.y);
    const targetX = tx, targetY = ty - 14;
    if (!this.snapped) { this.camX = targetX; this.camY = targetY; this.snapped = true; }
    const k = 1 - Math.exp(-dt * 10);
    this.camX += (targetX - this.camX) * k;
    this.camY += (targetY - this.camY) * k;
    let shx = 0, shy = 0;
    if (now < V.shakeUntil) { shx = (Math.random() - 0.5) * 2 * V.shakeMag; shy = (Math.random() - 0.5) * 2 * V.shakeMag; }
    this.ox = Math.round(this.bufW / 2 - this.camX + shx);
    this.oy = Math.round(this.bufH / 2 - this.camY + shy);
    const ox = this.ox, oy = this.oy;

    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.imageSmoothingEnabled = false;
    b.fillStyle = '#0b0b10';
    b.fillRect(0, 0, this.bufW, this.bufH);

    // ── Terrain ──
    const vx0 = -ox - 40, vy0 = -oy - 80, vx1 = -ox + this.bufW + 40, vy1 = -oy + this.bufH + 40;
    for (const c of this.terrain.visible(vx0, vy0, vx1, vy1)) b.drawImage(c.cv, c.x + ox, c.y + oy);

    // Visible tile range.
    const range = this.tileRange(lv, vx0, vy0, vx1, vy1 + 60);

    // ── Water shimmer; fog drawn into its own layer so diamond overlaps never double up ──
    const t = now / 1000;
    const fog = this.l;
    fog.setTransform(1, 0, 0, 1, 0, 0);
    fog.globalCompositeOperation = 'source-over';
    fog.globalAlpha = 1;
    fog.clearRect(0, 0, this.bufW, this.bufH);
    let anyFog = false;
    for (let y = range.y0; y <= range.y1; y++) for (let x = range.x0; x <= range.x1; x++) {
      const i = lv.idx(x, y);
      const sx = (x - y) * HW + ox, sy = (x + y) * HH + oy;
      if (sx < -HW || sx > this.bufW + HW || sy < -HH || sy > this.bufH + HH * 4) continue;
      if (lv.tiles[i] === T.void) continue;
      if (!lv.explored[i]) { b.drawImage(this.tinted('#0b0b10'), sx - HW, sy - HH); continue; }
      if (lv.visible[i] && lv.isWater(x, y)) {
        const h = hash2(x, y);
        const phase = (t * 0.8 + (h % 100) / 100) % 1;
        if (phase < 0.35) {
          b.fillStyle = 'rgba(220,240,255,0.55)';
          b.fillRect(sx - 6 + (h % 12), sy - 3 + ((h >> 4) % 6), 3, 1);
        }
      }
      if (!lv.visible[i]) { fog.drawImage(this.tinted('#141626'), sx - HW, sy - HH); anyFog = true; }
    }
    if (anyFog) {
      b.globalAlpha = 0.45;
      b.drawImage(this.light, 0, 0);
      b.globalAlpha = 1;
    }
    for (const d of V.fx.decals) {
      if (!lv.visible[lv.idx(Math.round(d.x), Math.round(d.y))]) continue;
      const [wx, wy] = Renderer.iso(d.x, d.y);
      this.decal(wx + ox, wy + oy, d.kind, d.seed);
    }

    // ── Drawables ──
    const list: Drawable[] = [];
    const animFrame = Math.floor(now / 140);
    for (let y = range.y0; y <= range.y1; y++) for (let x = range.x0; x <= range.x1; x++) {
      const i = lv.idx(x, y);
      const p = lv.props[i];
      if (!p || !lv.explored[i]) continue;
      const def = PROPS[p];
      const variants = PROP_VARIANTS[def.art] ?? 1;
      const variant = variants > 1 ? hash2(x * 31, y * 17) % variants : 0;
      const mask = CONNECTED.has(def.art) ? this.connectMask(lv, x, y, p) : 0;
      const anim = ANIMATED[def.art] ? animFrame % ANIMATED[def.art] : 0;
      const vis: Variant = lv.visible[i] ? 'normal' : 'dim';
      const f = atlas.prop(def.art, variant, mask, anim, vis);
      const [wx, wy] = Renderer.iso(x, y);
      list.push({ depth: x + y, order: def.cover ? 3 : 1, draw: () => this.blit(f, wx + ox, wy + oy) });
    }

    for (const id of lv.entities) {
      const pos = lv.c.pos.get(id);
      if (!pos) continue;
      const st = lv.c.structure.get(id);
      if (st) { this.pushBuilding(lv, id, list); continue; }
      if (pos.x < range.x0 - 2 || pos.x > range.x1 + 2 || pos.y < range.y0 - 2 || pos.y > range.y1 + 2) continue;
      const i = lv.idx(pos.x, pos.y);
      const isPlayer = id === lv.playerId;
      if (!lv.visible[i] && !isPlayer) continue;
      if (lv.c.carried.has(id)) continue;
      if (lv.c.brain.get(id)?.mode === 'inside') continue;
      const rev = lv.c.sprite.get(id)?.reveal;
      if (rev !== undefined) {
        const pp = lv.c.pos.get(lv.playerId);
        if (!pp || Math.max(Math.abs(pp.x - pos.x), Math.abs(pp.y - pos.y)) > rev) continue;
      }
      const inv = lv.c.invisible.get(id);
      if (inv && !isPlayer) {
        const pn = g.player.sheet.skills.ninjutsu;
        if (pn < inv.power + 5) continue;
      }
      const v = V.get(lv, id);
      const app = lv.c.appearance.get(id);
      const lungeOn = now < v.lungeUntil;
      const ex = v.x + (lungeOn ? v.lungeX : 0), ey = v.y + (lungeOn ? v.lungeY : 0);
      const [wx, wy] = Renderer.iso(ex, ey);
      if (app) {
        const frame = this.characterFrame(lv, id, v, now, inv ? 'ghost' : now < v.flashUntil ? 'flash' : 'normal');
        const carrying = lv.c.carrying.get(id);
        const down = lv.c.ko.has(id) || lv.c.dead.has(id);
        list.push({
          depth: ex + ey + (down ? -0.3 : 0), order: down ? 1 : 2,
          draw: () => {
            if (inv && isPlayer) b.globalAlpha = 0.55;
            this.blit(frame, wx + ox, wy + oy);
            b.globalAlpha = 1;
            if (carrying) {
              const ca = lv.c.appearance.get(carrying.target);
              if (ca) this.blit(atlas.character(ca, 'prone', false, false), wx + ox, wy + oy - 15);
            }
          },
        });
      } else {
        const sp = lv.c.sprite.get(id);
        const door = lv.c.door.get(id);
        if (!sp && !door) continue;
        const art = door ? (door.open ? 'door_open' : 'door_closed') : sp!.art;
        const f = art === 'dummy' || art.startsWith('item_') || art === 'log_decoy'
          ? atlas.prop(art, 0, 0, 0, now < v.flashUntil ? 'flash' : 'normal')
          : atlas.prop(art, 0, 0, 0);
        list.push({ depth: ex + ey, order: art.startsWith('item_') ? 0 : 2, draw: () => this.blit(f, wx + ox, wy + oy) });
      }
    }
    list.sort((a, c) => a.depth - c.depth || a.order - c.order);
    for (const d of list) d.draw();

    // ── Particles & projectiles ──
    for (const p of V.fx.particles) {
      const [wx, wy] = Renderer.iso(p.x, p.y);
      b.globalAlpha = p.fade ? Math.max(0, 1 - p.age / p.life) : 1;
      b.fillStyle = rgbCss(p.color);
      b.fillRect(Math.round(wx + ox), Math.round(wy + oy - p.z), p.size, p.size);
    }
    b.globalAlpha = 1;
    for (const pr of V.fx.projectiles) {
      const tt = Math.max(0, Math.min(1, (now - pr.t0) / pr.dur));
      const x = pr.fx + (pr.tx - pr.fx) * tt, y = pr.fy + (pr.ty - pr.fy) * tt;
      const arc = Math.sin(tt * Math.PI) * 6;
      const [wx, wy] = Renderer.iso(x, y);
      const f = atlas.prop(pr.weapon === 'kunai' ? 'item_kunai' : 'item_shuriken', 0, 0, 0);
      this.blit(f, wx + ox, wy + oy - 12 - arc);
    }

    // ── Lighting ──
    this.drawLighting(g, lv, now);

    // ── Overlays ──
    if (!this.bare) {
      if (this.overlay.cones) this.drawCones(g, lv);
      this.drawRings(now);
      this.drawPath();
      this.drawIcons(g, lv, now);
      this.drawFloats(now);
      this.drawBubbles(lv, now);
      this.drawCursor(lv);
    }

    // ── Present ──
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const z = this.zoom * (window.devicePixelRatio || 1);
    ctx.drawImage(this.buf, 0, 0, this.bufW, this.bufH, 0, 0, this.bufW * z, this.bufH * z);
  }

  // ── Helpers ──

  private tileRange(lv: Level, x0: number, y0: number, x1: number, y1: number) {
    const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([wx, wy]) => ({
      x: (wx / HW + wy / HH) / 2, y: (wy / HH - wx / HW) / 2,
    }));
    return {
      x0: Math.max(0, Math.floor(Math.min(...corners.map(c => c.x))) - 1),
      x1: Math.min(lv.width - 1, Math.ceil(Math.max(...corners.map(c => c.x))) + 1),
      y0: Math.max(0, Math.floor(Math.min(...corners.map(c => c.y))) - 1),
      y1: Math.min(lv.height - 1, Math.ceil(Math.max(...corners.map(c => c.y))) + 1),
    };
  }

  private tintCache = new Map<string, OffscreenCanvas>();
  private tinted(color: string): OffscreenCanvas {
    let c = this.tintCache.get(color);
    if (!c) {
      c = new OffscreenCanvas(TILE_W, TILE_H);
      const x = c.getContext('2d')!;
      x.drawImage(this.diamond, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, TILE_W, TILE_H);
      this.tintCache.set(color, c);
    }
    return c;
  }

  private blit(f: Frame, x: number, y: number): void {
    this.b.drawImage(f.cv, Math.round(x - f.ax), Math.round(y - f.ay));
  }

  private connectMask(lv: Level, x: number, y: number, p: number): number {
    let m = 0;
    if (lv.prop(x + 1, y) === p) m |= MASK.E;
    if (lv.prop(x, y + 1) === p) m |= MASK.S;
    if (lv.prop(x - 1, y) === p) m |= MASK.W;
    if (lv.prop(x, y - 1) === p) m |= MASK.N;
    return m;
  }

  private characterFrame(lv: Level, id: EntityId, v: Vis, now: number, variant: Variant): Frame {
    const app = lv.c.appearance.get(id)!;
    const pos = lv.c.pos.get(id)!;
    let pose: Pose = 'idle';
    let facing = pos.facing;
    if (lv.c.ko.has(id) || lv.c.dead.has(id) || lv.c.restrained.has(id)) pose = 'prone';
    else if (v.pose && now < v.poseUntil) pose = v.pose;
    else if (this.visuals.isMoving(v, now)) {
      pose = v.stepPhase ? 'walkA' : 'walkB';
      const d = dirFromDelta(v.tx - v.fx, v.ty - v.fy);
      if (d) facing = d;
    } else if (lv.c.signing.has(id)) pose = 'sign';
    else if (lv.c.actor.get(id)?.stance === 'sneak') pose = 'sneak';
    const { back, flip } = screenFacing(facing);
    return atlas.character(app, pose, pose === 'prone' ? false : back, flip, variant);
  }

  private pushBuilding(lv: Level, id: EntityId, list: Drawable[]): void {
    const pos = lv.c.pos.get(id)!;
    const st = lv.c.structure.get(id)!;
    const { x: x0, y: y0 } = pos;
    const { w, d } = st;
    let explored = false, visible = false;
    for (let y = y0; y < y0 + d; y++) for (let x = x0; x < x0 + w; x++) {
      const i = lv.idx(x, y);
      if (lv.explored[i]) explored = true;
      if (lv.visible[i]) visible = true;
    }
    // Footprint edges also count (walls are opaque, so interior cells are rarely "visible").
    for (let x = x0 - 1; x <= x0 + w; x++) for (const y of [y0 - 1, y0 + d]) if (lv.inBounds(x, y) && lv.visible[lv.idx(x, y)]) visible = true;
    for (let y = y0 - 1; y <= y0 + d; y++) for (const x of [x0 - 1, x0 + w]) if (lv.inBounds(x, y) && lv.visible[lv.idx(x, y)]) visible = true;
    if (!explored && !visible) return;
    const f = atlas.custom(`b:${st.style}:${w}:${d}`, () => drawBuilding(st.style, w, d), visible ? 'normal' : 'dim');
    const [wx, wy] = Renderer.iso(x0, y0);
    const left = Math.round(wx + this.ox - f.ax), top = Math.round(wy + this.oy - f.ay);
    // Fade when the player is tucked behind it.
    const pp = lv.c.pos.get(lv.playerId);
    let alpha = 1;
    if (pp && pp.x >= x0 - 1 && pp.y >= y0 - 1 && pp.x < x0 + w + 1 && pp.y < y0 + d + 1 && (pp.x < x0 || pp.y < y0 || (pp.x < x0 + w && pp.y < y0 + d))) {
      alpha = 0.45;
    } else if (pp && pp.x + pp.y < x0 + w + y0 + d - 2 && pp.x >= x0 - 2 && pp.y >= y0 - 2 && pp.x <= x0 + w && pp.y <= y0 + d) {
      const [px, py] = Renderer.iso(pp.x, pp.y);
      const sx = px + this.ox, sy = py + this.oy;
      if (sx > left && sx < left + f.w && sy - 20 > top && sy < top + f.h && (pp.x < x0 + w && pp.y < y0 + d)) alpha = 0.45;
    }
    void BUILDING_STYLES;
    const cMin = x0 - (y0 + d - 1), cMax = (x0 + w - 1) - y0;
    for (let c = cMin; c <= cMax; c++) {
      const xs = Math.max(x0, y0 + c), xe = Math.min(x0 + w - 1, y0 + d - 1 + c);
      if (xs > xe) continue;
      const depth = 2 * xe - c;
      const sl = c === cMin ? -1e4 : c * HW - HW / 2 - wx + f.ax;
      const sr = c === cMax ? 1e4 : c * HW + HW / 2 - wx + f.ax;
      const sx0 = Math.max(0, Math.round(sl)), sx1 = Math.min(f.w, Math.round(sr));
      if (sx1 <= sx0) continue;
      list.push({
        depth, order: 2.5,
        draw: () => {
          this.b.globalAlpha = alpha;
          this.b.drawImage(f.cv, sx0, 0, sx1 - sx0, f.h, left + sx0, top, sx1 - sx0, f.h);
          this.b.globalAlpha = 1;
        },
      });
    }
  }

  private decal(x: number, y: number, kind: string, seed: number): void {
    const b = this.b;
    const dots = kind === 'pool' ? 16 : 6;
    for (let k = 0; k < dots; k++) {
      const h = hash2(seed, k);
      const r = kind === 'pool' ? 5 : 3;
      const dx = ((h % 100) / 100 - 0.5) * r * 2, dy = (((h >> 7) % 100) / 100 - 0.5) * r;
      b.fillStyle = k % 3 ? '#6a1418' : '#8a2020';
      b.fillRect(Math.round(x + dx), Math.round(y + dy), kind === 'pool' ? 2 : 1, 1);
    }
  }

  private drawLighting(g: Game, lv: Level, now: number): void {
    const amb = ambientLight(g.hour);
    if (amb >= 0.99) return;
    const l = this.l;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, this.bufW, this.bufH);
    const dark = (1 - amb) * 0.82;
    l.fillStyle = `rgba(8,10,32,${dark})`;
    l.fillRect(0, 0, this.bufW, this.bufH);
    l.globalCompositeOperation = 'destination-out';
    const flick = 1 + Math.sin(now / 90) * 0.03;
    const glows: Array<[number, number, number]> = [];
    for (const s of lightSources(lv)) {
      const i = lv.idx(s.x, s.y);
      if (!lv.explored[i]) continue;
      const [wx, wy] = Renderer.iso(s.x, s.y);
      const sx = wx + this.ox, sy = wy + this.oy - 8;
      const r = s.r * TILE_W * 0.62 * flick;
      if (sx < -r || sy < -r || sx > this.bufW + r || sy > this.bufH + r) continue;
      const grad = l.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, 'rgba(0,0,0,0.95)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = grad;
      l.fillRect(sx - r, sy - r, r * 2, r * 2);
      glows.push([sx, sy, r]);
    }
    // The player always sees their immediate surroundings a little.
    const pv = this.visuals.get(lv, lv.playerId);
    const [px, py] = Renderer.iso(pv.x, pv.y);
    const pr = TILE_W * 2.2;
    const pg = l.createRadialGradient(px + this.ox, py + this.oy - 10, 0, px + this.ox, py + this.oy - 10, pr);
    pg.addColorStop(0, 'rgba(0,0,0,0.5)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = pg;
    l.fillRect(px + this.ox - pr, py + this.oy - 10 - pr, pr * 2, pr * 2);
    const b = this.b;
    b.drawImage(this.light, 0, 0);
    b.globalCompositeOperation = 'lighter';
    for (const [sx, sy, r] of glows) {
      const gr = b.createRadialGradient(sx, sy, 0, sx, sy, r * 0.6);
      gr.addColorStop(0, `rgba(255,150,60,${0.22 * (1 - amb)})`);
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      b.fillStyle = gr;
      b.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    b.globalCompositeOperation = 'source-over';
    void lightAt;
  }

  /** Tiles watched by nearby unaware/suspicious enemies (shown while sneaking). */
  private drawCones(g: Game, lv: Level): void {
    const key = `${g.clock}:${lv.id}`;
    if (this.coneCache.key !== key) {
      const cells = new Map<number, number>();
      const pp = lv.c.pos.get(lv.playerId);
      for (const [id, aw] of lv.c.aware) {
        if (!isStanding(lv, id) || !isHostile(lv, id, lv.playerId)) continue;
        const p = lv.c.pos.get(id)!;
        if (!pp || chebyshev(p, pp) > 14 || !lv.visible[lv.idx(p.x, p.y)]) continue;
        if (lv.c.brain.get(id)?.sleeping) continue;
        const r = Math.ceil(viewRange(lightAt(g, lv, p.x, p.y)));
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = p.x + dx, y = p.y + dy;
          if (!lv.inBounds(x, y) || dx * dx + dy * dy > r * r) continue;
          if (!inCone(lv, id, { x, y }) || !hasLos(lv, p.x, p.y, x, y)) continue;
          const i = lv.idx(x, y);
          cells.set(i, Math.max(cells.get(i) ?? 0, aw.state === 'idle' ? 1 : 2));
        }
      }
      this.coneCache = { key, cells };
    }
    const b = this.b;
    for (const [i, lvl] of this.coneCache.cells) {
      const x = i % lv.width, y = Math.floor(i / lv.width);
      if (!lv.visible[i]) continue;
      const [wx, wy] = Renderer.iso(x, y);
      b.globalAlpha = lvl === 1 ? 0.13 : 0.22;
      b.drawImage(this.tinted(lvl === 1 ? '#ffe070' : '#ff5040'), wx + this.ox - HW, wy + this.oy - HH);
    }
    b.globalAlpha = 1;
  }

  private drawRings(now: number): void {
    const b = this.b;
    for (const r of this.visuals.fx.rings) {
      const t = (now - r.t0) / r.dur;
      if (t <= 0.02) continue;
      const [wx, wy] = Renderer.iso(r.x, r.y);
      b.strokeStyle = `rgba(230,230,240,${0.35 * (1 - t)})`;
      b.lineWidth = 1;
      b.beginPath();
      b.ellipse(Math.round(wx + this.ox) + 0.5, Math.round(wy + this.oy) + 0.5, r.r * HW * t, r.r * HH * t, 0, 0, Math.PI * 2);
      b.stroke();
    }
  }

  private drawPath(): void {
    const path = this.overlay.path;
    if (!path) return;
    const b = this.b;
    b.fillStyle = 'rgba(240,220,160,0.75)';
    for (const p of path) {
      const [wx, wy] = Renderer.iso(p.x, p.y);
      b.fillRect(Math.round(wx + this.ox) - 1, Math.round(wy + this.oy) - 1, 2, 2);
    }
  }

  private iconCache = new Map<string, OffscreenCanvas>();
  private icon(name: string, color: RGB): OffscreenCanvas {
    const key = name + color.join(',');
    let c = this.iconCache.get(key);
    if (!c) { c = iconPix(name, color).toCanvas(); this.iconCache.set(key, c); }
    return c;
  }

  private drawIcons(g: Game, lv: Level, now: number): void {
    const b = this.b;
    for (const [id, aw] of lv.c.aware) {
      const pos = lv.c.pos.get(id);
      if (!pos || !lv.visible[lv.idx(pos.x, pos.y)] || !isStanding(lv, id)) continue;
      if (lv.c.invisible.has(id) && g.player.sheet.skills.ninjutsu < (lv.c.invisible.get(id)!.power + 5)) continue;
      const v = this.visuals.get(lv, id);
      const [wx, wy] = Renderer.iso(v.x, v.y);
      const x = Math.round(wx + this.ox), y = Math.round(wy + this.oy) - 34;
      const pop = Math.max(0, 1 - (now - v.awarePop) / 250);
      const c = lv.c.combat.get(id);
      // Committed intent against the player.
      if (c?.intent && c.intentTarget === lv.playerId) {
        if (c.reveal === 'clear') b.drawImage(this.icon(c.intent, MOVE_COLOR[c.intent]), x - 4, y - 4);
        else if (c.reveal === 'partial' && c.revealAlt) {
          const pair = [c.intent, c.revealAlt].sort();
          b.drawImage(this.icon(pair[0], MOVE_COLOR[pair[0] as 'strike']), x - 9, y - 4);
          b.drawImage(this.icon(pair[1], MOVE_COLOR[pair[1] as 'strike']), x, y - 4);
        } else b.drawImage(this.icon('hidden', hex('#c8c0d0')), x - 4, y - 4);
      } else if (aw.state === 'alert') {
        b.drawImage(this.icon('alert', hex('#ff4a3a')), x - 4, y - 4 - Math.round(pop * 4));
      } else if (aw.state === 'suspicious' || aw.state === 'searching') {
        b.drawImage(this.icon('question', aw.state === 'searching' ? hex('#ff9a3a') : hex('#ffd84a')), x - 4, y - 4 - Math.round(pop * 4));
        // awareness meter
        b.fillStyle = '#1a1620'; b.fillRect(x - 4, y + 6, 9, 2);
        b.fillStyle = '#ffd84a'; b.fillRect(x - 4, y + 6, Math.round(9 * Math.min(1, aw.level / 100)), 2);
      } else if (aw.level > 5) {
        b.fillStyle = '#1a1620'; b.fillRect(x - 4, y + 6, 9, 2);
        b.fillStyle = '#c8c0a0'; b.fillRect(x - 4, y + 6, Math.round(9 * Math.min(1, aw.level / 100)), 2);
      }
      // HP bar for hurt enemies
      const vt = lv.c.vitals.get(id);
      if (vt && vt.hp < vt.hpMax) {
        const w = 12;
        b.fillStyle = '#1a1620'; b.fillRect(x - 6, y + 9, w, 2);
        b.fillStyle = vt.hp / vt.hpMax > 0.5 ? '#7ac35a' : vt.hp / vt.hpMax > 0.25 ? '#e0b040' : '#e04a3a';
        b.fillRect(x - 6, y + 9, Math.max(1, Math.round(w * vt.hp / vt.hpMax)), 2);
      }
      void DIR_VEC;
    }
  }

  private drawFloats(now: number): void {
    const b = this.b;
    for (const f of this.visuals.fx.floats) {
      if (now < f.t0) continue;
      const t = (now - f.t0) / f.dur;
      const [wx, wy] = Renderer.iso(f.x, f.y);
      const fr = atlas.text(f.text, f.color);
      const rise = Math.round(Math.min(1, t * 2.5) * (f.big ? 10 : 8) + t * 6);
      b.globalAlpha = t > 0.75 ? Math.max(0, 1 - (t - 0.75) * 4) : 1;
      b.drawImage(fr.cv, Math.round(wx + this.ox - fr.w / 2), Math.round(wy + this.oy - 30 - rise));
      b.globalAlpha = 1;
    }
  }

  private drawBubbles(lv: Level, now: number): void {
    const b = this.b;
    for (const bub of this.visuals.fx.bubbles) {
      const pos = lv.c.pos.get(bub.id);
      if (!pos || !lv.visible[lv.idx(pos.x, pos.y)]) continue;
      const v = this.visuals.get(lv, bub.id);
      const [wx, wy] = Renderer.iso(v.x, v.y);
      const fr = atlas.custom(`bubble:${bub.text}`, () => {
        const txt = renderText(bub.text, [30, 26, 34], null);
        const p = new Pix(txt.w + 4, txt.h + 5);
        p.rect(1, 0, txt.w + 2, txt.h + 2, [240, 234, 220]);
        p.rect(0, 1, txt.w + 4, txt.h, [240, 234, 220]);
        p.set(4, txt.h + 2, [240, 234, 220]); p.set(4, txt.h + 3, [240, 234, 220]); p.set(5, txt.h + 2, [240, 234, 220]);
        p.blit(txt, 2, 1);
        p.outline([30, 26, 34]);
        return { pix: p, ax: 4, ay: p.h };
      });
      const t = (now - bub.t0) / bub.dur;
      b.globalAlpha = t > 0.85 ? Math.max(0, 1 - (t - 0.85) * 6.6) : 1;
      this.blit(fr, wx + this.ox + 2, wy + this.oy - 30);
      b.globalAlpha = 1;
    }
  }

  private drawCursor(lv: Level): void {
    const b = this.b;
    const ss = this.overlay.shadowStep;
    if (ss) {
      const pp = lv.c.pos.get(lv.playerId)!;
      for (let dy = -ss.range; dy <= ss.range; dy++) for (let dx = -ss.range; dx <= ss.range; dx++) {
        const x = pp.x + dx, y = pp.y + dy;
        if (!lv.inBounds(x, y) || !lv.visible[lv.idx(x, y)] || !lv.isFree(x, y)) continue;
        const [wx, wy] = Renderer.iso(x, y);
        b.globalAlpha = 0.12;
        b.drawImage(this.tinted('#b080ff'), wx + this.ox - HW, wy + this.oy - HH);
      }
      b.globalAlpha = 1;
      this.outlineTile(ss.cursor, '#d0a0ff');
    }
    if (this.overlay.aimTarget !== null) {
      const p = lv.c.pos.get(this.overlay.aimTarget);
      if (p) this.outlineTile(p, '#ff6a4a');
    }
    if (this.overlay.hover && lv.inBounds(this.overlay.hover.x, this.overlay.hover.y) && lv.explored[lv.idx(this.overlay.hover.x, this.overlay.hover.y)]) {
      this.outlineTile(this.overlay.hover, 'rgba(255,240,200,0.55)');
    }
  }

  private outlineTile(t: Vec, color: string): void {
    const b = this.b;
    const [wx, wy] = Renderer.iso(t.x, t.y);
    const x = Math.round(wx + this.ox), y = Math.round(wy + this.oy);
    b.fillStyle = color;
    for (let k = 0; k < HW; k += 1) {
      const dy = Math.floor(k / 2);
      b.fillRect(x - HW + k, y - dy, 1, 1);
      b.fillRect(x + HW - 1 - k, y - dy, 1, 1);
      b.fillRect(x - HW + k, y + dy - 1, 1, 1);
      b.fillRect(x + HW - 1 - k, y + dy - 1, 1, 1);
    }
  }
}
