/**
 * Perception: light, vision cones, noise and the awareness meter
 * (idle → suspicious → alert → searching → …).
 */

import type { Level } from '../ecs/level.ts';
import type { AwareState, EntityId } from '../ecs/components.ts';
import type { Game } from './game.ts';
import type { Vec } from '../core/geometry.ts';
import { angleDiff, dirAngle, euclid, clamp } from '../core/geometry.ts';
import { hasLos } from '../world/fov.ts';
import { PROPS } from '../world/tiles.ts';
import {
  VIEW_CONE_RADIANS, VIEW_RANGE_DAY, VIEW_RANGE_NIGHT, PERIPHERAL_RANGE, AWARE_SUSPICIOUS, AWARE_ALERT,
  AWARE_GAIN_PER_SEC, AWARE_DECAY_PER_SEC, STANCE_VISIBILITY, COVER_VISIBILITY, SEARCH_GIVE_UP_SECONDS,
  TICKS_PER_SECOND, XP, DAWN_HOUR, DUSK_HOUR,
} from '../core/config.ts';
import { isHostile } from './factions.ts';
import { isStanding } from './vitals.ts';
import { train } from './progress.ts';
import { BARKS } from '../content/flavor.ts';

// ── Light ──

/** Ambient light 0.15 (deep night) … 1 (day), with dawn/dusk ramps. */
export function ambientLight(hour: number): number {
  const night = 0.15;
  if (hour >= DAWN_HOUR + 1 && hour <= DUSK_HOUR - 1) return 1;
  if (hour > DAWN_HOUR - 1 && hour < DAWN_HOUR + 1) return night + (1 - night) * ((hour - (DAWN_HOUR - 1)) / 2);
  if (hour > DUSK_HOUR - 1 && hour < DUSK_HOUR + 1) return 1 - (1 - night) * ((hour - (DUSK_HOUR - 1)) / 2);
  return night;
}

interface LightCache { version: number; entities: number; list: Array<{ x: number; y: number; r: number }> }
const lightCache = new WeakMap<Level, LightCache>();

export function lightSources(lv: Level): Array<{ x: number; y: number; r: number }> {
  const cached = lightCache.get(lv);
  if (cached && cached.version === lv.sightVersion && cached.entities === lv.c.light.size) return cached.list;
  const list: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < lv.props.length; i++) {
    const r = PROPS[lv.props[i]].light;
    if (r > 0) list.push({ x: i % lv.width, y: Math.floor(i / lv.width), r });
  }
  for (const [id, l] of lv.c.light) {
    const p = lv.c.pos.get(id);
    if (p) list.push({ x: p.x, y: p.y, r: l.radius });
  }
  lightCache.set(lv, { version: lv.sightVersion, entities: lv.c.light.size, list });
  return list;
}

export function lightAt(g: Game, lv: Level, x: number, y: number): number {
  let l = ambientLight(g.hour);
  if (l >= 1) return 1;
  for (const s of lightSources(lv)) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= s.r) l = Math.max(l, 1 - d / (s.r + 1) * 0.8);
  }
  return Math.min(1, l);
}

// ── Sight ──

export function viewRange(light: number): number {
  return VIEW_RANGE_NIGHT + (VIEW_RANGE_DAY - VIEW_RANGE_NIGHT) * light;
}

/** Is `target` inside `obs`'s view cone (ignores range and walls)? */
export function inCone(lv: Level, obs: EntityId, target: Vec): boolean {
  const p = lv.c.pos.get(obs);
  if (!p) return false;
  if (p.x === target.x && p.y === target.y) return true;
  const a = Math.atan2(target.y - p.y, target.x - p.x);
  return angleDiff(a, dirAngle(p.facing)) <= VIEW_CONE_RADIANS / 2;
}

/** How visible `target` is to `obs` right now: 0 = unseen. */
export function visibility(g: Game, lv: Level, obs: EntityId, target: EntityId): number {
  const po = lv.c.pos.get(obs), pt = lv.c.pos.get(target);
  if (!po || !pt) return 0;
  const d = euclid(po, pt);
  const sleeping = lv.c.brain.get(obs)?.sleeping ?? false;
  if (lv.c.invisible.has(target)) return d <= PERIPHERAL_RANGE ? 0.3 : 0;
  if (sleeping) return d <= PERIPHERAL_RANGE ? 0.25 : 0;
  const light = lightAt(g, lv, pt.x, pt.y);
  const range = viewRange(light);
  const cone = inCone(lv, obs, pt);
  if (d > PERIPHERAL_RANGE && (d > range || !cone)) return 0;
  if (!hasLos(lv, po.x, po.y, pt.x, pt.y)) return 0;
  const stance = lv.c.actor.get(target)?.stance ?? 'walk';
  const stanceVis = STANCE_VISIBILITY[stance];
  const cover = d > PERIPHERAL_RANGE && lv.hasCover(pt.x, pt.y) ? COVER_VISIBILITY : 1;
  const stealth = lv.c.sheet.get(target)?.skills.stealth ?? 0;
  const falloff = clamp(1.25 - d / range, 0.2, 1);
  return stanceVis * cover * (1 - stealth / 160) * falloff * (cone ? 1 : 0.6) * (0.5 + 0.5 * light);
}

/** Would `obs` see an attack coming from `attacker` (for takedowns)? */
export function watching(g: Game, lv: Level, obs: EntityId, attacker: EntityId): boolean {
  const a = lv.c.aware.get(obs);
  if (a?.state === 'alert') return true;
  if (lv.c.brain.get(obs)?.sleeping) return false;
  const pa = lv.c.pos.get(attacker);
  if (!pa) return false;
  if (lv.c.invisible.has(attacker)) return false;
  return inCone(lv, obs, pa) && visibility(g, lv, obs, attacker) > 0;
}

export function canTakedown(g: Game, lv: Level, attacker: EntityId, target: EntityId): boolean {
  if (!lv.c.aware.has(target) || !isStanding(lv, target)) return false;
  if (lv.c.duel.has(target)) return false;
  return !watching(g, lv, target, attacker);
}

// ── Awareness ──

export function awareOf(lv: Level, id: EntityId) {
  let a = lv.c.aware.get(id);
  if (!a) a = lv.add(id, 'aware', { level: 0, state: 'idle', lastKnown: null, lastSeenTick: -1e9, target: null, bodies: [] });
  return a;
}

function setState(g: Game, lv: Level, id: EntityId, state: AwareState): void {
  const a = awareOf(lv, id);
  if (a.state === state) return;
  a.state = state;
  lv.emit({ t: 'aware', id, state });
  const brain = lv.c.brain.get(id);
  if (brain && state !== 'idle') brain.sleeping = false;
  if (state === 'alert') {
    lv.emit({ t: 'bark', id, text: g.rng.pick(BARKS.alert) });
  } else if (state === 'suspicious' && g.rng.chance(0.6)) {
    lv.emit({ t: 'bark', id, text: g.rng.pick(BARKS.suspicious) });
  }
}

/** Raise an entity straight to alert about a target (shouts, being hit, …). */
export function alertTo(g: Game, lv: Level, id: EntityId, target: EntityId, shout = true): void {
  const a = awareOf(lv, id);
  const pt = lv.c.pos.get(target);
  a.level = AWARE_ALERT;
  a.target = target;
  if (pt) a.lastKnown = { x: pt.x, y: pt.y };
  a.lastSeenTick = g.clock;
  const was = a.state;
  setState(g, lv, id, 'alert');
  if (shout && was !== 'alert') shoutAlarm(g, lv, id, target);
}

function shoutAlarm(g: Game, lv: Level, id: EntityId, target: EntityId): void {
  const p = lv.c.pos.get(id);
  if (!p) return;
  for (const [o, a] of lv.c.aware) {
    if (o === id || a.state === 'alert' || !isStanding(lv, o)) continue;
    if (!isHostile(lv, o, target)) continue;
    const po = lv.c.pos.get(o);
    if (!po || euclid(p, po) > 10) continue;
    alertTo(g, lv, o, target, false);
  }
}

export function makeNoise(g: Game, lv: Level, at: Vec, radius: number, source: EntityId | null): void {
  if (radius <= 0) return;
  lv.emit({ t: 'noise', at: { ...at }, radius });
  if (source === null) return;
  for (const [o, a] of lv.c.aware) {
    if (o === source || !isStanding(lv, o) || !isHostile(lv, o, source)) continue;
    const po = lv.c.pos.get(o);
    if (!po) continue;
    const d = euclid(po, at);
    if (d > radius) continue;
    const amount = 45 * (1 - d / (radius + 1));
    if (a.state === 'alert') {
      if (!a.lastKnown || g.clock - a.lastSeenTick > 20) a.lastKnown = { ...at };
      continue;
    }
    a.level = Math.min(AWARE_ALERT - 1, a.level + amount);
    if (a.level >= AWARE_SUSPICIOUS) {
      a.lastKnown = { ...at };
      const brain = lv.c.brain.get(o);
      if (brain) brain.sleeping = false;
    }
  }
}

/** Once per second: every observer updates awareness of hostile actors and bodies. */
export function pulseAwareness(g: Game, lv: Level): void {
  const player = lv.playerId;
  const playerSneaking = lv.c.actor.get(player)?.stance === 'sneak';
  let playerSeenUnaware = false;

  // Candidate targets: standing actors (player side and others) — small list.
  const actors: EntityId[] = [];
  for (const [id] of lv.c.actor) if (isStanding(lv, id)) actors.push(id);

  for (const [o, a] of lv.c.aware) {
    if (!isStanding(lv, o)) continue;
    let best = 0;
    let bestT: EntityId | null = null;
    for (const t of actors) {
      if (t === o || !isHostile(lv, o, t)) continue;
      const v = visibility(g, lv, o, t);
      if (v > best) { best = v; bestT = t; }
    }

    if (bestT !== null) {
      const mind = lv.c.sheet.get(o)?.attrs.mind ?? 5;
      const pt = lv.c.pos.get(bestT)!;
      a.level = Math.min(AWARE_ALERT, a.level + AWARE_GAIN_PER_SEC * best * (1 + mind / 100));
      a.lastKnown = { x: pt.x, y: pt.y };
      a.lastSeenTick = g.clock;
      a.target = bestT;
      if (bestT === player && a.state !== 'alert') playerSeenUnaware = true;
    } else if (a.state !== 'alert' && a.state !== 'searching') {
      a.level = Math.max(0, a.level - AWARE_DECAY_PER_SEC);
    }

    // Bodies of allies.
    checkBodies(g, lv, o, a);

    // State machine.
    const since = (g.clock - a.lastSeenTick) / TICKS_PER_SECOND;
    switch (a.state) {
      case 'idle':
      case 'suspicious':
        if (a.level >= AWARE_ALERT && a.target !== null) alertTo(g, lv, o, a.target);
        else if (a.level >= AWARE_SUSPICIOUS) setState(g, lv, o, 'suspicious');
        else setState(g, lv, o, 'idle');
        break;
      case 'alert':
        if (a.target !== null && !isStanding(lv, a.target)) {
          // Target down: stand down to suspicious.
          a.level = 60; a.target = null;
          setState(g, lv, o, 'suspicious');
        } else if (since > 5) {
          setState(g, lv, o, 'searching');
        }
        break;
      case 'searching':
        if (bestT !== null && a.level >= AWARE_ALERT) alertTo(g, lv, o, bestT, false);
        else if (since > SEARCH_GIVE_UP_SECONDS) {
          a.level = 50; a.target = null;
          setState(g, lv, o, 'suspicious');
          if (g.rng.chance(0.7)) lv.emit({ t: 'bark', id: o, text: g.rng.pick(BARKS.lost) });
        }
        break;
    }
  }

  if (playerSneaking && playerSeenUnaware) train(g, lv, player, 'stealth', XP.sneakStepSeen * 10);
}

function checkBodies(g: Game, lv: Level, o: EntityId, a: ReturnType<typeof awareOf>): void {
  if (a.state === 'alert') return;
  const po = lv.c.pos.get(o)!;
  const range = viewRange(lightAt(g, lv, po.x, po.y));
  for (const id of [...lv.c.ko.keys(), ...lv.c.dead.keys()]) {
    if (a.bodies.includes(id) || id === o) continue;
    const f = lv.c.faction.get(id)?.id;
    if (!f || f !== lv.c.faction.get(o)?.id) continue;
    const pb = lv.c.pos.get(id);
    if (!pb || lv.c.carried.has(id)) continue;
    const d = euclid(po, pb);
    if (d > range || !inCone(lv, o, pb) || !hasLos(lv, po.x, po.y, pb.x, pb.y)) continue;
    a.bodies.push(id);
    a.level = Math.max(a.level, 85);
    a.lastKnown = { x: pb.x, y: pb.y };
    lv.emit({ t: 'bark', id: o, text: g.rng.pick(BARKS.body) });
  }
}
