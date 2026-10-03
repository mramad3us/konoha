/**
 * Away missions end to end: depart → travel (ambushes) → mission map → extract → travel home →
 * village. Also the defeat/rescue flow. The UI drives it one step at a time.
 */

import type { Game } from './game.ts';
import type { Level } from '../ecs/level.ts';
import type { EntityId, ItemKind } from '../ecs/components.ts';
import type { Vec } from '../core/geometry.ts';
import { Rng, hashString } from '../core/rng.ts';
import { active, onLeaveArea, fail, type Mission } from './missions.ts';
import { place, TRAVEL_KMH } from '../content/world.ts';
import { TICKS_PER_HOUR, TICKS_PER_DAY, DEFEAT_RYO_LOSS } from '../core/config.ts';
import { generateMissionMap, nearestFree, type SiteSpec } from '../world/gen/mission.ts';
import { generateEncounter } from '../world/gen/encounter.ts';
import { placePlayer, spawnArchetype } from './spawn.ts';
import { primeLevel, updatePlayerFov } from './turn.ts';
import { assignSquad, spawnSquad, syncSquad, finishMissionForSquad, roster } from './squad.ts';
import { resettle } from './village.ts';
import { civilianLook } from '../content/looks.ts';
import { revive } from './vitals.ts';
import { dropItem } from './actions.ts';
import type { Spots } from '../world/gen/village.ts';

export interface JourneyEvent { atKm: number; seed: number; done: boolean }

export interface Journey {
  dir: 'out' | 'back';
  dest: string;
  km: number;
  done: number;
  events: JourneyEvent[];
  squad: string[];
  /** Escort client identity, kept across ambush maps. */
  client?: { name: string; look: ReturnType<typeof civilianLook>; hp: number };
  /** Which level to return to after an ambush. */
  phase: 'road' | 'ambush' | 'site';
}

export function journey(g: Game): Journey | null {
  return (g.ext.journey as Journey | undefined) ?? null;
}

function villageSpots(g: Game): Spots {
  return g.ext.spots as Spots;
}

/** Start the trip out. Returns hours the trip will take. */
export function depart(g: Game, waitForDusk = false): number {
  const a = active(g);
  if (!a) throw new Error('No mission');
  const m = a.m;
  const p = place(m.place!);
  if (waitForDusk) {
    // Leave so you arrive around 21:00.
    const travelH = p.km / TRAVEL_KMH;
    let wait = (21 - travelH) - g.hour;
    if (wait < 0) wait += 24;
    g.clock += Math.round(wait * TICKS_PER_HOUR);
  }
  const rng = new Rng(hashString(`${m.id}:out`));
  const events: JourneyEvent[] = [];
  const chance = m.kind === 'escort' ? 1 : { D: 0, C: 0.35, B: 0.45, A: 0.55 }[m.rank];
  if (rng.chance(chance)) events.push({ atKm: p.km * rng.range(0.3, 0.7), seed: rng.nextU32(), done: false });
  if (m.kind === 'escort' && rng.chance(0.5)) events.push({ atKm: p.km * rng.range(0.75, 0.9), seed: rng.nextU32(), done: false });
  events.sort((x, y) => x.atKm - y.atKm);
  const squad = m.rank === 'D' ? [] : assignSquad(g, 2);
  const j: Journey = { dir: 'out', dest: m.place!, km: p.km, done: 0, events, squad, phase: 'road' };
  if (m.kind === 'escort') {
    const crng = new Rng(m.seed);
    j.client = { name: m.client.replace(/^A |^An /, '').replace(/^\w/, c => c.toUpperCase()), look: civilianLook(crng, crng.chance(0.5) ? 'm' : 'f'), hp: 1 };
  }
  g.ext.journey = j;
  g.say(`You leave Konoha for ${p.name}.`, 'system');
  return p.km / TRAVEL_KMH;
}

export type TravelStep =
  | { kind: 'ambush'; km: number }
  | { kind: 'arrive' }
  | { kind: 'home' };

/** Advance along the road to the next event or the end. Moves the clock. */
export function travel(g: Game): TravelStep {
  const j = journey(g)!;
  const next = j.events.find(e => !e.done);
  const to = next ? next.atKm : j.km;
  const hours = (to - j.done) / TRAVEL_KMH;
  g.clock += Math.round(hours * TICKS_PER_HOUR);
  j.done = to;
  if (next) return { kind: 'ambush', km: to };
  return j.dir === 'out' ? { kind: 'arrive' } : { kind: 'home' };
}

function foesFor(m: Mission, rng: Rng): string[] {
  const n = rng.int(2, 3);
  const pool = m.rank === 'A' ? ['rogue_chunin', 'rogue_genin'] : m.rank === 'B' ? ['rogue_genin', 'bandit_enforcer'] : ['bandit_thug', 'bandit_thug', 'bandit_enforcer'];
  return Array.from({ length: n }, () => rng.pick(pool));
}

/** Enter a roadside ambush map. */
export function enterAmbush(g: Game): Level {
  const j = journey(g)!;
  const a = active(g)!;
  const ev = j.events.find(e => !e.done)!;
  const rng = new Rng(ev.seed);
  const dest = place(j.dest);
  const alerted = rng.chance(0.5);
  const enc = generateEncounter(g, ev.seed, foesFor(a.m, rng), dest.biome, 'The road', alerted);
  const lv = enc.level;
  g.levels.set(lv.id, lv);
  g.activeId = lv.id;
  placePlayer(g, lv, enc.start.x, enc.start.y, 'n');
  spawnSquad(g, lv, j.squad, enc.start);
  if (j.client) spawnClient(g, lv, j, enc.start);
  primeLevel(g, lv);
  j.phase = 'ambush';
  g.say(alerted ? 'Ambush! Figures burst from the trees ahead!' : 'Something moves in the trees ahead. You haven\'t been seen — yet.', alerted ? 'bad' : 'stealth');
  return lv;
}

function spawnClient(g: Game, lv: Level, j: Journey, near: Vec): EntityId {
  const at = nearestFree(lv, { x: near.x, y: near.y + 1 }) ?? near;
  const id = spawnArchetype(g, lv, 'villager', at.x, at.y, { name: j.client!.name, title: 'Client', ai: 'client', look: j.client!.look });
  lv.add(id, 'mission', { role: 'client' });
  lv.remove(id, 'aware');
  const v = lv.c.vitals.get(id)!;
  v.hp = Math.max(1, Math.round(v.hpMax * j.client!.hp));
  const a = active(g);
  if (a) a.refs.client = id;
  return id;
}

/** Leave an ambush map (by the road). */
export function leaveAmbush(g: Game): void {
  const j = journey(g)!;
  const lv = g.level;
  for (const n of syncSquad(g, lv)) g.say(n, 'bad');
  j.squad = j.squad.filter(id => roster(g).find(m => m.id === id)?.status === 'ready');
  if (j.client) {
    const cid = active(g)?.refs.client;
    if (cid !== undefined) {
      const v = lv.c.vitals.get(cid);
      if (lv.c.dead.has(cid)) fail(g, 'the client is dead.');
      else if (v) j.client.hp = Math.max(0.2, v.hp / v.hpMax);
    }
  }
  const ev = j.events.find(e => !e.done);
  if (ev) ev.done = true;
  g.levels.delete(lv.id);
  j.phase = 'road';
}

/** Arrive at the destination: build the mission map (or finish an escort). */
export function arrive(g: Game): Level | null {
  const j = journey(g)!;
  const a = active(g)!;
  const m = a.m;
  a.flags.arrived = true;
  if (m.kind === 'escort') {
    if (a.status === 'active') {
      a.status = 'complete';
      g.say(`You deliver the client safely to ${place(j.dest).name}. "I owe you my life." Head home and report.`, 'mission');
    }
    return null;
  }
  const dest = place(m.place!);
  const rng = new Rng(m.seed);
  const site = siteFor(m, rng);
  const r = generateMissionMap(g, {
    id: `mission_${m.id}`, name: dest.name, seed: m.seed, size: m.rank === 'C' ? 64 : 72, biome: dest.biome,
    site, hour: g.hour,
  });
  const lv = r.level;
  g.levels.set(lv.id, lv);
  g.activeId = lv.id;
  if (r.leader !== null) {
    a.refs.leader = r.leader;
    lv.c.name.get(r.leader)!.name = m.target ?? lv.c.name.get(r.leader)!.name;
    lv.c.name.get(r.leader)!.unique = true;
  }
  if (m.kind === 'recover' || m.kind === 'infiltrate') {
    const spot = nearestFree(lv, { x: r.siteCenter.x + rng.int(-3, 3), y: r.siteCenter.y + rng.int(-3, -1) }) ?? r.siteCenter;
    const e = lv.create();
    lv.add(e, 'pos', { x: spot.x, y: spot.y, facing: 's' });
    lv.add(e, 'name', { name: m.item ?? 'cargo' });
    lv.add(e, 'sprite', { art: m.kind === 'infiltrate' ? 'item_scroll' : 'crates' });
    lv.add(e, 'interact', { kind: 'collect', label: `Take the ${m.item}` });
    lv.add(e, 'blocker', { move: false, sight: false });
    a.refs.item = e;
  }
  if (m.kind === 'sweep') {
    const pts: Array<Vec & { label: string }> = [];
    const labels = ['the old campsite', 'the stream bend', 'the fallen pine', 'the ridge'];
    for (let k = 0; k < 3; k++) {
      const p = nearestFree(lv, { x: rng.int(10, lv.width - 10), y: rng.int(8, lv.height - 18) });
      if (p) pts.push({ ...p, label: labels[k] });
      if (p) for (let n = 0; n < (k === 2 ? 3 : 2); n++) {
        const q = nearestFree(lv, { x: p.x + rng.int(-4, 4), y: p.y + rng.int(-4, 4) });
        if (!q) continue;
        const id = spawnArchetype(g, lv, rng.pick(['bandit_thug', 'bandit_enforcer']), q.x, q.y, { rng });
        lv.c.brain.get(id)!.mode = rng.chance(0.4) ? 'post' : 'wander';
      }
    }
    m.checkpoints = pts;
  }
  placePlayer(g, lv, r.start.x, r.start.y, 'n');
  spawnSquad(g, lv, j.squad, r.start);
  primeLevel(g, lv);
  j.phase = 'site';
  g.say(`You reach ${dest.name}.${g.hour >= 20 || g.hour < 5 ? ' Night hides you — and them.' : ''}`, 'system');
  return lv;
}

function siteFor(m: Mission, rng: Rng): SiteSpec {
  switch (m.rank) {
    case 'C':
      if (m.kind === 'sweep') return { kind: 'none', guards: [], patrols: [], campers: [] };
      return { kind: 'camp', leader: m.kind === 'recover' ? 'bandit_enforcer' : 'bandit_boss', guards: ['bandit_thug', 'bandit_thug'], patrols: rng.chance(0.6) ? ['bandit_enforcer'] : ['bandit_thug'], campers: ['bandit_thug', rng.chance(0.5) ? 'bandit_thug' : 'bandit_enforcer'] };
    case 'B':
      return { kind: 'camp', leader: m.kind === 'eliminate' ? 'rogue_chunin' : 'rogue_genin', guards: ['rogue_genin', 'bandit_enforcer'], patrols: ['rogue_genin'], campers: ['bandit_enforcer', 'rogue_genin'] };
    default:
      return { kind: 'camp', leader: 'missing_jonin', guards: ['rogue_chunin'], patrols: ['rogue_chunin', 'rogue_genin'], campers: ['rogue_genin', 'rogue_genin'] };
  }
}

/** Leave the mission map: settle the objective, then start the trip home. */
export function extract(g: Game): void {
  const j = journey(g)!;
  const lv = g.level;
  onLeaveArea(g);
  for (const n of syncSquad(g, lv)) g.say(n, 'bad');
  if (lv.kind !== 'village') g.levels.delete(lv.id);
  startHome(g, j);
}

/** After an escort arrives (no map) or after extraction. */
export function startHome(g: Game, j: Journey): void {
  const rng = new Rng(hashString(`${j.dest}:back:${g.day}`));
  j.dir = 'back';
  j.done = 0;
  j.client = undefined;
  j.events = rng.chance(0.2) ? [{ atKm: j.km * rng.range(0.3, 0.7), seed: rng.nextU32(), done: false }] : [];
  j.phase = 'road';
}

/** Back in Konoha: re-enter the village at the gate. */
export function returnHome(g: Game): Level {
  const j = journey(g);
  if (j) finishMissionForSquad(g, j.squad);
  delete g.ext.journey;
  const village = g.levels.get('village')!;
  g.activeId = 'village';
  const spots = villageSpots(g);
  village.scheduler.rebase(g.clock);
  resettle(g, village);
  // The player walks in through the gate.
  placePlayer(g, village, spots.gate.x, spots.gate.y - 2, 'n');
  for (const k of [...g.levels.keys()]) if (k !== 'village') g.levels.delete(k);
  primeLevel(g, village);
  updatePlayerFov(g, village);
  g.say('The gate guards wave you through. Home.', 'system');
  return village;
}

/** The player was knocked out away from home (or in the village): wake in hospital. */
export function rescue(g: Game): Level {
  const lv = g.level;
  const away = lv.kind !== 'village';
  const a = active(g);
  if (away) {
    const squadUp = [...lv.c.squad.keys()].some(id => !lv.c.ko.has(id) && !lv.c.dead.has(id));
    if (a && a.status === 'active') fail(g, 'you were defeated.');
    for (const n of syncSquad(g, lv)) g.say(n, 'bad');
    const loss = Math.floor(g.player.inventory.ryo * DEFEAT_RYO_LOSS);
    g.player.inventory.ryo -= loss;
    // Lose half your carried kunai/shuriken in the chaos.
    for (const k of ['kunai', 'shuriken'] as ItemKind[]) {
      const n = g.player.inventory.items[k] ?? 0;
      if (n > 1) {
        const lost = Math.floor(n / 2);
        g.player.inventory.items[k] = n - lost;
        const p = lv.c.pos.get(lv.playerId);
        if (p) dropItem(lv, p.x, p.y, k, lost);
      }
    }
    g.clock += TICKS_PER_DAY;
    g.say(squadUp ? 'Your squad drags you out and carries you all the way home.' : 'A passing Leaf patrol finds you in the dirt and brings you home.', 'system');
    if (loss) g.say(`You lost ${loss} ryo along the way.`, 'bad');
    delete g.ext.journey;
    for (const k of [...g.levels.keys()]) if (k !== 'village') g.levels.delete(k);
  } else {
    g.clock += TICKS_PER_HOUR * 3;
  }
  g.player.record.defeats++;
  const village = g.levels.get('village')!;
  g.activeId = 'village';
  village.scheduler.rebase(g.clock);
  resettle(g, village);
  const spots = villageSpots(g);
  const pid = village.playerId;
  if (village.c.ko.has(pid)) revive(g, village, pid, 0.5);
  placePlayer(g, village, spots.hospitalDoor.x, spots.hospitalDoor.y, 's');
  village.remove(pid, 'bleed');
  const v = g.player.vitals;
  v.hp = Math.max(v.hp, Math.round(v.hpMax * (away ? 0.45 : 0.7)));
  v.sta = v.staMax;
  g.player.injuredUntil = g.clock + TICKS_PER_DAY;
  primeLevel(g, village);
  g.say('You wake in a hospital bed, stitched and bandaged.', 'system');
  return village;
}
