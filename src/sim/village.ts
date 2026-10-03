/**
 * Village life: populating Konoha with its people and their daily routines, and re-settling
 * everyone after a time skip.
 */

import type { Game } from './game.ts';
import type { Level } from '../ecs/level.ts';
import type { EntityId } from '../ecs/components.ts';
import type { Vec } from '../core/geometry.ts';
import type { Spots } from '../world/gen/village.ts';
import { VILLAGERS } from '../content/villagers.ts';
import { spawnArchetype } from './spawn.ts';
import { civilianLook } from '../content/looks.ts';
import { nearestFree } from '../world/gen/mission.ts';
import { Rng } from '../core/rng.ts';

export function populateVillage(g: Game, lv: Level, spots: Spots): void {
  const rng = new Rng(g.seed + 404);
  VILLAGERS.forEach((v, i) => {
    const workBase = spots.work[v.work] ?? spots.plaza;
    const work = jitter(lv, rng, workBase, v.post ? 0 : 2, i);
    const home = spots.houses.length ? spots.houses[i % spots.houses.length] : spots.plaza;
    const start = nearestFree(lv, isWorking(v.hours, g.hour) ? work : home) ?? work;
    const id = spawnArchetype(g, lv, v.arch, start.x, start.y, {
      name: v.name, title: v.title, rng,
      look: v.arch === 'villager' ? civilianLook(rng, v.frame) : undefined,
    });
    const app = lv.c.appearance.get(id)!;
    app.frame = v.frame;
    if (v.frame === 'f' && !['bob', 'ponytail', 'long', 'buns', 'short', 'tied'].includes(app.hair)) app.hair = rng.pick(['bob', 'ponytail', 'long', 'buns'] as const);
    lv.add(id, 'talk', { lines: v.lines, lastTick: -1e9 });
    lv.add(id, 'faction', { id: v.arch === 'villager' ? 'civilian' : 'leaf' });
    const brain = lv.c.brain.get(id)!;
    const [from, to] = v.hours;
    if (v.post && from === 0 && to === 24) {
      brain.mode = 'post';
      brain.home = work;
      brain.schedule = null;
    } else {
      brain.mode = v.post ? 'post' : 'wander';
      brain.home = work;
      const leisure = jitter(lv, rng, rng.chance(0.5) ? spots.plaza : spots.market, 3, i + 50);
      brain.schedule = [
        { from, to, at: work, activity: 'work' },
        { from: to, to: Math.max(to + 1, 21) % 24, at: leisure, activity: 'leisure' },
        { from: Math.max(to + 1, 21) % 24, to: from, at: home, activity: 'sleep' },
      ];
    }
    lv.c.actor.get(id)!.ai = 'villager';
    if (v.arch !== 'villager') lv.remove(id, 'aware');
    if (v.recipient) lv.add(id, 'mission', { role: 'recipient' });
  });
  resettle(g, lv);
}

function isWorking(h: [number, number], hour: number): boolean {
  return hour >= h[0] && hour < h[1];
}

function jitter(lv: Level, rng: Rng, p: Vec, r: number, salt: number): Vec {
  if (r === 0) return p;
  for (let k = 0; k < 12; k++) {
    const q = { x: p.x + rng.int(-r, r), y: p.y + rng.int(-r, r) };
    if (lv.isFree(q.x, q.y) && !lv.isWater(q.x, q.y)) return q;
  }
  void salt;
  return p;
}

export function scheduleSlot(brain: NonNullable<ReturnType<Level['c']['brain']['get']>>, hour: number) {
  return brain.schedule?.find(s => (s.from <= s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to)) ?? null;
}

/** After a time skip: put villagers where their routine says, hide sleepers indoors. */
export function resettle(g: Game, lv: Level): void {
  for (const [id, brain] of lv.c.brain) {
    if (lv.c.actor.get(id)?.ai !== 'villager' || id === lv.playerId) continue;
    const slot = scheduleSlot(brain, g.hour);
    if (!slot) continue;
    brain.path = null;
    if (slot.activity === 'sleep') { goInside(lv, id); continue; }
    comeOutside(lv, id);
    const spot = nearestFree(lv, slot.at);
    if (spot) lv.moveTo(id, spot.x, spot.y);
    brain.home = slot.at;
  }
}

export function goInside(lv: Level, id: EntityId): void {
  const brain = lv.c.brain.get(id);
  if (!brain || brain.mode === 'inside') return;
  if (brain.mode !== 'inside') brain.baseMode = brain.mode;
  brain.mode = 'inside';
  const b = lv.c.blocker.get(id);
  if (b) b.move = false;
}

export function comeOutside(lv: Level, id: EntityId): void {
  const brain = lv.c.brain.get(id);
  if (!brain || brain.mode !== 'inside') return;
  brain.mode = brain.baseMode ?? 'wander';
  const b = lv.c.blocker.get(id);
  if (b) b.move = true;
}

export function isInside(lv: Level, id: EntityId): boolean {
  return lv.c.brain.get(id)?.mode === 'inside';
}
