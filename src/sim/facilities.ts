/**
 * Village services: shop, hospital, ramen stand, home, training shed.
 * Each returns a short outcome message; failures return { ok: false }.
 */

import type { Game } from './game.ts';
import type { Attr, ItemKind, Skill } from '../ecs/components.ts';
import { ITEMS } from '../content/items.ts';
import { HOSPITAL_PRICE, TICKS_PER_HOUR, TICKS_PER_DAY, TRAINING_DAILY_HOURS, XP } from '../core/config.ts';
import { skipTime } from './turn.ts';
import { train, STAT_LABEL } from './progress.ts';
import { refreshMaxima } from './vitals.ts';

export interface Outcome { ok: boolean; text: string }

export function buy(g: Game, kind: ItemKind, n = 1): Outcome {
  const price = ITEMS[kind].price * n;
  const inv = g.player.inventory;
  if (inv.ryo < price) return { ok: false, text: `Not enough ryo (${price} needed).` };
  inv.ryo -= price;
  inv.items[kind] = (inv.items[kind] ?? 0) + n;
  return { ok: true, text: `Bought ${n} ${n === 1 ? ITEMS[kind].name : ITEMS[kind].plural} for ${price} ryo.` };
}

export function sellPrice(kind: ItemKind): number {
  return Math.max(1, Math.floor(ITEMS[kind].price * 0.4));
}

export function sell(g: Game, kind: ItemKind, n = 1): Outcome {
  const inv = g.player.inventory;
  if ((inv.items[kind] ?? 0) < n) return { ok: false, text: 'You don\'t have that many.' };
  inv.items[kind]! -= n;
  inv.ryo += sellPrice(kind) * n;
  return { ok: true, text: `Sold for ${sellPrice(kind) * n} ryo.` };
}

export function isInjured(g: Game): boolean {
  return g.player.injuredUntil > g.clock;
}

export function hospital(g: Game): Outcome {
  const v = g.player.vitals;
  const hurt = v.hp < v.hpMax || isInjured(g);
  if (!hurt) return { ok: false, text: 'Dr. Shimizu looks you over. "You\'re fine. Go away."' };
  const price = g.player.inventory.ryo >= HOSPITAL_PRICE ? HOSPITAL_PRICE : 0;
  g.player.inventory.ryo -= price;
  skipTime(g, TICKS_PER_HOUR * (isInjured(g) ? 6 : 2), { restore: 1 });
  g.player.injuredUntil = 0;
  refreshMaxima(v, g.player.sheet);
  v.hp = v.hpMax;
  g.level.remove(g.level.playerId, 'bleed');
  return { ok: true, text: price ? `Treated and patched up (${price} ryo).` : 'You can\'t pay, but the medics treat you anyway. Konoha looks after its own.' };
}

export function ramen(g: Game): Outcome {
  const price = 12;
  if (g.player.inventory.ryo < price) return { ok: false, text: '"No ryo, no ramen." Old Tokuji is unmoved.' };
  g.player.inventory.ryo -= price;
  skipTime(g, TICKS_PER_HOUR / 3);
  const v = g.player.vitals;
  v.hp = Math.min(v.hpMax, v.hp + v.hpMax * 0.5);
  v.sta = v.staMax;
  v.chakra = Math.min(v.chakraMax, v.chakra + v.chakraMax * 0.3);
  return { ok: true, text: 'Miso ramen, extra pork. You feel like a new shinobi.' };
}

/** Sleep until 06:00. Full recovery. */
export function sleep(g: Game): Outcome {
  const dayTicks = g.clock % TICKS_PER_DAY;
  const six = 6 * TICKS_PER_HOUR;
  let ticks = six - dayTicks;
  if (ticks <= TICKS_PER_HOUR * 2) ticks += TICKS_PER_DAY;
  skipTime(g, ticks, { restore: 1 });
  const v = g.player.vitals;
  v.hp = v.hpMax; v.chakra = v.chakraMax; v.sta = v.staMax;
  return { ok: true, text: 'You sleep deeply and wake at dawn, rested.' };
}

export type TrainingKind = 'taijutsu' | 'bukijutsu' | 'ninjutsu' | 'stealth' | 'medicine' | 'conditioning' | 'meditation';

export const TRAINING: Record<TrainingKind, { label: string; desc: string; gains: Array<[Skill | Attr, number]> }> = {
  taijutsu: { label: 'Drill forms on the posts', desc: 'Taijutsu, some Body', gains: [['taijutsu', 1], ['body', 0.35]] },
  bukijutsu: { label: 'Throw at the targets', desc: 'Bukijutsu', gains: [['bukijutsu', 1], ['mind', 0.15]] },
  ninjutsu: { label: 'Practice hand signs', desc: 'Ninjutsu, some Chakra', gains: [['ninjutsu', 1], ['chakra', 0.3]] },
  stealth: { label: 'Run the shadow course', desc: 'Stealth', gains: [['stealth', 1], ['body', 0.15]] },
  medicine: { label: 'Study field medicine', desc: 'Medicine, some Mind', gains: [['medicine', 1], ['mind', 0.2]] },
  conditioning: { label: 'Run laps around the wall', desc: 'Body', gains: [['body', 1]] },
  meditation: { label: 'Meditate by the pond', desc: 'Chakra and Mind', gains: [['chakra', 0.8], ['mind', 0.6]] },
};

/** Time-skip training. Gains shrink once you've trained a full day's worth. */
export function trainSession(g: Game, kind: TrainingKind, hours: number): Outcome {
  const t = g.player.training;
  if (t.day !== g.day) { t.day = g.day; t.hours = 0; }
  const fresh = Math.max(0, Math.min(hours, TRAINING_DAILY_HOURS - t.hours));
  const tired = hours - fresh;
  const effective = fresh + tired * 0.2;
  t.hours += hours;
  const lv = g.level;
  const before: Record<string, number> = {};
  const def = TRAINING[kind];
  for (const [stat] of def.gains) before[stat] = valueOf(g, stat);
  skipTime(g, Math.round(hours * TICKS_PER_HOUR));
  for (const [stat, w] of def.gains) {
    const base = kind === 'meditation' ? XP.meditationHour : XP.trainingHour;
    train(g, lv, lv.playerId, stat, base * w * effective);
  }
  const v = g.player.vitals;
  if (kind !== 'meditation') v.sta = Math.max(0, v.staMax * 0.25);
  const parts = def.gains.map(([s]) => `${STAT_LABEL[s]} +${(valueOf(g, s) - before[s]).toFixed(2)}`);
  const note = tired > 0 ? ' You\'re running on fumes — rest before you train more today.' : '';
  return { ok: true, text: `${hours}h of training. ${parts.join(', ')}.${note}` };
}

function valueOf(g: Game, stat: Skill | Attr): number {
  const s = g.player.sheet;
  return (stat in s.skills ? s.skills[stat as Skill] : s.attrs[stat as Attr]);
}
