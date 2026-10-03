/**
 * Campaign orchestration: starting a new game and preparing accepted missions in the village.
 * Importing this module registers every sim hook (missions, duels).
 */

import { Game } from './game.ts';
import type { Appearance } from '../ecs/components.ts';
import { newProfile, placePlayer } from './spawn.ts';
import { generateVillage, type Spots } from '../world/gen/village.ts';
import { populateVillage } from './village.ts';
import { refreshBoard, active } from './missions.ts';
import { primeLevel } from './turn.ts';
import { START_HOUR, TICKS_PER_HOUR } from '../core/config.ts';
import { Rng } from '../core/rng.ts';
import { nearestFree } from '../world/gen/mission.ts';
import { roster } from './squad.ts';
import './duel.ts';

export function newGame(name: string, frame: 'm' | 'f', appearance: Appearance | undefined, seed: number): Game {
  const g = new Game(seed, newProfile(name, frame, appearance), START_HOUR * TICKS_PER_HOUR);
  const v = generateVillage(seed);
  g.levels.set('village', v.level);
  g.activeId = 'village';
  g.ext.spots = v.spots;
  populateVillage(g, v.level, v.spots);
  const start = nearestFree(v.level, v.spots.homeDoor) ?? v.spots.homeDoor;
  placePlayer(g, v.level, start.x, start.y, 's');
  roster(g);
  refreshBoard(g);
  primeLevel(g, v.level);
  g.say(`${name}. Genin of the Hidden Leaf. Fresh forehead protector, empty wallet.`, 'system');
  g.say('The Mission Desk in the Hokage Tower (north, past the river) has work. The Academy and training grounds can sharpen you first.', 'info');
  return g;
}

export function spotsOf(g: Game): Spots {
  return g.ext.spots as Spots;
}

/** After accepting a D-rank mission: put what it needs into the village. */
export function prepareVillageMission(g: Game): void {
  const a = active(g);
  if (!a || a.m.rank !== 'D') return;
  const lv = g.levels.get('village')!;
  const spots = spotsOf(g);
  const rng = new Rng(a.m.seed);
  if (a.m.kind === 'search') {
    const base = spots.work[a.m.area ?? 'plaza'] ?? spots.plaza;
    let spot = null;
    for (let k = 0; k < 20 && !spot; k++) {
      const q = { x: base.x + rng.int(-5, 5), y: base.y + rng.int(-5, 5) };
      if (lv.isFree(q.x, q.y) && !lv.isWater(q.x, q.y) && Math.hypot(q.x - base.x, q.y - base.y) > 2) spot = q;
    }
    spot ??= nearestFree(lv, base) ?? base;
    const e = lv.create();
    lv.add(e, 'pos', { x: spot.x, y: spot.y, facing: 's' });
    lv.add(e, 'name', { name: a.m.item ?? 'something' });
    lv.add(e, 'sprite', { art: 'item_pouch', reveal: 2 });
    lv.add(e, 'interact', { kind: 'collect', label: `Pick up the ${a.m.item}` });
    a.refs.item = e;
  }
  if (a.m.kind === 'patrol') {
    g.ext.patrolSpots = (a.m.area ?? '').split(',').map(k => spots.work[k] ?? spots.plaza);
  }
}
