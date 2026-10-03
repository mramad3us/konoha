/**
 * Duels in the training-ground arena: friendly spars and promotion trials. Non-lethal; the
 * loser is knocked out and both fighters are patched up afterwards.
 */

import type { Game } from './game.ts';
import type { Level } from '../ecs/level.ts';
import type { EntityId, Rank, Sheet } from '../ecs/components.ts';
import type { Vec } from '../core/geometry.ts';
import { onDomain } from './hooks.ts';
import { revive, refreshMaxima } from './vitals.ts';
import { spawnArchetype } from './spawn.ts';
import { awareOf } from './stealth.ts';
import { train } from './progress.ts';
import { XP } from '../core/config.ts';
import { displayName } from './names.ts';

export interface DuelState {
  opponent: EntityId;
  kind: 'spar' | 'trial';
  /** Rank awarded on a trial win. */
  rank?: Rank;
  /** Spawned only for this duel (proctors) — removed afterwards. */
  temporary: boolean;
  /** Original ai to restore (sparring partners are villagers otherwise). */
  restoreAi?: string;
  savedSheet?: Sheet;
}

export function duelOf(g: Game): DuelState | null {
  return (g.ext.duel as DuelState | undefined) ?? null;
}

/** Start a duel in the arena. `opponent` existing NPC, or an archetype id to spawn. */
export function startDuel(g: Game, lv: Level, arena: Vec, opponent: EntityId | string, kind: 'spar' | 'trial', rank?: Rank): EntityId {
  let id: EntityId;
  let temporary = false;
  let restoreAi: string | undefined;
  let savedSheet: Sheet | undefined;
  const a = { x: arena.x - 2, y: arena.y }, b = { x: arena.x + 2, y: arena.y };
  if (typeof opponent === 'string') {
    id = spawnArchetype(g, lv, opponent, b.x, b.y, { facing: 'w' });
    temporary = true;
  } else {
    id = opponent;
    restoreAi = lv.c.actor.get(id)!.ai;
    lv.c.actor.get(id)!.ai = 'examiner';
    // Sparring partners keep pace with you: a little better than you.
    const sheet = lv.c.sheet.get(id)!;
    savedSheet = structuredClone(sheet);
    const me = g.player.sheet;
    sheet.skills.taijutsu = Math.max(sheet.skills.taijutsu, me.skills.taijutsu + 2);
    sheet.attrs.body = Math.max(sheet.attrs.body, me.attrs.body);
    const v = lv.c.vitals.get(id)!;
    refreshMaxima(v, sheet);
    v.hp = v.hpMax; v.sta = v.staMax;
    lv.moveTo(id, b.x, b.y, 'w');
  }
  lv.moveTo(lv.playerId, a.x, a.y, 'e');
  lv.add(id, 'duel', { opponent: lv.playerId });
  lv.add(lv.playerId, 'duel', { opponent: id });
  if (!lv.c.aware.has(id)) awareOf(lv, id);
  const aw = lv.c.aware.get(id)!;
  Object.assign(aw, { state: 'alert', level: 100, target: lv.playerId, lastKnown: { ...a }, lastSeenTick: g.clock });
  const brain = lv.c.brain.get(id);
  if (brain) { brain.mode = 'post'; brain.flee = 0; }
  const c = lv.c.combat.get(id);
  if (c) c.lethal = false;
  g.ext.duel = { opponent: id, kind, rank, temporary, restoreAi, savedSheet } satisfies DuelState;
  lv.scheduler.schedule(id, g.clock + 5);
  g.say(kind === 'trial' ? `The proctor bows. "Show me you're ready." The trial begins.` : `${displayName(lv, id)} grins and raises a guard. "First one down loses!"`, 'system');
  return id;
}

function endDuel(g: Game, lv: Level, loser: EntityId): void {
  const d = duelOf(g);
  if (!d) return;
  const won = loser !== lv.playerId;
  const opp = d.opponent;
  lv.remove(opp, 'duel');
  lv.remove(lv.playerId, 'duel');
  for (const id of [lv.playerId, opp]) {
    if (lv.c.ko.has(id)) revive(g, lv, id, 0.5);
    lv.remove(id, 'bleed');
    const c = lv.c.combat.get(id);
    if (c) { c.intent = null; c.intentTarget = null; c.tempo = 0; c.staggered = false; }
  }
  const aw = lv.c.aware.get(opp);
  if (aw) Object.assign(aw, { state: 'idle', level: 0, target: null });
  if (d.temporary) lv.destroy(opp);
  else {
    if (d.restoreAi) lv.c.actor.get(opp)!.ai = d.restoreAi as never;
    if (d.savedSheet) lv.add(opp, 'sheet', d.savedSheet);
    const brain = lv.c.brain.get(opp);
    if (brain) brain.mode = brain.baseMode ?? 'wander';
  }
  delete g.ext.duel;
  if (d.kind === 'spar') {
    g.say(won ? 'You win the spar. Your partner laughs it off and demands a rematch.' : 'You yield. A good lesson, if a painful one.', won ? 'good' : 'info');
    train(g, lv, lv.playerId, 'taijutsu', won ? XP.exchangeWin * 3 : XP.exchangeWin * 1.5);
  } else if (won && d.rank) {
    g.player.sheet.rank = d.rank;
    g.player.name.title = d.rank === 'chunin' ? 'Chunin' : 'Jonin';
    if (d.rank === 'chunin') g.player.appearance.vest = 'chunin';
    g.say(`The proctor nods. "Congratulations, ${d.rank === 'chunin' ? 'Chunin' : 'Jonin'}." Report to the Hokage Tower for your new duties.`, 'skill');
    g.player.flags[`promoted_${d.rank}`] = true;
  } else {
    g.say('The proctor helps you up. "Not yet. Train, and come back."', 'bad');
    g.player.flags.trialCooldownDay = g.day + 2;
  }
}

onDomain((g, lv, e) => {
  if (e.type === 'ko' && lv.c.duel.has(e.id)) endDuel(g, lv, e.id);
});
