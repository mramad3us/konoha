/**
 * Roadside ambush maps: a stretch of forest road. Enter from the south end, leave from either end.
 */

import { Level } from '../../ecs/level.ts';
import type { EntityId } from '../../ecs/components.ts';
import type { Game } from '../../sim/game.ts';
import type { Vec } from '../../core/geometry.ts';
import { Rng } from '../../core/rng.ts';
import { T, P } from '../tiles.ts';
import { fbm } from './noise.ts';
import { spawnArchetype } from '../../sim/spawn.ts';
import { nearestFree } from './mission.ts';
import type { Biome } from './mission.ts';

export interface EncounterResult { level: Level; start: Vec; enemies: EntityId[] }

export function generateEncounter(g: Game, seed: number, foes: string[], biome: Biome, name: string, alerted: boolean): EncounterResult {
  const rng = new Rng(seed);
  const W = 34, H = 40;
  const lv = new Level(`enc${seed}`, 'encounter', W, H, { name });
  const cx: number[] = [];
  let x = Math.floor(W / 2);
  for (let y = 0; y < H; y++) {
    x += rng.int(-1, 1);
    x = Math.max(10, Math.min(W - 11, x));
    cx.push(x);
  }
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const n = fbm(i, y, 8, seed, 2);
    lv.tiles[y * W + i] = biome === 'rocky' ? (n > 0.55 ? T.rock : T.dirt) : n > 0.55 ? T.forest_floor : T.grass;
    const road = Math.abs(i - cx[y]) <= 1;
    if (road) { lv.tiles[y * W + i] = T.dirt; continue; }
    const edge = Math.min(i, W - 1 - i);
    if (edge < 2 || (rng.chance(0.16 + Math.max(0, 6 - Math.abs(i - cx[y])) * -0.02) && Math.abs(i - cx[y]) > 2)) {
      lv.props[y * W + i] = biome === 'rocky' && rng.chance(0.5) ? P.rock_large : rng.chance(0.4) ? P.tree_pine : P.tree_broad;
    } else if (fbm(i, y, 5, seed + 3, 2) > 0.6) lv.props[y * W + i] = P.tall_grass;
    else if (rng.chance(0.04)) lv.props[y * W + i] = P.bush;
  }
  lv.meta.exitZone = { x0: 0, y0: H - 1, x1: W - 1, y1: H - 1 };
  lv.meta.exitZone2 = { x0: 0, y0: 0, x1: W - 1, y1: 0 };
  const start = { x: cx[H - 4], y: H - 4 };
  const enemies: EntityId[] = [];
  foes.forEach((arch, k) => {
    const side = k % 2 ? 1 : -1;
    const y = Math.floor(H * 0.42) + rng.int(-3, 3);
    const p = nearestFree(lv, { x: cx[y] + side * rng.int(3, 6), y }) ?? { x: cx[y], y };
    const id = spawnArchetype(g, lv, arch, p.x, p.y, { facing: 's', rng });
    const aw = lv.c.aware.get(id)!;
    if (alerted) Object.assign(aw, { state: 'alert', level: 100, target: null, lastKnown: { ...start }, lastSeenTick: g.clock });
    else { aw.level = 30; aw.lastKnown = { ...start }; }
    lv.c.brain.get(id)!.mode = 'post';
    enemies.push(id);
  });
  return { level: lv, start, enemies };
}
