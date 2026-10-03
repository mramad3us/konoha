/**
 * Away-mission map generation: bounded forest with a winding trail from the entry edge to an
 * objective site (camp, outpost, ruin), stealth cover, optional river, and enemy placement by role.
 */

import { Level } from '../../ecs/level.ts';
import type { EntityId } from '../../ecs/components.ts';
import type { Game } from '../../sim/game.ts';
import { Rng } from '../../core/rng.ts';
import type { Vec } from '../../core/geometry.ts';
import { T, P } from '../tiles.ts';
import { fbm } from './noise.ts';
import { findPath } from '../path.ts';
import { spawnArchetype } from '../../sim/spawn.ts';
import { dirTo } from '../../core/geometry.ts';

export type Biome = 'forest' | 'plains' | 'riverside' | 'rocky';

export interface SiteSpec {
  kind: 'camp' | 'outpost' | 'none';
  /** Enemy archetypes for this site, by role. */
  leader?: string;
  guards: string[];
  patrols: string[];
  campers: string[];
}

export interface MissionMapSpec {
  id: string;
  name: string;
  seed: number;
  size: number;
  biome: Biome;
  site: SiteSpec;
  /** Hour of arrival (sleepers at night). */
  hour: number;
}

export interface MissionMapResult {
  level: Level;
  start: Vec;
  siteCenter: Vec;
  leader: EntityId | null;
  enemies: EntityId[];
}

export function generateMissionMap(g: Game, spec: MissionMapSpec): MissionMapResult {
  const rng = new Rng(spec.seed);
  const N = spec.size;
  const lv = new Level(spec.id, 'mission', N, N, { name: spec.name });
  const seed = spec.seed;

  // ── Ground ──
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = fbm(x, y, 14, seed, 3);
    let t: number = T.grass;
    if (spec.biome === 'forest') t = n > 0.56 ? T.forest_floor : n > 0.42 ? T.grass_lush : T.grass;
    else if (spec.biome === 'rocky') t = n > 0.6 ? T.rock : n > 0.45 ? T.dirt : T.grass;
    else t = n > 0.62 ? T.grass_lush : T.grass;
    lv.tiles[y * N + x] = t;
  }

  // ── River: a meandering band across the middle, 1–2 tiles deep with shallow banks ──
  const hasRiver = spec.biome === 'riverside' || (spec.biome === 'forest' && rng.chance(0.35));
  if (hasRiver) {
    let ry = Math.floor(N * (0.42 + rng.next() * 0.12));
    let drift = 0;
    for (let x = 0; x < N; x++) {
      drift += (rng.next() - 0.5) * 0.6;
      drift = Math.max(-0.8, Math.min(0.8, drift));
      ry = Math.max(Math.floor(N * 0.3), Math.min(Math.floor(N * 0.65), Math.round(ry + drift)));
      const deep = fbm(x, 0, 8, seed + 9) > 0.55 ? 2 : 1;
      for (let d = -deep - 2; d <= deep + 1; d++) {
        const y = ry + d;
        if (!lv.inBounds(x, y)) continue;
        const a = d < 0 ? -d - 1 : d;
        lv.setTile(x, y, a < deep ? T.deep : a < deep + 1 ? T.shallow : T.sand);
      }
    }
  }

  // ── Site & start ──
  const start: Vec = { x: Math.floor(N / 2) + rng.int(-4, 4), y: N - 6 };
  const siteCenter: Vec = { x: rng.int(Math.floor(N * 0.3), Math.floor(N * 0.7)), y: rng.int(8, Math.floor(N * 0.32)) };

  // Clear the exit zone (entry edge).
  const ez = { x0: start.x - 3, y0: N - 2, x1: start.x + 3, y1: N - 1 };
  lv.meta.exitZone = ez;

  // ── Trees (density by noise), border wall ──
  const border = 3;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const edge = Math.min(x, y, N - 1 - x, N - 1 - y);
    const inExit = x >= ez.x0 - 1 && x <= ez.x1 + 1 && y >= N - border - 2;
    if (lv.isWater(x, y)) continue;
    const dense = fbm(x, y, 9, seed + 77, 2);
    let treeChance = spec.biome === 'plains' ? 0.04 : spec.biome === 'rocky' ? 0.06 : 0.05 + Math.max(0, dense - 0.45) * 1.1;
    if (edge < border && !inExit) treeChance = 0.85;
    if (Math.hypot(x - siteCenter.x, y - siteCenter.y) < 9) treeChance = 0;
    if (Math.hypot(x - start.x, y - start.y) < 3) treeChance = 0;
    if (rng.chance(treeChance)) {
      const kind = spec.biome === 'rocky' && rng.chance(0.4) ? P.rock_large
        : lv.tile(x, y) === T.forest_floor ? (rng.chance(0.65) ? P.tree_pine : P.tree_broad)
        : rng.chance(0.25) ? P.tree_pine : rng.chance(0.07) ? P.tree_dead : P.tree_broad;
      lv.setProp(x, y, kind);
    }
  }

  // ── Trail from the start to the site ──
  const trail = findPath(lv, start, siteCenter, { avoidActors: false, water: true, limit: 20000 }) ?? [];
  const onTrail = new Set<number>();
  for (const p of [start, ...trail]) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
      const x = p.x + dx, y = p.y + dy;
      if (!lv.inBounds(x, y)) continue;
      onTrail.add(lv.idx(x, y));
      if (lv.isWater(x, y) === 2) lv.setTile(x, y, T.planks);
      else if (!lv.isWater(x, y)) lv.setTile(x, y, T.dirt);
      if (lv.prop(x, y)) lv.setProp(x, y, P.none);
    }
  }
  for (let y = start.y; y < N; y++) for (let x = ez.x0; x <= ez.x1; x++) { lv.setProp(x, y, P.none); lv.setTile(x, y, T.dirt); }

  // ── Cover & scatter ──
  for (let y = border; y < N - border; y++) for (let x = border; x < N - border; x++) {
    const i = lv.idx(x, y);
    if (lv.props[i] || lv.isWater(x, y) || onTrail.has(i)) continue;
    const near = Math.hypot(x - siteCenter.x, y - siteCenter.y);
    const grass = fbm(x, y, 7, seed + 31, 2);
    if (lv.tile(x, y) === T.sand && rng.chance(0.25)) { lv.setProp(x, y, P.reeds); continue; }
    if (grass > 0.58 && near > 7 && rng.chance(0.75)) { lv.setProp(x, y, P.tall_grass); continue; }
    if (rng.chance(0.035)) { lv.setProp(x, y, P.bush); continue; }
    if (rng.chance(0.012)) { lv.setProp(x, y, rng.pick([P.rock_small, P.rock_large, P.stump, P.log])); continue; }
    if (rng.chance(0.02)) lv.setProp(x, y, P.flowers);
  }

  // ── Site ──
  const result: MissionMapResult = { level: lv, start, siteCenter, leader: null, enemies: [] };
  if (spec.site.kind !== 'none') buildCamp(g, lv, rng, spec, siteCenter, trail, result);
  return result;
}

function free(lv: Level, x: number, y: number): boolean {
  return lv.isFree(x, y) && !lv.isWater(x, y);
}

function buildCamp(g: Game, lv: Level, rng: Rng, spec: MissionMapSpec, c: Vec, trail: Vec[], out: MissionMapResult): void {
  const R = 7;
  for (let y = c.y - R; y <= c.y + R; y++) for (let x = c.x - R; x <= c.x + R; x++) {
    if (!lv.inBounds(x, y)) continue;
    const d = Math.hypot(x - c.x, y - c.y);
    if (d > R + 0.5) continue;
    lv.setProp(x, y, P.none);
    if (!lv.isWater(x, y)) lv.setTile(x, y, d < R - 1.5 ? T.dirt : rng.chance(0.5) ? T.dirt : T.grass);
  }
  lv.setProp(c.x, c.y, P.campfire);
  // Tents around the fire, bedrolls, supplies, torches at the rim.
  const tents = 3 + rng.int(0, 1);
  const bedrolls: Vec[] = [];
  for (let k = 0; k < tents; k++) {
    const a = (k / tents) * Math.PI * 2 + rng.next() * 0.5;
    const x = Math.round(c.x + Math.cos(a) * 4.5), y = Math.round(c.y + Math.sin(a) * 4.5);
    if (free(lv, x, y)) lv.setProp(x, y, P.tent);
    const bx = Math.round(c.x + Math.cos(a) * 3), by = Math.round(c.y + Math.sin(a) * 3);
    if (free(lv, bx, by)) { lv.setProp(bx, by, P.bedroll); bedrolls.push({ x: bx, y: by }); }
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const x = Math.round(c.x + Math.cos(a) * (R - 0.5)), y = Math.round(c.y + Math.sin(a) * (R - 0.5));
    if (free(lv, x, y)) lv.setProp(x, y, P.torch);
  }
  for (const [dx, dy, p] of [[2, -1, P.crates], [-2, 2, P.barrel], [1, 2, P.log], [-2, -2, P.crates]] as const) {
    if (free(lv, c.x + dx, c.y + dy)) lv.setProp(c.x + dx, c.y + dy, p);
  }

  const night = spec.hour >= 21 || spec.hour < 5;
  const spawn = (arch: string, x: number, y: number, mode: string) => {
    const spot = nearestFree(lv, { x, y });
    if (!spot) return null;
    const id = spawnArchetype(g, lv, arch, spot.x, spot.y, { rng });
    const brain = lv.c.brain.get(id)!;
    brain.mode = mode;
    brain.home = { ...spot };
    out.enemies.push(id);
    return id;
  };

  // Leader near the biggest tent / fire.
  if (spec.site.leader) {
    const id = spawn(spec.site.leader, c.x + 1, c.y - 1, 'post');
    if (id !== null) {
      out.leader = id;
      lv.add(id, 'mission', { role: 'leader' });
    }
  }
  // Guards where the trail enters the camp, facing out.
  const entry = trail.find(p => Math.hypot(p.x - c.x, p.y - c.y) <= R + 1) ?? { x: c.x, y: c.y + R };
  for (const [k, arch] of spec.site.guards.entries()) {
    const id = spawn(arch, entry.x + (k === 0 ? -1 : 1), entry.y, 'post');
    if (id !== null) {
      const p = lv.c.pos.get(id)!;
      p.facing = dirTo(c, entry) ?? 's';
    }
  }
  // Patrols loop around the camp's rim.
  for (const [k, arch] of spec.site.patrols.entries()) {
    const loop: Vec[] = [];
    const r = R + 3 + k * 2;
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2 + k;
      const p = nearestFree(lv, { x: Math.round(c.x + Math.cos(a) * r), y: Math.round(c.y + Math.sin(a) * r) });
      if (p) loop.push(p);
    }
    if (loop.length < 2) continue;
    const id = spawn(arch, loop[0].x, loop[0].y, 'patrol');
    if (id !== null) {
      const brain = lv.c.brain.get(id)!;
      brain.patrol = loop;
      brain.patrolIdx = 1;
    }
  }
  // Campers by the fire — asleep on bedrolls at night.
  for (const [k, arch] of spec.site.campers.entries()) {
    const spot = night && bedrolls[k] ? bedrolls[k] : { x: c.x + rng.int(-2, 2), y: c.y + rng.int(-2, 2) };
    const id = spawn(arch, spot.x, spot.y, night ? 'sleep' : 'post');
    if (id !== null) {
      const brain = lv.c.brain.get(id)!;
      if (night) brain.sleeping = true;
      const p = lv.c.pos.get(id)!;
      p.facing = dirTo(p, c) ?? 's';
    }
  }
}

export function nearestFree(lv: Level, p: Vec, maxR = 6): Vec | null {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = p.x + dx, y = p.y + dy;
      if (lv.inBounds(x, y) && lv.isFree(x, y) && !lv.isWater(x, y)) return { x, y };
    }
  }
  return null;
}
