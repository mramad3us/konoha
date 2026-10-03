/**
 * Creating characters: the player (linked to the profile) and NPCs from archetypes.
 */

import type { Level } from '../ecs/level.ts';
import type { Appearance, EntityId, Sheet, ItemKind, AiKind, Faction } from '../ecs/components.ts';
import { ATTRS, SKILLS } from '../ecs/components.ts';
import type { Dir8 } from '../core/geometry.ts';
import type { Game, PlayerProfile } from './game.ts';
import { ARCHETYPES, rollRange } from '../content/archetypes.ts';
import { knownTechniques } from '../content/techniques.ts';
import { freshVitals } from './vitals.ts';
import { START_RYO } from '../core/config.ts';
import { leafLook } from '../content/looks.ts';
import { Rng, hashString } from '../core/rng.ts';

export function newProfile(name: string, frame: 'm' | 'f', appearance?: Appearance): PlayerProfile {
  const sheet: Sheet = {
    attrs: { body: 12, chakra: 10, mind: 8 },
    skills: { taijutsu: 8, bukijutsu: 6, ninjutsu: 5, stealth: 4, medicine: 2 },
    rank: 'genin',
    techniques: [],
  };
  sheet.techniques = knownTechniques(sheet.skills.ninjutsu);
  const look = appearance ?? leafLook(new Rng(hashString(name)), frame, false);
  return {
    name: { name, title: 'Genin', unique: true },
    appearance: look,
    sheet,
    vitals: freshVitals(sheet),
    inventory: { items: { kunai: 6, shuriken: 8, bandage: 3 }, ryo: START_RYO },
    lethal: false,
    record: { missions: { D: 0, C: 0, B: 0, A: 0 }, failed: 0, kills: 0, takedowns: 0, defeats: 0 },
    training: { day: 0, hours: 0 },
    injuredUntil: 0,
    flags: {},
  };
}

/** Put the player into a level, sharing the profile's objects by reference. */
export function placePlayer(g: Game, lv: Level, x: number, y: number, facing: Dir8 = 's'): EntityId {
  let id = lv.playerId;
  if (!id || !lv.entities.has(id)) {
    id = lv.create();
    lv.playerId = id;
  }
  linkPlayer(g, lv);
  if (lv.c.pos.has(id)) lv.moveTo(id, x, y, facing);
  else lv.add(id, 'pos', { x, y, facing });
  if (!lv.c.blocker.has(id)) lv.add(id, 'blocker', { move: true, sight: false });
  if (!lv.c.faction.has(id)) lv.add(id, 'faction', { id: 'leaf' });
  if (!lv.c.actor.has(id)) lv.add(id, 'actor', { ai: 'player', stance: 'walk', speed: 1 });
  if (!lv.c.combat.has(id)) {
    lv.add(id, 'combat', { tempo: 0, staggered: false, history: [], intent: null, intentTarget: null, reveal: 'hidden', revealAlt: null, lethal: false, style: null });
  }
  lv.scheduler.schedule(id, g.clock);
  return id;
}

/** (Re)attach profile-owned components to the level's player entity. */
export function linkPlayer(g: Game, lv: Level): void {
  const id = lv.playerId;
  if (!id) return;
  lv.add(id, 'sheet', g.player.sheet);
  lv.add(id, 'vitals', g.player.vitals);
  lv.add(id, 'inventory', g.player.inventory);
  lv.add(id, 'appearance', g.player.appearance);
  lv.add(id, 'name', g.player.name);
}

export interface SpawnOpts {
  name?: string;
  title?: string;
  facing?: Dir8;
  ai?: AiKind;
  faction?: Faction;
  look?: Appearance;
  /** Override stats (e.g. squad members from the roster). */
  sheet?: Sheet;
  rng?: Rng;
}

export function spawnArchetype(g: Game, lv: Level, archId: string, x: number, y: number, opts: SpawnOpts = {}): EntityId {
  const arch = ARCHETYPES[archId];
  if (!arch) throw new Error(`Unknown archetype ${archId}`);
  const rng = opts.rng ?? g.rng;
  const id = lv.create();
  const sheet: Sheet = opts.sheet ?? {
    attrs: Object.fromEntries(ATTRS.map(a => [a, rollRange(rng, arch.attrs[a])])) as Sheet['attrs'],
    skills: Object.fromEntries(SKILLS.map(s => [s, rollRange(rng, arch.skills[s])])) as Sheet['skills'],
    rank: arch.rank,
    techniques: [],
  };
  if (!opts.sheet) sheet.techniques = knownTechniques(sheet.skills.ninjutsu);
  const ai = opts.ai ?? arch.ai;
  lv.add(id, 'pos', { x, y, facing: opts.facing ?? 's' });
  lv.add(id, 'name', { name: opts.name ?? (arch.names ? rng.pick(arch.names) : arch.label), title: opts.title ?? arch.label });
  lv.add(id, 'appearance', opts.look ?? arch.look(rng));
  lv.add(id, 'blocker', { move: true, sight: false });
  lv.add(id, 'faction', { id: opts.faction ?? arch.faction });
  lv.add(id, 'actor', { ai, stance: 'walk', speed: 1 });
  lv.add(id, 'sheet', sheet);
  lv.add(id, 'vitals', freshVitals(sheet));
  lv.add(id, 'combat', {
    tempo: 0, staggered: false, history: [], intent: null, intentTarget: null,
    reveal: 'hidden', revealAlt: null, lethal: arch.lethal, style: { ...arch.style },
  });
  lv.add(id, 'brain', {
    mode: 'idle', home: { x, y }, patrol: [], patrolIdx: 0, path: null, goal: null, waitUntil: 0,
    leader: null, schedule: null, sleeping: false, flee: arch.flee, barkTick: 0,
  });
  if (ai !== 'villager' && ai !== 'client') {
    lv.add(id, 'aware', { level: 0, state: 'idle', lastKnown: null, lastSeenTick: -1e9, target: null, bodies: [] });
  }
  const items: Partial<Record<ItemKind, number>> = {};
  for (const [k, r] of Object.entries(arch.ammo ?? {})) {
    const n = rollRange(rng, r as readonly [number, number]);
    if (n > 0) items[k as ItemKind] = n;
  }
  lv.add(id, 'inventory', { items, ryo: 0 });
  lv.scheduler.schedule(id, g.clock + rng.int(1, 10));
  return id;
}

/** A training dummy: takes hits, never fights back. */
export function spawnDummy(lv: Level, x: number, y: number): EntityId {
  const id = lv.create();
  lv.add(id, 'pos', { x, y, facing: 's' });
  lv.add(id, 'name', { name: 'training dummy' });
  lv.add(id, 'sprite', { art: 'dummy' });
  lv.add(id, 'blocker', { move: true, sight: false });
  lv.add(id, 'faction', { id: 'neutral' });
  lv.add(id, 'dummy', {});
  lv.add(id, 'vitals', { hp: 999, hpMax: 999, sta: 99, staMax: 99, chakra: 0, chakraMax: 0, exertTick: 0 });
  lv.add(id, 'combat', { tempo: 0, staggered: false, history: [], intent: null, intentTarget: null, reveal: 'hidden', revealAlt: null, lethal: false, style: null });
  return id;
}
