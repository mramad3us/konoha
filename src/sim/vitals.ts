/**
 * Health, stamina, chakra, knockouts, death, bleeding and regeneration.
 * The single authority for state transitions: standing → knocked out → dead.
 */

import type { Level } from '../ecs/level.ts';
import type { EntityId, Sheet, Vitals } from '../ecs/components.ts';
import type { Game } from './game.ts';
import {
  HP_BASE, HP_PER_BODY, STAMINA_BASE, STAMINA_PER_BODY, CHAKRA_BASE, CHAKRA_PER_CHAKRA,
  KO_MIN_SECONDS, KO_MAX_SECONDS, KO_BLEED_DEATH_SECONDS, TICKS_PER_SECOND,
  STAMINA_REGEN_PER_SEC, STAMINA_REGEN_DELAY_TICKS, CHAKRA_REGEN_PER_SEC, HP_REGEN_PER_SEC,
} from '../core/config.ts';
import { fire } from './hooks.ts';
import { displayName } from './names.ts';

export function maxima(sheet: Sheet): { hpMax: number; staMax: number; chakraMax: number } {
  return {
    hpMax: Math.round(HP_BASE + sheet.attrs.body * HP_PER_BODY),
    staMax: Math.round(STAMINA_BASE + sheet.attrs.body * STAMINA_PER_BODY),
    chakraMax: Math.round(CHAKRA_BASE + sheet.attrs.chakra * CHAKRA_PER_CHAKRA),
  };
}

export function freshVitals(sheet: Sheet): Vitals {
  const m = maxima(sheet);
  return { hp: m.hpMax, hpMax: m.hpMax, sta: m.staMax, staMax: m.staMax, chakra: m.chakraMax, chakraMax: m.chakraMax, exertTick: -1e9 };
}

/** Re-derive maxima after attributes changed; current values keep their absolute amount. */
export function refreshMaxima(v: Vitals, sheet: Sheet): void {
  const m = maxima(sheet);
  v.hp += Math.max(0, m.hpMax - v.hpMax);
  v.sta += Math.max(0, m.staMax - v.staMax);
  v.chakra += Math.max(0, m.chakraMax - v.chakraMax);
  v.hpMax = m.hpMax; v.staMax = m.staMax; v.chakraMax = m.chakraMax;
  v.hp = Math.min(v.hp, v.hpMax); v.sta = Math.min(v.sta, v.staMax); v.chakra = Math.min(v.chakra, v.chakraMax);
}

export function isDown(lv: Level, id: EntityId): boolean {
  return lv.c.ko.has(id) || lv.c.dead.has(id);
}

export function isStanding(lv: Level, id: EntityId): boolean {
  return lv.c.vitals.has(id) && !isDown(lv, id) && !lv.c.restrained.has(id) && !lv.c.carried.has(id);
}

export function spendStamina(g: Game, lv: Level, id: EntityId, amount: number): void {
  const v = lv.c.vitals.get(id);
  if (!v || amount <= 0) return;
  v.sta = Math.max(0, v.sta - amount);
  v.exertTick = g.clock;
}

export function spendChakra(lv: Level, id: EntityId, amount: number): boolean {
  const v = lv.c.vitals.get(id);
  if (!v || v.chakra < amount) return false;
  v.chakra -= amount;
  return true;
}

/** Deal damage. Returns true if this knocked the target out. */
export function damage(
  g: Game, lv: Level, id: EntityId, amount: number, source: EntityId | null,
  kind: 'melee' | 'thrown' | 'bleed' | 'takedown', crit = false,
): boolean {
  const v = lv.c.vitals.get(id);
  if (!v || lv.c.dead.has(id)) return false;
  const amt = Math.max(0, Math.round(amount));
  if (lv.c.dummy.has(id)) {
    lv.emit({ t: 'damage', id, amount: amt, crit, source, kind });
    return false;
  }
  v.hp = Math.max(0, v.hp - amt);
  lv.emit({ t: 'damage', id, amount: amt, crit, source, kind });
  if (amt > 0 && lv.c.invisible.has(id)) {
    lv.remove(id, 'invisible');
    lv.emit({ t: 'smoke', at: { ...lv.c.pos.get(id)! } });
  }
  if (amt > 0 && lv.c.signing.has(id)) {
    lv.remove(id, 'signing');
    if (id === lv.playerId) g.say('The blow breaks your concentration — the signs scatter.', 'hurt');
  }
  if (v.hp <= 0 && !lv.c.ko.has(id)) {
    knockOut(g, lv, id, source);
    return true;
  }
  return false;
}

export function knockOut(g: Game, lv: Level, id: EntityId, by: EntityId | null): void {
  if (lv.c.ko.has(id) || lv.c.dead.has(id)) return;
  const v = lv.c.vitals.get(id);
  if (v) v.hp = 0;
  const wake = g.clock + g.rng.int(KO_MIN_SECONDS, KO_MAX_SECONDS) * TICKS_PER_SECOND;
  lv.add(id, 'ko', { since: g.clock, wake });
  dropDownState(lv, id);
  lv.emit({ t: 'ko', id });
  if (id === lv.playerId) {
    if (lv.c.duel.has(id)) g.say('You hit the dirt. That\'s the match.', 'hurt');
    else {
      g.say('Your vision tunnels. The ground rushes up to meet you.', 'hurt');
      g.request({ kind: 'defeat' });
    }
  } else {
    g.say(`${displayName(lv, id)} collapses, out cold.`, by === lv.playerId ? 'good' : 'combat');
  }
  fire(g, lv, { type: 'ko', id, by });
}

/** Kill an entity. The player is never killed: it is knocked out instead (defeat flow). */
export function kill(g: Game, lv: Level, id: EntityId, by: EntityId | null, cause: string): void {
  if (lv.c.dead.has(id)) return;
  if (id === lv.playerId) {
    knockOut(g, lv, id, by);
    return;
  }
  const v = lv.c.vitals.get(id);
  if (v) v.hp = 0;
  lv.remove(id, 'ko');
  lv.remove(id, 'bleed');
  lv.add(id, 'dead', { tick: g.clock, killer: by, cause });
  dropDownState(lv, id);
  lv.remove(id, 'restrained');
  lv.scheduler.unschedule(id);
  lv.emit({ t: 'death', id });
  const name = displayName(lv, id);
  const msg = cause === 'bleed' ? `${name} bleeds out.` : by === lv.playerId ? `You end ${name}.` : `${name} is dead.`;
  g.say(msg, by === lv.playerId ? 'good' : 'combat');
  fire(g, lv, { type: 'death', id, by });
}

function dropDownState(lv: Level, id: EntityId): void {
  const b = lv.c.blocker.get(id);
  if (b) b.move = false;
  const c = lv.c.combat.get(id);
  if (c) { c.intent = null; c.intentTarget = null; c.staggered = false; c.tempo = 0; }
  lv.remove(id, 'signing');
  lv.remove(id, 'invisible');
  const carrying = lv.c.carrying.get(id);
  if (carrying) {
    lv.remove(id, 'carrying');
    lv.remove(carrying.target, 'carried');
    const p = lv.c.pos.get(id);
    if (p) lv.moveTo(carrying.target, p.x, p.y);
  }
}

export function revive(g: Game, lv: Level, id: EntityId, hpFrac: number): void {
  if (!lv.c.ko.has(id) || lv.c.dead.has(id)) return;
  lv.remove(id, 'ko');
  const v = lv.c.vitals.get(id);
  if (v) v.hp = Math.max(1, Math.round(v.hpMax * hpFrac));
  if (!lv.c.restrained.has(id) && !lv.c.carried.has(id)) {
    const b = lv.c.blocker.get(id);
    if (b) b.move = true;
  }
  lv.emit({ t: 'revive', id });
  if (lv.c.actor.has(id) && id !== lv.playerId && !lv.scheduler.isScheduled(id)) {
    lv.scheduler.schedule(id, g.clock + 10);
  }
}

export function applyBleed(g: Game, lv: Level, id: EntityId, rate: number): void {
  if (lv.c.dummy.has(id) || lv.c.dead.has(id)) return;
  const b = lv.c.bleed.get(id);
  if (b) b.rate = Math.min(3, Math.max(b.rate, rate) + 0.2);
  else lv.add(id, 'bleed', { rate, since: g.clock });
}

/** Once per second: bleeding, regeneration, waking up. */
export function pulseVitals(g: Game, lv: Level): void {
  for (const [id, v] of lv.c.vitals) {
    if (lv.c.dead.has(id)) continue;
    const bleed = lv.c.bleed.get(id);
    const ko = lv.c.ko.get(id);
    if (bleed) {
      if (ko) {
        if (g.clock - Math.max(ko.since, bleed.since) >= KO_BLEED_DEATH_SECONDS * TICKS_PER_SECOND) {
          kill(g, lv, id, null, 'bleed');
          continue;
        }
      } else {
        v.hp -= bleed.rate;
        if (v.hp <= 0) {
          v.hp = 0;
          knockOut(g, lv, id, null);
          continue;
        }
      }
      // Wounds only clot on their own while conscious.
      if (!ko) bleed.rate -= 0.03;
      if (bleed.rate <= 0.05) {
        lv.remove(id, 'bleed');
        if (id === lv.playerId) g.say('Your wound has clotted.', 'info');
      }
    }
    if (ko) {
      if (id !== lv.playerId && !bleed && g.clock >= ko.wake) revive(g, lv, id, 0.2);
      continue;
    }
    // Regeneration
    const sheet = lv.c.sheet.get(id);
    const engaged = lv.c.combat.get(id)?.intent != null;
    if (g.clock - v.exertTick >= STAMINA_REGEN_DELAY_TICKS && v.sta < v.staMax) {
      v.sta = Math.min(v.staMax, v.sta + STAMINA_REGEN_PER_SEC * (1 + (sheet?.attrs.body ?? 0) / 40));
    }
    if (!engaged && v.chakra < v.chakraMax) {
      v.chakra = Math.min(v.chakraMax, v.chakra + CHAKRA_REGEN_PER_SEC * Math.max(5, sheet?.attrs.chakra ?? 5));
    }
    if (!engaged && !bleed && v.hp < v.hpMax) {
      v.hp = Math.min(v.hpMax, v.hp + HP_REGEN_PER_SEC * Math.max(5, sheet?.attrs.body ?? 5));
    }
  }
}
