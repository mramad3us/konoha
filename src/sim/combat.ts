/**
 * Melee: the exchange. Strike beats Break, Break beats Guard, Guard beats Strike.
 *
 * Enemies commit an intent before each exchange; the player perceives it as clear, partial
 * (two candidates) or hidden depending on a read score. Winning builds tempo; tempo boosts
 * damage and reads and pays for Kawarimi or a clean disengage.
 */

import type { Level } from '../ecs/level.ts';
import type { EntityId, Move, Reveal } from '../ecs/components.ts';
import type { Game } from './game.ts';
import type { ExchangeOutcome } from '../ecs/events.ts';
import {
  DAMAGE_BASE, DAMAGE_PER_TAIJUTSU, DAMAGE_PER_BODY, DAMAGE_VARIANCE, TRADE_DAMAGE_MULT,
  PARRY_COUNTER_MULT, BREAK_DAMAGE_MULT, FLANK_DAMAGE_MULT, OPEN_DAMAGE_MULT, TEMPO_DAMAGE_BONUS,
  TEMPO_READ_BONUS, LETHAL_DAMAGE_MULT, CRIT_ON_CLEAR_READ, CRIT_MULT, READ_BASE, READ_PER_TAIJUTSU_DIFF,
  READ_PER_MIND, READ_FULL_MARGIN, EXCHANGE_STAMINA, EXCHANGE_TICKS, NOISE_COMBAT, XP, challengeMult, tempoSlots,
} from '../core/config.ts';
import { damage, kill, applyBleed, spendStamina, isStanding } from './vitals.ts';
import { train } from './progress.ts';
import { makeNoise } from './stealth.ts';
import { displayName, cap } from './names.ts';
import { YOU_WIN, YOU_LOSE, TRADE, CLINCH, CIRCLE, OPEN_HIT, line, BARKS } from '../content/flavor.ts';
import { chebyshev } from '../core/geometry.ts';
import { canAttack, isHostile } from './factions.ts';

export const MOVES: readonly Move[] = ['strike', 'break', 'guard'];

/** The move that `m` defeats. */
export const BEATS: Record<Move, Move> = { strike: 'break', break: 'guard', guard: 'strike' };
/** The move that defeats `m`. */
export const COUNTER: Record<Move, Move> = { strike: 'guard', break: 'strike', guard: 'break' };

export function compare(a: Move, b: Move): ExchangeOutcome {
  if (a === b) return a === 'strike' ? 'trade' : a === 'break' ? 'clinch' : 'circle';
  return BEATS[a] === b ? 'win' : 'lose';
}

function tai(lv: Level, id: EntityId): number {
  return lv.c.sheet.get(id)?.skills.taijutsu ?? 0;
}

export function combatOf(lv: Level, id: EntityId) {
  let c = lv.c.combat.get(id);
  if (!c) {
    c = lv.add(id, 'combat', {
      tempo: 0, staggered: false, history: [], intent: null, intentTarget: null,
      reveal: 'hidden', revealAlt: null, lethal: false, style: null,
    });
  }
  return c;
}

export function meleeDamage(g: Game, lv: Level, id: EntityId): number {
  const sheet = lv.c.sheet.get(id);
  const c = lv.c.combat.get(id);
  const base = DAMAGE_BASE + (sheet?.skills.taijutsu ?? 0) * DAMAGE_PER_TAIJUTSU + (sheet?.attrs.body ?? 5) * DAMAGE_PER_BODY;
  const tempo = 1 + (c?.tempo ?? 0) * TEMPO_DAMAGE_BONUS;
  const lethal = isLethal(g, lv, id) ? LETHAL_DAMAGE_MULT : 1;
  const variance = 1 + g.rng.range(-DAMAGE_VARIANCE, DAMAGE_VARIANCE);
  return base * tempo * lethal * variance;
}

export function isLethal(g: Game, lv: Level, id: EntityId): boolean {
  if (id === lv.playerId || lv.c.squad.has(id)) return g.player.lethal;
  if (lv.c.duel.has(id)) return false;
  return lv.c.combat.get(id)?.lethal ?? false;
}

/** How well `viewer` reads `target` (higher = more of the intent visible). */
export function readScore(lv: Level, viewer: EntityId, target: EntityId): number {
  const tc = lv.c.combat.get(target);
  if (tc?.staggered) return 999;
  const vs = lv.c.sheet.get(viewer);
  const vc = lv.c.combat.get(viewer);
  return READ_BASE
    + (tai(lv, viewer) - tai(lv, target)) * READ_PER_TAIJUTSU_DIFF
    + (vs?.attrs.mind ?? 0) * READ_PER_MIND
    + (vc?.tempo ?? 0) * TEMPO_READ_BONUS;
}

/** Roll what the player perceives of an intent. */
export function rollReveal(g: Game, score: number): Reveal {
  const r = g.rng.next() * 100;
  if (r < score - READ_FULL_MARGIN) return 'clear';
  if (r < score) return 'partial';
  return 'hidden';
}

/** Choose a move for an NPC against a target. */
export function chooseMove(g: Game, lv: Level, id: EntityId, target: EntityId): Move {
  const c = combatOf(lv, id);
  const v = lv.c.vitals.get(id);
  const tc = lv.c.combat.get(target);
  const w: Record<Move, number> = { ...(c.style ?? { strike: 4, break: 3, guard: 4 }) };
  if (v && v.sta < 2) { w.break = 0; w.strike *= 0.4; w.guard *= 3; }
  else if (v && v.sta < 3) { w.break *= 0.3; }
  if (tc?.staggered) { w.strike *= 4; w.guard *= 0.2; }
  if (c.tempo >= 2) { w.strike *= 1.3; w.break *= 1.3; }
  // Read the opponent's habits.
  const hist = tc?.history ?? [];
  if (hist.length >= 2) {
    const p = Math.min(0.7, Math.max(0.05, (readScore(lv, id, target) - 30) / 100));
    if (g.rng.chance(p)) {
      const recent = hist.slice(-3);
      const counts: Record<Move, number> = { strike: 0, break: 0, guard: 0 };
      for (const m of recent) counts[m]++;
      const predicted = (MOVES as Move[]).reduce((best, m) => (counts[m] > counts[best] ? m : best), recent[recent.length - 1]);
      w[COUNTER[predicted]] *= 4;
    }
  }
  return g.rng.weighted(MOVES.map(m => [m, w[m]] as const));
}

/** NPC commits to its next move against `target`; computes what the player can read of it. */
export function commitIntent(g: Game, lv: Level, id: EntityId, target: EntityId): void {
  const c = combatOf(lv, id);
  c.intent = chooseMove(g, lv, id, target);
  c.intentTarget = target;
  c.reveal = 'hidden';
  c.revealAlt = null;
  if (target === lv.playerId || chebyshev(lv.c.pos.get(id)!, lv.c.pos.get(lv.playerId) ?? { x: -99, y: -99 }) <= 1) {
    c.reveal = rollReveal(g, readScore(lv, lv.playerId, id));
    if (c.reveal === 'partial') {
      const others = MOVES.filter(m => m !== c.intent);
      c.revealAlt = g.rng.pick(others);
    }
  }
}

export function clearIntent(lv: Level, id: EntityId): void {
  const c = lv.c.combat.get(id);
  if (c) { c.intent = null; c.intentTarget = null; c.reveal = 'hidden'; c.revealAlt = null; }
}

function pushHistory(lv: Level, id: EntityId, m: Move): void {
  const c = combatOf(lv, id);
  c.history.push(m);
  if (c.history.length > 6) c.history.shift();
}

function adjustTempo(lv: Level, id: EntityId, delta: number): void {
  const c = combatOf(lv, id);
  const cap = id === lv.playerId || lv.c.sheet.has(id) ? tempoSlots(tai(lv, id)) : 0;
  c.tempo = Math.max(0, Math.min(cap, c.tempo + delta));
}

function payStamina(g: Game, lv: Level, id: EntityId, m: Move): void {
  const cost = EXCHANGE_STAMINA[m];
  const v = lv.c.vitals.get(id);
  if (!v) return;
  if (cost > 0) spendStamina(g, lv, id, cost);
  else v.sta = Math.min(v.staMax, v.sta - cost);
  if (id === lv.playerId && cost > 0) train(g, lv, id, 'body', XP.bodyExertion * cost);
}

/** Can this entity afford the move? Exhausted fighters can only Guard. */
export function canAfford(lv: Level, id: EntityId, m: Move): boolean {
  const v = lv.c.vitals.get(id);
  if (!v) return true;
  const cost = EXCHANGE_STAMINA[m];
  return cost <= 0 || v.sta >= cost;
}

/** Land a hit from `atk` on `def`. Handles lethality, bleeding, kill-on-KO. */
function landHit(g: Game, lv: Level, atk: EntityId, def: EntityId, mult: number, crit: boolean): void {
  let dmg = meleeDamage(g, lv, atk) * mult;
  if (crit) dmg *= CRIT_MULT;
  const lethal = isLethal(g, lv, atk);
  const knocked = damage(g, lv, def, dmg, atk, 'melee', crit);
  if (lethal && !lv.c.dummy.has(def) && g.rng.chance(0.25 + tai(lv, atk) / 300)) {
    applyBleed(g, lv, def, 0.4 + g.rng.next() * 0.8);
  }
  if (knocked && lethal && def !== lv.playerId && g.rng.chance(0.3 + tai(lv, atk) / 200)) {
    kill(g, lv, def, atk, 'blade');
  }
  if (!lv.c.dead.has(def) && !lv.c.ko.has(def) && def !== lv.playerId && g.rng.chance(0.25)) {
    lv.emit({ t: 'bark', id: def, text: g.rng.pick(BARKS.hurt) });
  }
}

export interface ExchangeOpts {
  /** Reveal the player had of b's move (for crits on clear reads). */
  playerReveal?: Reveal;
  /** Skip a's stamina (side resolutions where the player's move was already paid). */
  freeA?: boolean;
  /** Multiplier on damage dealt to a (flanking). */
  flankA?: number;
  /** Log the exchange (player involved). */
  quiet?: boolean;
}

/**
 * Resolve one exchange between a and b. Pure rules; callers handle scheduling.
 */
export function resolveExchange(g: Game, lv: Level, a: EntityId, moveA: Move, b: EntityId, moveB: Move, opts: ExchangeOpts = {}): ExchangeOutcome {
  const ca = combatOf(lv, a), cb = combatOf(lv, b);
  if (!opts.freeA) payStamina(g, lv, a, moveA);
  payStamina(g, lv, b, moveB);
  if (moveA === 'guard') ca.guardUntil = g.clock + EXCHANGE_TICKS + 2;
  if (moveB === 'guard') cb.guardUntil = g.clock + EXCHANGE_TICKS + 2;

  let outcome: ExchangeOutcome;
  const staggerA = ca.staggered, staggerB = cb.staggered;
  ca.staggered = false;
  cb.staggered = false;
  if (staggerA && !staggerB) outcome = moveB === 'guard' ? 'circle' : 'lose';
  else if (staggerB && !staggerA) outcome = moveA === 'guard' ? 'circle' : 'win';
  else outcome = compare(moveA, moveB);

  const player = lv.playerId;
  const playerSide = a === player ? 'a' : b === player ? 'b' : null;
  const clearRead = opts.playerReveal === 'clear';

  const winnerHit = (w: EntityId, l: EntityId, wm: Move, lStaggeredBefore: boolean) => {
    const critChance = w === player ? (clearRead ? CRIT_ON_CLEAR_READ : 0.04) : 0.04;
    const crit = g.rng.chance(critChance);
    if (wm === 'strike') landHit(g, lv, w, l, (l === a ? opts.flankA ?? 1 : 1), crit);
    else if (wm === 'break') {
      landHit(g, lv, w, l, BREAK_DAMAGE_MULT * (l === a ? opts.flankA ?? 1 : 1), crit);
      if (!lStaggeredBefore && isStanding(lv, l)) {
        combatOf(lv, l).staggered = true;
        lv.emit({ t: 'stagger', id: l });
      }
    } else {
      lv.emit({ t: 'parry', id: w });
      landHit(g, lv, w, l, PARRY_COUNTER_MULT, crit);
    }
    adjustTempo(lv, w, +1);
    adjustTempo(lv, l, -1);
  };

  switch (outcome) {
    case 'win': winnerHit(a, b, moveA, staggerB); break;
    case 'lose': winnerHit(b, a, moveB, staggerA); break;
    case 'trade':
      landHit(g, lv, a, b, TRADE_DAMAGE_MULT, false);
      landHit(g, lv, b, a, TRADE_DAMAGE_MULT * (opts.flankA ?? 1), false);
      break;
    case 'clinch':
      spendStamina(g, lv, a, 1);
      spendStamina(g, lv, b, 1);
      break;
    case 'circle':
      break;
  }

  pushHistory(lv, a, moveA);
  pushHistory(lv, b, moveB);
  clearIntent(lv, a);
  clearIntent(lv, b);
  lv.emit({ t: 'exchange', a, b, moveA, moveB, outcome });
  const pa = lv.c.pos.get(a);
  if (pa) makeNoise(g, lv, pa, NOISE_COMBAT, a);

  if (playerSide) {
    const opp = playerSide === 'a' ? b : a;
    const pOutcome: ExchangeOutcome = playerSide === 'a' ? outcome : outcome === 'win' ? 'lose' : outcome === 'lose' ? 'win' : outcome;
    const pMove = playerSide === 'a' ? moveA : moveB;
    const oMove = playerSide === 'a' ? moveB : moveA;
    const mult = challengeMult(tai(lv, player), tai(lv, opp)) * (lv.c.dummy.has(opp) ? 0.5 : 1);
    train(g, lv, player, 'taijutsu', XP.exchangeAny, mult);
    if (pOutcome === 'win') train(g, lv, player, 'taijutsu', XP.exchangeWin, mult);
    if (!opts.quiet) logExchange(g, lv, opp, pOutcome, pMove, oMove);
  }
  return outcome;
}

function logExchange(g: Game, lv: Level, opp: EntityId, outcome: ExchangeOutcome, pm: Move, om: Move): void {
  const name = displayName(lv, opp);
  switch (outcome) {
    case 'win': g.say(line(g.rng, YOU_WIN[pm], name), 'hit'); break;
    case 'lose': g.say(line(g.rng, YOU_LOSE[om], name), 'hurt'); break;
    case 'trade': g.say(line(g.rng, TRADE, name), 'combat'); break;
    case 'clinch': g.say(line(g.rng, CLINCH, name), 'combat'); break;
    case 'circle': g.say(line(g.rng, CIRCLE, name), 'combat'); break;
  }
}

/** Attacker hits a target who is busy doing something else. */
export function openHit(g: Game, lv: Level, atk: EntityId, def: EntityId, m: Move, flank = false): void {
  clearIntent(lv, atk);
  pushHistory(lv, atk, m);
  if (m === 'guard') return;
  payStamina(g, lv, atk, m);
  lv.emit({ t: 'open_hit', attacker: atk, target: def, move: m });
  const mult = (m === 'break' ? BREAK_DAMAGE_MULT : 1) * (flank ? FLANK_DAMAGE_MULT : OPEN_DAMAGE_MULT);
  landHit(g, lv, atk, def, mult, false);
  if (m === 'break' && isStanding(lv, def)) {
    combatOf(lv, def).staggered = true;
    lv.emit({ t: 'stagger', id: def });
  }
  adjustTempo(lv, atk, +1);
  adjustTempo(lv, def, -1);
  if (def === lv.playerId) g.say(cap(line(g.rng, OPEN_HIT, displayName(lv, atk))), 'hurt');
}

/** Hostile, standing, adjacent entities that have committed an intent against `id`. */
export function engagedWith(lv: Level, id: EntityId): EntityId[] {
  const p = lv.c.pos.get(id);
  if (!p) return [];
  const out: EntityId[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    for (const o of lv.at(p.x + dx, p.y + dy)) {
      const c = lv.c.combat.get(o);
      if (c?.intent && c.intentTarget === id && isStanding(lv, o)) out.push(o);
    }
  }
  return out;
}

/** Every NPC that is adjacent and hostile to the player (whether or not committed). */
export function adjacentFoes(lv: Level, id: EntityId): EntityId[] {
  const p = lv.c.pos.get(id);
  if (!p) return [];
  const out: EntityId[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    for (const o of lv.at(p.x + dx, p.y + dy)) {
      if (isStanding(lv, o) && (isHostile(lv, id, o) || (lv.c.dummy.has(o) && canAttack(lv, id, o)))) out.push(o);
    }
  }
  return out;
}

/**
 * The player's exchange: against the chosen target plus every other engaged enemy.
 * Guard covers every attacker; Strike/Break leave you open to the others.
 */
export function playerExchange(g: Game, lv: Level, move: Move, target: EntityId): void {
  const player = lv.playerId;
  const tc = combatOf(lv, target);
  if (!lv.c.dummy.has(target) && (!tc.intent || tc.intentTarget !== player)) {
    commitIntent(g, lv, target, player);
    tc.reveal = 'hidden';
  }
  const reveal = tc.reveal;
  const others = engagedWith(lv, player).filter(o => o !== target);
  const targetMove: Move = lv.c.dummy.has(target) ? 'guard' : tc.intent!;
  resolveExchange(g, lv, player, move, target, targetMove, { playerReveal: reveal });
  for (const o of others) {
    const oc = lv.c.combat.get(o);
    if (!oc?.intent || !isStanding(lv, o) || !isStanding(lv, player)) continue;
    if (move === 'guard') resolveExchange(g, lv, player, 'guard', o, oc.intent, { freeA: true });
    else openHit(g, lv, o, player, oc.intent, true);
  }
  // Re-commit and reset everyone's fallback timer so the player keeps the initiative.
  for (const o of [target, ...others]) {
    if (!isStanding(lv, o) || lv.c.dummy.has(o) || !isStanding(lv, player)) continue;
    if (isHostile(lv, o, player)) {
      commitIntent(g, lv, o, player);
      lv.scheduler.schedule(o, g.clock + EXCHANGE_TICKS + 1);
    }
  }
}

/** Every engaged enemy lands its committed move on the player (the player turned their back). */
export function punishOpening(g: Game, lv: Level, victim: EntityId): void {
  for (const o of engagedWith(lv, victim)) {
    const oc = lv.c.combat.get(o);
    if (oc?.intent && isStanding(lv, victim)) openHit(g, lv, o, victim, oc.intent);
  }
}

/** NPC vs NPC exchange (squad vs enemies). */
export function npcExchange(g: Game, lv: Level, a: EntityId, b: EntityId): void {
  const ca = combatOf(lv, a), cb = combatOf(lv, b);
  if (!ca.intent || ca.intentTarget !== b) commitIntent(g, lv, a, b);
  if (lv.c.dummy.has(b)) {
    resolveExchange(g, lv, a, ca.intent!, b, 'guard', { quiet: true });
    return;
  }
  if (!cb.intent || cb.intentTarget !== a) commitIntent(g, lv, b, a);
  resolveExchange(g, lv, a, ca.intent!, b, cb.intent!, { quiet: true });
  if (isStanding(lv, b) && b !== lv.playerId) lv.scheduler.schedule(b, g.clock + EXCHANGE_TICKS);
}
