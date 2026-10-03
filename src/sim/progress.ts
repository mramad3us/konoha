/**
 * Learning by doing. Only the player's sheet grows (NPCs are fixed per archetype).
 * Gains shrink as a value approaches 100; every whole-number crossing is announced.
 */

import type { Level } from '../ecs/level.ts';
import type { Attr, EntityId, Skill } from '../ecs/components.ts';
import { ATTRS } from '../ecs/components.ts';
import type { Game } from './game.ts';
import { SKILL_GAIN_CURVE } from '../core/config.ts';
import { refreshMaxima } from './vitals.ts';
import { TECHNIQUES, TECHNIQUE_ORDER } from '../content/techniques.ts';
import { tempoSlots } from '../core/config.ts';

export const STAT_LABEL: Record<Skill | Attr, string> = {
  taijutsu: 'Taijutsu', bukijutsu: 'Bukijutsu', ninjutsu: 'Ninjutsu', stealth: 'Stealth', medicine: 'Medicine',
  body: 'Body', chakra: 'Chakra', mind: 'Mind',
};

export function gainCurve(value: number, base: number): number {
  return base * Math.pow(Math.max(0, 1 - value / 100), SKILL_GAIN_CURVE);
}

/** Apply learning to the player. `base` is the gain at value 0. Returns the amount gained. */
export function train(g: Game, lv: Level, id: EntityId, stat: Skill | Attr, base: number, mult = 1): number {
  if (id !== lv.playerId) return 0;
  const sheet = g.player.sheet;
  const isAttr = (ATTRS as readonly string[]).includes(stat);
  const bag = (isAttr ? sheet.attrs : sheet.skills) as Record<string, number>;
  const before = bag[stat];
  const gain = gainCurve(before, base * mult);
  if (gain <= 0) return 0;
  const after = Math.min(100, before + gain);
  bag[stat] = after;
  if (Math.floor(after) > Math.floor(before)) {
    lv.emit({ t: 'progress', stat, from: Math.floor(before), to: Math.floor(after) });
    g.say(`${STAT_LABEL[stat]} improves to ${Math.floor(after)}.`, 'skill');
    if (isAttr) refreshMaxima(g.player.vitals, sheet);
    announceUnlocks(g, stat, before, after);
  }
  return gain;
}

function announceUnlocks(g: Game, stat: Skill | Attr, before: number, after: number): void {
  if (stat === 'ninjutsu') {
    for (const id of TECHNIQUE_ORDER) {
      const t = TECHNIQUES[id];
      if (before < t.unlock && after >= t.unlock) {
        if (!g.player.sheet.techniques.includes(id)) g.player.sheet.techniques.push(id);
        g.say(`New technique: ${t.name} (${t.jp}).`, 'skill');
      }
    }
  }
  if (stat === 'taijutsu' && tempoSlots(after) > tempoSlots(before)) {
    g.say(`Your rhythm sharpens: tempo capacity ${tempoSlots(after)}.`, 'skill');
  }
}
