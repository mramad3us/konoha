/**
 * The turn loop: pop the scheduler until it is the player's turn (or the UI must step in).
 */

import type { Game } from './game.ts';
import type { Level } from '../ecs/level.ts';
import { PULSE_TICKS, TICKS_PER_SECOND } from '../core/config.ts';
import { pulseVitals, isStanding } from './vitals.ts';
import { pulseAwareness } from './stealth.ts';
import { npcTurn } from './ai.ts';
import { perform, type Action, type Result } from './actions.ts';
import { computePlayerFov } from '../world/fov.ts';
import { viewRange, lightAt } from './stealth.ts';
import { resettle } from './village.ts';
import { HP_REGEN_PER_SEC, CHAKRA_REGEN_PER_SEC, TICK_SECONDS } from '../core/config.ts';

export const PULSE_ID = -1;
const MAX_STEPS = 200_000;

/** Make sure a level has its pulse and player scheduled (after creation or load). */
export function primeLevel(g: Game, lv: Level): void {
  if (!lv.scheduler.isScheduled(PULSE_ID)) lv.scheduler.schedule(PULSE_ID, g.clock + PULSE_TICKS);
  if (lv.playerId && !lv.scheduler.isScheduled(lv.playerId)) lv.scheduler.schedule(lv.playerId, g.clock);
  updatePlayerFov(g, lv);
}

export type AdvanceResult = 'player' | 'request';

/**
 * Run the world until the player may act. Stops early if the sim raised a UI request
 * (defeat, leaving the area…).
 */
export function advance(g: Game): AdvanceResult {
  const lv = g.level;
  for (let steps = 0; steps < MAX_STEPS; steps++) {
    if (g.requests.some(r => r.kind === 'defeat' || r.kind === 'leave_area')) return 'request';
    const e = lv.scheduler.pop();
    if (!e) {
      lv.scheduler.schedule(lv.playerId, g.clock);
      continue;
    }
    if (e.tick > g.clock) g.clock = e.tick;
    if (e.id === PULSE_ID) {
      pulse(g, lv);
      lv.scheduler.schedule(PULSE_ID, e.tick + PULSE_TICKS);
      continue;
    }
    if (e.id === lv.playerId) {
      if (isStanding(lv, e.id)) {
        // Put the player back so the next advance() resumes from here.
        lv.scheduler.schedule(e.id, g.clock);
        updatePlayerFov(g, lv);
        return 'player';
      }
      lv.scheduler.schedule(e.id, g.clock + TICKS_PER_SECOND);
      continue;
    }
    if (!lv.entities.has(e.id)) continue;
    const next = npcTurn(g, lv, e.id);
    if (next !== null && lv.entities.has(e.id)) lv.scheduler.schedule(e.id, g.clock + Math.max(1, next));
  }
  throw new Error('advance(): scheduler did not yield to the player');
}

function pulse(g: Game, lv: Level): void {
  pulseVitals(g, lv);
  pulseAwareness(g, lv);
  for (const [id, inv] of lv.c.invisible) {
    if (inv.until >= 0 && g.clock >= inv.until) {
      lv.remove(id, 'invisible');
      const p = lv.c.pos.get(id);
      if (p) lv.emit({ t: 'smoke', at: { x: p.x, y: p.y } });
      if (id === lv.playerId) g.say('Your concealment unravels.', 'info');
    }
  }
}

export function updatePlayerFov(g: Game, lv: Level): void {
  const p = lv.c.pos.get(lv.playerId);
  if (!p) return;
  const r = Math.round(Math.max(viewRange(lightAt(g, lv, p.x, p.y)), 6) + 3);
  computePlayerFov(lv, p.x, p.y, r);
}

/**
 * The player acts. On success the player's next turn is scheduled after the action's
 * duration and the world runs until it comes around again.
 */
export function playerAct(g: Game, a: Action): Result {
  const lv = g.level;
  // Pop the player's pending entry: we are acting on it now.
  lv.scheduler.unschedule(lv.playerId);
  const r = perform(g, lv, lv.playerId, a);
  if (!r.ok) {
    lv.scheduler.schedule(lv.playerId, g.clock);
    if (r.reason) g.say(r.reason, 'info');
    return r;
  }
  lv.scheduler.schedule(lv.playerId, g.clock + r.ticks);
  if (r.ticks > 0) advance(g);
  else updatePlayerFov(g, lv);
  return r;
}

/**
 * Pass time safely: the player waits in 1 s steps until `ticks` elapsed or something
 * interrupts (a hostile becomes alert to the player, the player is hurt, a UI request).
 */
export function rest(g: Game, ticks: number, interruptible = true): { elapsed: number; interrupted: string | null } {
  const lv = g.level;
  const start = g.clock;
  const hp0 = lv.c.vitals.get(lv.playerId)?.hp ?? 0;
  while (g.clock - start < ticks) {
    const step = Math.min(TICKS_PER_SECOND * 10, ticks - (g.clock - start));
    playerAct(g, { type: 'wait', ticks: step });
    if (g.requests.length) return { elapsed: g.clock - start, interrupted: 'request' };
    if (!interruptible) continue;
    const hp = lv.c.vitals.get(lv.playerId)?.hp ?? 0;
    if (hp < hp0 - 0.5) return { elapsed: g.clock - start, interrupted: 'hurt' };
    for (const [o, aw] of lv.c.aware) {
      if (aw.state === 'alert' && aw.target === lv.playerId && isStanding(lv, o)) {
        return { elapsed: g.clock - start, interrupted: 'enemy' };
      }
    }
  }
  return { elapsed: g.clock - start, interrupted: null };
}

/**
 * Jump the clock forward without simulating every turn (sleep, training, long waits in safety).
 * Vitals recover analytically, timed statuses resolve, villagers resettle to their routine.
 */
export function skipTime(g: Game, ticks: number, opts: { restore?: number } = {}): void {
  const lv = g.level;
  g.clock += ticks;
  lv.scheduler.rebase(g.clock);
  const secs = ticks * TICK_SECONDS;
  for (const [id, v] of lv.c.vitals) {
    if (lv.c.dead.has(id) || lv.c.dummy.has(id)) continue;
    const sheet = lv.c.sheet.get(id);
    const ko = lv.c.ko.get(id);
    if (ko && g.clock >= ko.wake && id !== lv.playerId) {
      lv.remove(id, 'ko');
      const b = lv.c.blocker.get(id);
      if (b && !lv.c.restrained.has(id)) b.move = true;
    }
    v.sta = v.staMax;
    v.chakra = Math.min(v.chakraMax, v.chakra + secs * CHAKRA_REGEN_PER_SEC * Math.max(5, sheet?.attrs.chakra ?? 5));
    v.hp = Math.min(v.hpMax, v.hp + secs * HP_REGEN_PER_SEC * Math.max(5, sheet?.attrs.body ?? 5));
    if (opts.restore) {
      v.hp = Math.min(v.hpMax, v.hp + v.hpMax * opts.restore);
      v.chakra = Math.min(v.chakraMax, v.chakra + v.chakraMax * opts.restore);
    }
  }
  for (const [id, inv] of [...lv.c.invisible]) if (inv.until >= 0 && g.clock >= inv.until) lv.remove(id, 'invisible');
  for (const [id] of [...lv.c.bleed]) if (!lv.c.ko.has(id)) lv.remove(id, 'bleed');
  for (const [, c] of lv.c.combat) { c.intent = null; c.intentTarget = null; c.tempo = 0; c.staggered = false; }
  if (lv.kind === 'village') resettle(g, lv);
  lv.scheduler.schedule(lv.playerId, g.clock);
  updatePlayerFov(g, lv);
}
