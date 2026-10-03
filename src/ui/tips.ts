/**
 * One-time contextual tips. Each fires the first moment it becomes relevant, once per save.
 */

import type { Game } from '../sim/game.ts';
import { engagedWith } from '../sim/combat.ts';
import { isStanding } from '../sim/vitals.ts';
import { isHostile } from '../sim/factions.ts';
import { labelFor, signLabel } from './keys.ts';
import { TECHNIQUES } from '../content/techniques.ts';

interface Tip { id: string; when: (g: Game) => boolean; text: () => string }

const TIPS: Tip[] = [
  {
    id: 'start',
    when: g => g.level.kind === 'village',
    text: () => `Move with the arrow keys, the numpad, H J K L Y U B N, or a click. Walk into a door to go inside. ${labelFor('help')} shows every control.`,
  },
  {
    id: 'exchange',
    when: g => engagedWith(g.level, g.level.playerId).length > 0,
    text: () => `In melee, ${labelFor('strike')} Strike beats Break, ${labelFor('break')} Break beats Guard, ${labelFor('guard')} Guard beats Strike. The icon above their head is what you've read of their next move.`,
  },
  {
    id: 'unaware',
    when: g => {
      const lv = g.level;
      for (const [id, aw] of lv.c.aware) {
        const p = lv.c.pos.get(id);
        if (p && lv.visible[lv.idx(p.x, p.y)] && aw.state === 'idle' && isStanding(lv, id) && isHostile(lv, id, lv.playerId)) return true;
      }
      return false;
    },
    text: () => `They haven't seen you. ${labelFor('sneak')} to sneak and see their sight lines; strike from behind for a silent takedown. ${labelFor('lethal')} decides whether it kills.`,
  },
  {
    id: 'downed',
    when: g => {
      const lv = g.level;
      for (const [id] of lv.c.ko) if (id !== lv.playerId && isHostile(lv, id, lv.playerId) && lv.visible[lv.idx(lv.c.pos.get(id)!.x, lv.c.pos.get(id)!.y)]) return true;
      return false;
    },
    text: () => `Knocked out. ${labelFor('interact')} next to them to bind, search, carry or finish them. If they're bleeding, they die within a minute unless bandaged.`,
  },
  {
    id: 'tempo',
    when: g => (g.level.c.combat.get(g.level.playerId)?.tempo ?? 0) > 0,
    text: () => `Tempo! Each point hits harder and reads clearer. Walking away while engaged spends one instead of taking a free hit; ${labelFor('kawarimi')} Kawarimi costs one too.`,
  },
  {
    id: 'mission_map',
    when: g => g.level.kind === 'mission',
    text: () => 'The gold tiles where you came in are your way out. Leaving before the job is done fails the mission.',
  },
  {
    id: 'night',
    when: g => g.hour >= 20 || g.hour < 5,
    text: () => 'Night shortens everyone\'s sight — torches and lanterns undo that. Bandits sleep at night.',
  },
  {
    id: 'signs',
    when: g => g.player.sheet.techniques.includes('vanish'),
    text: () => `Hand signs live on the number row. Vanish: ${TECHNIQUES.vanish.signs!.map(s => signLabel(s)).join(' ')}. Signing takes time and a hit breaks it.`,
  },
];

export function nextTip(g: Game): { id: string; text: string } | null {
  for (const t of TIPS) {
    const key = `tip_${t.id}`;
    if (g.player.flags[key]) continue;
    if (t.when(g)) return { id: t.id, text: t.text() };
  }
  return null;
}

export function markTip(g: Game, id: string): void {
  g.player.flags[`tip_${id}`] = true;
}
