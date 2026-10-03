/**
 * NPC decision making. Every brain ends in `perform(...)`, the same pipeline the player uses.
 * Returns the ticks until the NPC's next turn, or null to stop scheduling it.
 */

import type { Level } from '../ecs/level.ts';
import type { EntityId, Brain } from '../ecs/components.ts';
import type { Game } from './game.ts';
import { chebyshev, euclid, dirFromDelta, DIRS, DIR_VEC as DIR_STEP, type Vec } from '../core/geometry.ts';
import { findPath } from '../world/path.ts';
import { hasLos } from '../world/fov.ts';
import { perform, projectileTurn, type Action } from './actions.ts';
import { isStanding } from './vitals.ts';
import { isHostile } from './factions.ts';
import { commitIntent, openHit, combatOf, engagedWith } from './combat.ts';
import { visibility } from './stealth.ts';
import { EXCHANGE_TICKS, THROWN, SECONDS } from '../core/config.ts';
import { BARKS } from '../content/flavor.ts';
import { scheduleSlot, goInside, comeOutside } from './village.ts';
import { TECHNIQUES } from '../content/techniques.ts';

export interface SquadOrders { follow: boolean; engage: boolean }

export function squadOrders(g: Game): SquadOrders {
  const o = g.ext.squadOrders as SquadOrders | undefined;
  if (o) return o;
  const d = { follow: true, engage: true };
  g.ext.squadOrders = d;
  return d;
}

export function npcTurn(g: Game, lv: Level, id: EntityId): number | null {
  if (lv.c.dead.has(id) || lv.c.ko.has(id)) return null;
  if (lv.c.restrained.has(id) || lv.c.carried.has(id)) return SECONDS(5);
  if (lv.c.projectile.has(id)) return projectileTurn(g, lv, id);
  const actor = lv.c.actor.get(id);
  if (!actor) return null;
  switch (actor.ai) {
    case 'dummy':
    case 'player':
      return null;
    case 'villager':
      return villagerTurn(g, lv, id);
    case 'client':
      return clientTurn(g, lv, id);
    case 'squad':
      return squadTurn(g, lv, id);
    default:
      return fighterTurn(g, lv, id);
  }
}

// ── Helpers ──

function act(g: Game, lv: Level, id: EntityId, a: Action, fallback = 10): number {
  const r = perform(g, lv, id, a);
  return r.ok ? r.ticks : fallback;
}

/** One step along a path toward `goal`. Returns ticks, or null if unreachable. */
function stepTo(g: Game, lv: Level, id: EntityId, goal: Vec, near = 0): number | null {
  const p = lv.c.pos.get(id)!;
  const brain = lv.c.brain.get(id);
  if (chebyshev(p, goal) <= near) return null;
  let path = brain?.path ?? null;
  const goalChanged = !brain?.goal || brain.goal.x !== goal.x || brain.goal.y !== goal.y;
  if (!path || path.length === 0 || goalChanged) {
    path = findPath(lv, p, goal, { self: id, near, limit: 2500 });
    if (brain) { brain.path = path; brain.goal = { ...goal }; }
  }
  if (!path || path.length === 0) {
    // No route around blockers: try ignoring actors, then a direct step.
    path = findPath(lv, p, goal, { self: id, near, avoidActors: false, limit: 2500 });
    if (brain) brain.path = path;
    if (!path || !path.length) return null;
  }
  const next = path[0];
  const r = perform(g, lv, id, { type: 'move', dx: next.x - p.x, dy: next.y - p.y });
  if (r.ok) {
    if (lv.c.pos.get(id)!.x === next.x && lv.c.pos.get(id)!.y === next.y) path.shift();
    return r.ticks;
  }
  if (brain) brain.path = null;
  return null;
}

function face(lv: Level, id: EntityId, at: Vec): void {
  const p = lv.c.pos.get(id)!;
  const d = dirFromDelta(at.x - p.x, at.y - p.y);
  if (d && d !== p.facing) {
    p.facing = d;
    lv.emit({ t: 'face', id, dir: d });
  }
}

function setStance(lv: Level, id: EntityId, s: 'walk' | 'run' | 'sneak'): void {
  const a = lv.c.actor.get(id);
  if (a) a.stance = s;
}

function adjacentHostiles(lv: Level, id: EntityId): EntityId[] {
  const p = lv.c.pos.get(id)!;
  const out: EntityId[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    for (const o of lv.at(p.x + dx, p.y + dy)) {
      if (isStanding(lv, o) && isHostile(lv, id, o) && lv.c.actor.has(o)) out.push(o);
    }
  }
  return out;
}

function bark(g: Game, lv: Level, id: EntityId, pool: readonly string[], cooldown = SECONDS(8)): void {
  const b = lv.c.brain.get(id);
  if (b && g.clock - b.barkTick < cooldown) return;
  if (b) b.barkTick = g.clock;
  lv.emit({ t: 'bark', id, text: g.rng.pick(pool) });
}

/** Melee against an adjacent opponent. Player targets use committed intents + fallback. */
function fight(g: Game, lv: Level, id: EntityId, target: EntityId): number {
  const c = combatOf(lv, id);
  face(lv, id, lv.c.pos.get(target)!);
  if (target === lv.playerId) {
    if (c.intent && c.intentTarget === target) {
      // The player let the moment pass: our committed move lands on an open guard.
      openHit(g, lv, id, target, c.intent);
      if (isStanding(lv, target) && isStanding(lv, id)) commitIntent(g, lv, id, target);
    } else {
      commitIntent(g, lv, id, target);
    }
    return EXCHANGE_TICKS + 1;
  }
  return act(g, lv, id, { type: 'melee', move: 'strike', target }, EXCHANGE_TICKS);
}

function tryThrow(g: Game, lv: Level, id: EntityId, target: EntityId): number | null {
  const inv = lv.c.inventory.get(id);
  if (!inv) return null;
  const weapon = (inv.items.shuriken ?? 0) > 0 ? 'shuriken' : (inv.items.kunai ?? 0) > 0 ? 'kunai' : null;
  if (!weapon) return null;
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target)!;
  const d = euclid(p, tp);
  if (d < 2.5 || d > THROWN[weapon].range - 1) return null;
  if (!hasLos(lv, p.x, p.y, tp.x, tp.y)) return null;
  const r = perform(g, lv, id, { type: 'throw', weapon, target });
  return r.ok ? r.ticks : null;
}

// ── Fighters: bandits, rogue ninja, guards, proctors ──

function fighterTurn(g: Game, lv: Level, id: EntityId): number {
  const aw = lv.c.aware.get(id);
  const brain = lv.c.brain.get(id)!;
  const v = lv.c.vitals.get(id)!;
  const p = lv.c.pos.get(id)!;
  const duel = lv.c.duel.get(id);

  // Duelists always know where their opponent is.
  if (duel && aw && isStanding(lv, duel.opponent)) {
    const tp = lv.c.pos.get(duel.opponent)!;
    aw.state = 'alert'; aw.level = 100; aw.target = duel.opponent; aw.lastKnown = { ...tp }; aw.lastSeenTick = g.clock;
  }

  // Quick fighters step out of the way of something flying at them.
  if (aw?.state === 'alert') {
    const dodge = dodgeProjectile(g, lv, id);
    if (dodge !== null) return dodge;
  }

  // Fleeing.
  if (aw?.state === 'alert' && !duel && brain.flee > 0 && v.hp / v.hpMax < brain.flee) {
    if (brain.mode !== 'flee') { brain.mode = 'flee'; bark(g, lv, id, BARKS.flee, 0); }
    const threat = aw.target !== null ? lv.c.pos.get(aw.target) : null;
    if (threat) return flee(g, lv, id, threat);
  }

  // Adjacent enemies: fight (prefer the known target). Only once we actually know they are there —
  // perception (stealth pulse) decides that, being adjacent is not enough on its own.
  const adj = aw && aw.state !== 'alert' && !duel ? [] : adjacentHostiles(lv, id);
  if (adj.length) {
    const target = aw?.target !== null && aw?.target !== undefined && adj.includes(aw.target) ? aw.target : adj[0];
    // Ninja escape hatch.
    const sheet = lv.c.sheet.get(id);
    const c = combatOf(lv, id);
    if (sheet?.techniques.includes('kawarimi') && v.hp / v.hpMax < 0.35 && c.tempo >= 1 && g.rng.chance(0.35)
      && v.chakra >= TECHNIQUES.kawarimi.cost(sheet.skills.ninjutsu)) {
      const r = perform(g, lv, id, { type: 'kawarimi' });
      if (r.ok) return r.ticks;
    }
    setStance(lv, id, 'walk');
    return fight(g, lv, id, target);
  }
  // Not adjacent: drop any stale committed intent.
  const c = lv.c.combat.get(id);
  if (c?.intent) { c.intent = null; c.intentTarget = null; }

  if (!aw) return idle(g, lv, id, brain);

  switch (aw.state) {
    case 'alert': {
      const target = aw.target;
      const tp = target !== null ? lv.c.pos.get(target) : null;
      const seen = target !== null && tp && g.clock - aw.lastSeenTick <= SECONDS(1.5);
      if (target !== null && tp && seen) {
        if (g.rng.chance(lv.c.actor.get(id)!.ai === 'ninja' ? 0.45 : 0.2)) {
          const t = tryThrow(g, lv, id, target);
          if (t !== null) return t;
        }
        setStance(lv, id, 'run');
        return stepTo(g, lv, id, tp, 1) ?? act(g, lv, id, { type: 'wait' });
      }
      if (aw.lastKnown) {
        setStance(lv, id, 'run');
        const t = stepTo(g, lv, id, aw.lastKnown, 0);
        if (t !== null) return t;
      }
      return lookAround(g, lv, id);
    }
    case 'searching': {
      setStance(lv, id, 'walk');
      if (aw.lastKnown && chebyshev(p, aw.lastKnown) > 0) {
        const t = stepTo(g, lv, id, aw.lastKnown, 0);
        if (t !== null) return t;
      }
      // Wander the area around the last known position.
      if (g.rng.chance(0.5)) {
        const base = aw.lastKnown ?? p;
        const goal = { x: base.x + g.rng.int(-4, 4), y: base.y + g.rng.int(-4, 4) };
        if (lv.isPassable(goal.x, goal.y)) aw.lastKnown = goal;
      }
      return lookAround(g, lv, id);
    }
    case 'suspicious': {
      setStance(lv, id, 'walk');
      if (aw.lastKnown) {
        face(lv, id, aw.lastKnown);
        if (aw.level >= 60 && chebyshev(p, aw.lastKnown) > 1) {
          const t = stepTo(g, lv, id, aw.lastKnown, 1);
          if (t !== null) return t;
        }
      }
      return act(g, lv, id, { type: 'wait', ticks: SECONDS(1) });
    }
    case 'idle':
      return idle(g, lv, id, brain);
  }
}

function dodgeProjectile(g: Game, lv: Level, id: EntityId): number | null {
  const p = lv.c.pos.get(id)!;
  const tai = lv.c.sheet.get(id)?.skills.taijutsu ?? 0;
  for (const [, pr] of lv.c.projectile) {
    if (pr.source === id || !isHostile(lv, id, pr.source)) continue;
    const hitsMe = pr.path.some(q => q.x === p.x && q.y === p.y);
    if (!hitsMe || !g.rng.chance(Math.min(0.8, tai / 70))) continue;
    for (const d of g.rng.shuffle([...DIRS])) {
      const v = { x: p.x + DIR_STEP[d].x, y: p.y + DIR_STEP[d].y };
      if (!lv.isFree(v.x, v.y) || pr.path.some(q => q.x === v.x && q.y === v.y)) continue;
      const r = perform(g, lv, id, { type: 'move', dx: v.x - p.x, dy: v.y - p.y });
      if (r.ok) return r.ticks;
    }
  }
  return null;
}

function lookAround(g: Game, lv: Level, id: EntityId): number {
  const d = g.rng.pick(DIRS);
  return act(g, lv, id, { type: 'face', dir: d }) + SECONDS(1);
}

function flee(g: Game, lv: Level, id: EntityId, threat: Vec): number {
  setStance(lv, id, 'run');
  const p = lv.c.pos.get(id)!;
  let best: Vec | null = null;
  let bestD = euclid(p, threat);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const q = { x: p.x + dx, y: p.y + dy };
    if ((dx || dy) && lv.isFree(q.x, q.y)) {
      const d = euclid(q, threat);
      if (d > bestD) { bestD = d; best = q; }
    }
  }
  if (!best) return act(g, lv, id, { type: 'wait' });
  return act(g, lv, id, { type: 'move', dx: best.x - p.x, dy: best.y - p.y });
}

function idle(g: Game, lv: Level, id: EntityId, brain: Brain): number {
  setStance(lv, id, 'walk');
  if (brain.sleeping) return SECONDS(3);
  if (g.clock < brain.waitUntil) return Math.min(SECONDS(2), brain.waitUntil - g.clock);
  const p = lv.c.pos.get(id)!;
  switch (brain.mode) {
    case 'patrol': {
      if (!brain.patrol.length) break;
      const wp = brain.patrol[brain.patrolIdx % brain.patrol.length];
      if (chebyshev(p, wp) <= 0) {
        brain.patrolIdx = (brain.patrolIdx + 1) % brain.patrol.length;
        brain.waitUntil = g.clock + SECONDS(g.rng.int(2, 6));
        return lookAround(g, lv, id);
      }
      const t = stepTo(g, lv, id, wp, 0);
      if (t !== null) return t;
      brain.patrolIdx = (brain.patrolIdx + 1) % brain.patrol.length;
      return SECONDS(1);
    }
    case 'post': {
      if (chebyshev(p, brain.home) > 0) {
        const t = stepTo(g, lv, id, brain.home, 0);
        if (t !== null) return t;
      }
      brain.waitUntil = g.clock + SECONDS(g.rng.int(4, 10));
      return lookAround(g, lv, id);
    }
    case 'sleep':
      return SECONDS(5);
    default: {
      // Wander near home.
      if (g.rng.chance(0.4)) {
        const goal = { x: brain.home.x + g.rng.int(-3, 3), y: brain.home.y + g.rng.int(-3, 3) };
        if (lv.isFree(goal.x, goal.y)) {
          const t = stepTo(g, lv, id, goal, 0);
          if (t !== null) { brain.waitUntil = g.clock + SECONDS(g.rng.int(2, 8)); return t; }
        }
      }
      brain.waitUntil = g.clock + SECONDS(g.rng.int(3, 9));
      return lookAround(g, lv, id);
    }
  }
  return SECONDS(2);
}

// ── Squad ──

function squadTurn(g: Game, lv: Level, id: EntityId): number {
  const orders = squadOrders(g);
  const player = lv.playerId;
  const pp = lv.c.pos.get(player);
  const p = lv.c.pos.get(id)!;
  const playerStance = lv.c.actor.get(player)?.stance ?? 'walk';

  // Fight whatever is adjacent and hostile.
  const adj = adjacentHostiles(lv, id);
  if (adj.length) {
    setStance(lv, id, 'walk');
    return act(g, lv, id, { type: 'melee', move: 'strike', target: adj[0] }, EXCHANGE_TICKS);
  }

  // Engage alert enemies (or anyone hitting the player).
  const threats: EntityId[] = [];
  for (const [o, aw] of lv.c.aware) {
    if (!isStanding(lv, o) || !isHostile(lv, id, o)) continue;
    const po = lv.c.pos.get(o)!;
    if (euclid(po, p) > 9) continue;
    const onPlayer = engagedWith(lv, player).includes(o);
    if (onPlayer || (orders.engage && aw.state === 'alert' && visibility(g, lv, id, o) > 0) || (orders.engage && aw.state === 'alert' && hasLos(lv, p.x, p.y, po.x, po.y))) {
      threats.push(o);
    }
  }
  if (threats.length) {
    threats.sort((a, b) => euclid(lv.c.pos.get(a)!, p) - euclid(lv.c.pos.get(b)!, p));
    const t = threats[0];
    if (g.rng.chance(0.3)) {
      const th = tryThrow(g, lv, id, t);
      if (th !== null) return th;
    }
    setStance(lv, id, 'run');
    const s = stepTo(g, lv, id, lv.c.pos.get(t)!, 1);
    if (s !== null) return s;
  }

  // Follow the leader.
  if (orders.follow && pp) {
    const s = playerStance === 'sneak' ? 'sneak' : playerStance === 'run' || playerStance === 'dash' ? 'run' : 'walk';
    setStance(lv, id, s);
    const dist = chebyshev(p, pp);
    if (dist > 2) {
      const t = stepTo(g, lv, id, pp, 2);
      if (t !== null) return t;
    }
  }
  return act(g, lv, id, { type: 'wait', ticks: SECONDS(1) });
}

// ── Escort client ──

function clientTurn(g: Game, lv: Level, id: EntityId): number {
  const pp = lv.c.pos.get(lv.playerId);
  const p = lv.c.pos.get(id)!;
  if (adjacentHostiles(lv, id).length) {
    bark(g, lv, id, ['Help!', 'Don\'t hurt me!', 'Shinobi-san!']);
    return SECONDS(1);
  }
  if (pp && chebyshev(p, pp) > 2) {
    const ps = lv.c.actor.get(lv.playerId)?.stance;
    setStance(lv, id, ps === 'run' || ps === 'dash' ? 'run' : ps === 'sneak' ? 'sneak' : 'walk');
    const t = stepTo(g, lv, id, pp, 1);
    if (t !== null) return t;
  }
  return SECONDS(1);
}

// ── Villagers ──

function villagerTurn(g: Game, lv: Level, id: EntityId): number {
  const brain = lv.c.brain.get(id)!;
  const p = lv.c.pos.get(id)!;
  const slot = scheduleSlot(brain, g.hour);
  if (slot) {
    if (slot.activity === 'sleep') {
      if (brain.mode === 'inside') return SECONDS(60);
      if (chebyshev(p, slot.at) <= 1) { goInside(lv, id); return SECONDS(60); }
      setStance(lv, id, 'walk');
      const t = stepTo(g, lv, id, slot.at, 1);
      if (t !== null) return t;
      goInside(lv, id);
      return SECONDS(60);
    }
    if (brain.mode === 'inside') comeOutside(lv, id);
    if (chebyshev(p, slot.at) > 2) {
      setStance(lv, id, 'walk');
      const t = stepTo(g, lv, id, slot.at, 1);
      if (t !== null) return t;
    }
    brain.home = slot.at;
  }
  // Now and then, say something to a passing shinobi.
  const pp = lv.c.pos.get(lv.playerId);
  const talk = lv.c.talk.get(id);
  if (pp && talk && chebyshev(p, pp) <= 3 && g.clock - talk.lastTick > SECONDS(90) && g.rng.chance(0.08)) {
    talk.lastTick = g.clock;
    face(lv, id, pp);
    lv.emit({ t: 'bark', id, text: shortLine(g.rng.pick(talk.lines)) });
  }
  return idle(g, lv, id, brain);
}

function shortLine(s: string): string {
  const cut = s.split(/(?<=[.!?])\s/)[0];
  return cut.length > 42 ? cut.slice(0, 40) + '…' : cut;
}
