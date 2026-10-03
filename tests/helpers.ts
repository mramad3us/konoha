import { Game } from '../src/sim/game.ts';
import { Level } from '../src/ecs/level.ts';
import { newProfile, placePlayer, spawnArchetype } from '../src/sim/spawn.ts';
import { primeLevel } from '../src/sim/turn.ts';
import { T } from '../src/world/tiles.ts';
import { TICKS_PER_HOUR } from '../src/core/config.ts';

/** A game with a flat empty level and the player at (x, y). Noon by default. */
export function testGame(opts: { w?: number; h?: number; x?: number; y?: number; seed?: number; hour?: number } = {}) {
  const { w = 30, h = 30, x = 10, y = 10, seed = 1, hour = 12 } = opts;
  const g = new Game(seed, newProfile('Tester', 'm'), hour * TICKS_PER_HOUR);
  const lv = new Level('test', 'mission', w, h, { name: 'Test' });
  lv.tiles.fill(T.grass);
  g.levels.set('test', lv);
  g.activeId = 'test';
  placePlayer(g, lv, x, y, 's');
  primeLevel(g, lv);
  return { g, lv, player: lv.playerId };
}

export function spawn(g: Game, lv: Level, arch: string, x: number, y: number, facing: 'n' | 's' | 'e' | 'w' = 's') {
  return spawnArchetype(g, lv, arch, x, y, { facing });
}

/** Keep an NPC standing still (no wandering/looking around) unless provoked. */
export function freeze(lv: Level, id: number) {
  const b = lv.c.brain.get(id)!;
  b.mode = 'post';
  b.waitUntil = 1e12;
}
