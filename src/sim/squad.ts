/**
 * The squad roster: genin and chunin who join you from C-rank up. Their skills keep pace with
 * yours; their fates (injury, death) persist.
 */

import type { Game } from './game.ts';
import type { Level } from '../ecs/level.ts';
import type { Appearance, EntityId, Sheet } from '../ecs/components.ts';
import type { Vec } from '../core/geometry.ts';
import { Rng } from '../core/rng.ts';
import { leafLook } from '../content/looks.ts';
import { spawnArchetype } from './spawn.ts';
import { knownTechniques } from '../content/techniques.ts';
import { nearestFree } from '../world/gen/mission.ts';
import { TICKS_PER_DAY } from '../core/config.ts';

export type Personality = 'stoic' | 'brash' | 'kind' | 'wry';

export interface RosterMember {
  id: string;
  name: string;
  appearance: Appearance;
  personality: Personality;
  status: 'ready' | 'injured' | 'dead';
  until: number;
  missions: number;
}

const NAMES_M = ['Ren', 'Shota', 'Kaito', 'Daigo', 'Yamato', 'Kenji', 'Tora', 'Haku'];
const NAMES_F = ['Aya', 'Sakiko', 'Natsu', 'Rin', 'Chiyo', 'Momo', 'Yui', 'Kaede'];

export const SQUAD_LINES: Record<Personality, { start: string[]; hit: string[]; win: string[] }> = {
  stoic: { start: ['Understood.', 'Moving.'], hit: ['…', 'Hn.'], win: ['Clear.', 'Target down.'] },
  brash: { start: ['Finally, some action!', 'Leave some for me!'], hit: ['Ow! Cheap shot!', 'Gah!'], win: ['Ha! Too easy!', 'Who\'s next?!'] },
  kind: { start: ['Stay safe, everyone.', 'I\'ve got your back.'], hit: ['Ngh — I\'m fine!', 'Don\'t worry about me!'], win: ['Is everyone okay?', 'It\'s over.'] },
  wry: { start: ['Another glamorous day.', 'Try not to get us killed.'], hit: ['Rude.', 'That\'ll bruise.'], win: ['Well, that happened.', 'Next time, I pick the mission.'] },
};

export function roster(g: Game): RosterMember[] {
  let r = g.ext.roster as RosterMember[] | undefined;
  if (!r) {
    const rng = new Rng(g.seed + 77);
    r = [];
    for (let i = 0; i < 6; i++) {
      const frame = i % 2 ? 'f' : 'm';
      const name = frame === 'm' ? NAMES_M[i] : NAMES_F[i];
      r.push({
        id: `sq${i}`, name, appearance: leafLook(rng, frame, false),
        personality: rng.pick(['stoic', 'brash', 'kind', 'wry'] as const),
        status: 'ready', until: 0, missions: 0,
      });
    }
    g.ext.roster = r;
  }
  for (const m of r) if (m.status === 'injured' && g.clock >= m.until) m.status = 'ready';
  return r;
}

export function assignSquad(g: Game, size = 2): string[] {
  const ready = roster(g).filter(m => m.status === 'ready').sort((a, b) => b.missions - a.missions);
  return ready.slice(0, size).map(m => m.id);
}

/** A squadmate's sheet, scaled to the player's. */
function squadSheet(g: Game, rng: Rng): Sheet {
  const p = g.player.sheet;
  const f = 0.85 + rng.next() * 0.2;
  const sk = Object.fromEntries(Object.entries(p.skills).map(([k, v]) => [k, Math.max(4, Math.round(v * f + rng.int(-2, 2)))])) as Sheet['skills'];
  const at = Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, Math.max(6, Math.round(v * f + rng.int(-1, 2)))])) as Sheet['attrs'];
  return { skills: sk, attrs: at, rank: p.rank, techniques: knownTechniques(sk.ninjutsu) };
}

export function spawnSquad(g: Game, lv: Level, ids: string[], near: Vec): EntityId[] {
  const rng = new Rng(g.seed + g.clock);
  const out: EntityId[] = [];
  for (const rid of ids) {
    const m = roster(g).find(x => x.id === rid);
    if (!m || m.status !== 'ready') continue;
    const at = nearestFree(lv, { x: near.x + rng.int(-1, 1), y: near.y + 1 }) ?? near;
    const id = spawnArchetype(g, lv, 'sparring', at.x, at.y, {
      name: m.name, title: 'Squadmate', ai: 'squad', faction: 'leaf', look: m.appearance, sheet: squadSheet(g, rng), rng,
    });
    lv.add(id, 'squad', { rosterId: m.id, personality: m.personality });
    lv.remove(id, 'aware');
    const brain = lv.c.brain.get(id)!;
    brain.leader = lv.playerId;
    brain.flee = 0;
    lv.add(id, 'inventory', { items: { kunai: 3, shuriken: 5, bandage: 1 }, ryo: 0 });
    out.push(id);
  }
  return out;
}

/** After leaving a level: record what happened to everyone. */
export function syncSquad(g: Game, lv: Level): string[] {
  const notes: string[] = [];
  for (const [id, tag] of lv.c.squad) {
    const m = roster(g).find(x => x.id === tag.rosterId);
    if (!m) continue;
    if (lv.c.dead.has(id)) {
      m.status = 'dead';
      notes.push(`${m.name} was killed in action.`);
    } else if (lv.c.ko.has(id)) {
      m.status = 'injured';
      m.until = g.clock + TICKS_PER_DAY * 3;
      notes.push(`${m.name} was badly hurt and will be out for a few days.`);
    }
  }
  return notes;
}

export function finishMissionForSquad(g: Game, ids: string[]): void {
  for (const id of ids) {
    const m = roster(g).find(x => x.id === id);
    if (m && m.status !== 'dead') m.missions++;
  }
}
