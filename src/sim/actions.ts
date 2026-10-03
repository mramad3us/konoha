/**
 * The action pipeline. Player input and AI both produce Actions; `perform` validates and
 * applies them with identical rules, and returns how long they took.
 */

import type { Level } from '../ecs/level.ts';
import type { EntityId, ItemKind, Move, Stance } from '../ecs/components.ts';
import type { Game } from './game.ts';
import { DIR_VEC, chebyshev, dirFromDelta, euclid, type Dir8, type Vec } from '../core/geometry.ts';
import { terrainStep } from '../world/path.ts';
import { hasLos } from '../world/fov.ts';
import { TILES } from '../world/tiles.ts';
import {
  STEP_TICKS, CARRY_STEP_MULT, RUN_STAMINA_PER_STEP, DASH_CHAKRA_PER_STEP, SWIM_STAMINA_PER_STEP,
  WATER_WALK_CHAKRA_PER_STEP, WAIT_TICKS, EXCHANGE_TICKS, DOOR_TICKS, TAKEDOWN_TICKS, RESTRAIN_TICKS,
  SEARCH_TICKS, CARRY_TICKS, THROW_TICKS, BANDAGE_TICKS, STANCE_NOISE, NOISE_IMPACT, THROWN, THROW_HIT_BASE,
  THROW_HIT_PER_BUKI, THROW_HIT_PER_TILE, THROW_HIT_UNAWARE, THROW_HIT_ENGAGED, SNEAK_THROW_MULT, XP,
  PICKUP_TICKS, challengeMult,
} from '../core/config.ts';
import { canAttack, isHostile } from './factions.ts';
import {
  isStanding, isDown, damage, kill, knockOut, spendStamina, spendChakra, applyBleed,
} from './vitals.ts';
import {
  playerExchange, punishOpening, engagedWith, canAfford, combatOf, clearIntent, npcExchange, isLethal,
} from './combat.ts';
import { makeNoise, canTakedown, alertTo } from './stealth.ts';
import { train } from './progress.ts';
import { fire } from './hooks.ts';
import { displayName, cap } from './names.ts';
import { TECHNIQUES, HAND_SIGNS, matchSigns, signTicks, vanishDurationTicks, shadowStepRange } from '../content/techniques.ts';
import { ITEMS, itemLabel } from '../content/items.ts';
import { BARKS } from '../content/flavor.ts';

export type Action =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'wait'; ticks?: number }
  | { type: 'melee'; move: Move; target: EntityId }
  | { type: 'takedown'; target: EntityId; lethal: boolean }
  | { type: 'stance'; stance: Stance }
  | { type: 'interact'; target: EntityId }
  | { type: 'throw'; weapon: 'kunai' | 'shuriken'; target: EntityId }
  | { type: 'sign'; sign: number }
  | { type: 'kawarimi' }
  | { type: 'shadow_step'; x: number; y: number }
  | { type: 'use'; item: ItemKind }
  | { type: 'bandage'; target: EntityId }
  | { type: 'restrain'; target: EntityId }
  | { type: 'carry'; target: EntityId }
  | { type: 'drop' }
  | { type: 'search'; target: EntityId }
  | { type: 'finish'; target: EntityId }
  | { type: 'face'; dir: Dir8 };

export interface Result {
  ok: boolean;
  ticks: number;
  /** Why it failed (shown to the player). */
  reason?: string;
}

const FAIL = (reason: string): Result => ({ ok: false, ticks: 0, reason });
const OK = (ticks: number): Result => ({ ok: true, ticks });

export function perform(g: Game, lv: Level, id: EntityId, a: Action): Result {
  if (!isStanding(lv, id)) return FAIL('You can\'t act right now.');
  const r = dispatch(g, lv, id, a);
  if (r.ok) {
    const speed = lv.c.actor.get(id)?.speed ?? 1;
    r.ticks = Math.max(1, Math.round(r.ticks * speed));
    if (a.type !== 'sign' && lv.c.signing.has(id) && a.type !== 'wait') lv.remove(id, 'signing');
  }
  return r;
}

function dispatch(g: Game, lv: Level, id: EntityId, a: Action): Result {
  switch (a.type) {
    case 'move': return move(g, lv, id, a.dx, a.dy);
    case 'wait': return wait(g, lv, id, a.ticks);
    case 'melee': return melee(g, lv, id, a.move, a.target);
    case 'takedown': return takedown(g, lv, id, a.target, a.lethal);
    case 'stance': return stance(g, lv, id, a.stance);
    case 'interact': return interact(g, lv, id, a.target);
    case 'throw': return throwWeapon(g, lv, id, a.weapon, a.target);
    case 'sign': return sign(g, lv, id, a.sign);
    case 'kawarimi': return kawarimi(g, lv, id);
    case 'shadow_step': return shadowStep(g, lv, id, a.x, a.y);
    case 'use': return useItem(g, lv, id, a.item);
    case 'bandage': return bandage(g, lv, id, a.target);
    case 'restrain': return restrain(g, lv, id, a.target);
    case 'carry': return carry(g, lv, id, a.target);
    case 'drop': return drop(g, lv, id);
    case 'search': return search(g, lv, id, a.target);
    case 'finish': return finish(g, lv, id, a.target);
    case 'face': {
      const p = lv.c.pos.get(id)!;
      p.facing = a.dir;
      lv.emit({ t: 'face', id, dir: a.dir });
      return OK(2);
    }
  }
}

const isPlayer = (lv: Level, id: EntityId) => id === lv.playerId;

// ── Movement ──

export function canWaterWalk(lv: Level, id: EntityId): boolean {
  return (lv.c.sheet.get(id)?.techniques.includes('water_walk') ?? false) && (lv.c.vitals.get(id)?.chakra ?? 0) >= WATER_WALK_CHAKRA_PER_STEP;
}

function move(g: Game, lv: Level, id: EntityId, dx: number, dy: number): Result {
  const p = lv.c.pos.get(id)!;
  const dir = dirFromDelta(dx, dy);
  if (!dir) return wait(g, lv, id);
  const nx = p.x + dx, ny = p.y + dy;
  const actor = lv.c.actor.get(id)!;
  const player = isPlayer(lv, id);

  // Bump interactions.
  const blocker = lv.blockerAt(nx, ny);
  if (blocker !== null && blocker !== id) {
    if (canAttack(lv, id, blocker) && isStanding(lv, blocker)) {
      return melee(g, lv, id, 'strike', blocker);
    }
    const door = lv.c.door.get(blocker);
    if (door && !door.open) return interact(g, lv, id, blocker);
    // Swap with a friendly squadmate/client who is following you.
    if (player && (lv.c.squad.has(blocker) || lv.c.mission.get(blocker)?.role === 'client') && isStanding(lv, blocker)) {
      if (!terrainStep(lv, p.x, p.y, nx, ny)) return FAIL('The way is blocked.');
      lv.moveTo(blocker, p.x, p.y);
      lv.emit({ t: 'move', id: blocker, from: { x: nx, y: ny }, to: { x: p.x, y: p.y }, ticks: STEP_TICKS.walk });
    } else {
      p.facing = dir;
      lv.emit({ t: 'face', id, dir });
      return player ? FAIL(`${cap(displayName(lv, blocker))} is in the way.`) : FAIL('blocked');
    }
  }

  // Walking into a building's door enters it.
  if (!lv.isPassable(nx, ny)) {
    for (const e of lv.at(nx, ny)) {
      if (lv.c.interact.has(e) && lv.structs[lv.idx(nx, ny)]) {
        p.facing = dir;
        return player ? interact(g, lv, id, e) : FAIL('blocked');
      }
    }
  }

  const deep = lv.isSwimmable(nx, ny);
  const waterWalk = deep && canWaterWalk(lv, id);
  const swimming = deep && !waterWalk;
  if (!terrainStep(lv, p.x, p.y, nx, ny, deep)) {
    p.facing = dir;
    return player ? FAIL('The way is blocked.') : FAIL('blocked');
  }
  if (swimming) {
    if (!player && lv.c.actor.get(id)?.ai !== 'squad') return FAIL('no swimming');
    const v = lv.c.vitals.get(id);
    if (v && v.sta < SWIM_STAMINA_PER_STEP) return FAIL('Too exhausted to swim.');
  }

  // Leaving an engagement: pay a tempo to slip away cleanly, or eat every committed blow.
  const engaged = engagedWith(lv, id);
  if (engaged.length && player) {
    const c = combatOf(lv, id);
    if (c.tempo > 0) {
      c.tempo--;
      for (const o of engaged) clearIntent(lv, o);
      g.say('You use your momentum to slip out of reach.', 'combat');
    } else {
      punishOpening(g, lv, id);
      if (!isStanding(lv, id)) return OK(EXCHANGE_TICKS);
    }
  }

  // Stance → time and costs.
  let st: Stance = actor.stance;
  const carrying = lv.c.carrying.has(id);
  if (carrying && (st === 'run' || st === 'dash')) st = 'walk';
  const v = lv.c.vitals.get(id);
  if (st === 'run' && v && v.sta < RUN_STAMINA_PER_STEP) {
    st = 'walk';
    if (player) { actor.stance = 'walk'; g.say('Out of breath — you slow to a walk.', 'info'); }
  }
  if (st === 'dash' && v && v.chakra < DASH_CHAKRA_PER_STEP) {
    st = 'walk';
    if (player) { actor.stance = 'walk'; g.say('Your chakra gutters — the dash fades.', 'info'); }
  }
  let ticks = swimming ? STEP_TICKS.swim : STEP_TICKS[st];
  if (carrying) ticks *= CARRY_STEP_MULT;

  if (st === 'run') { spendStamina(g, lv, id, RUN_STAMINA_PER_STEP); train(g, lv, id, 'body', XP.bodyExertion * RUN_STAMINA_PER_STEP); }
  if (st === 'dash') { spendChakra(lv, id, DASH_CHAKRA_PER_STEP); train(g, lv, id, 'chakra', XP.chakraUse); train(g, lv, id, 'ninjutsu', XP.chakraUse * 0.5); }
  if (swimming) { spendStamina(g, lv, id, SWIM_STAMINA_PER_STEP); train(g, lv, id, 'body', XP.bodyExertion * 2); }
  if (waterWalk) { spendChakra(lv, id, WATER_WALK_CHAKRA_PER_STEP); train(g, lv, id, 'chakra', XP.chakraUse); }
  if (carrying) { spendStamina(g, lv, id, 0.3); train(g, lv, id, 'body', XP.bodyExertion); }

  const from = { x: p.x, y: p.y };
  lv.moveTo(id, nx, ny, dir);
  const carried = lv.c.carrying.get(id);
  if (carried) lv.moveTo(carried.target, nx, ny);
  lv.emit({ t: 'move', id, from, to: { x: nx, y: ny }, ticks });

  // Footstep noise.
  const noise = (swimming ? 3 : STANCE_NOISE[st]) * TILES[lv.tile(nx, ny)].noise;
  if (noise >= 1) makeNoise(g, lv, { x: nx, y: ny }, Math.round(noise), id);

  if (player) {
    pickupAt(g, lv, id, nx, ny);
    fire(g, lv, { type: 'stepped', id, x: nx, y: ny });
    const inZone = (z: { x0: number; y0: number; x1: number; y1: number } | undefined, x: number, y: number) =>
      !!z && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
    for (const z of [lv.meta.exitZone, lv.meta.exitZone2 as typeof lv.meta.exitZone]) {
      if (inZone(z, nx, ny) && !inZone(z, from.x, from.y)) { g.request({ kind: 'leave_area' }); break; }
    }
  }
  return OK(ticks);
}

function pickupAt(g: Game, lv: Level, id: EntityId, x: number, y: number): void {
  const inv = lv.c.inventory.get(id);
  if (!inv) return;
  for (const e of [...lv.at(x, y)]) {
    const item = lv.c.item.get(e);
    if (!item) continue;
    inv.items[item.kind] = (inv.items[item.kind] ?? 0) + item.count;
    lv.emit({ t: 'pickup', id, item: item.kind, count: item.count });
    if (isPlayer(lv, id)) g.say(`You pick up ${itemLabel(item.kind, item.count)}.`, 'item');
    lv.destroy(e);
  }
}

function wait(g: Game, lv: Level, id: EntityId, ticks?: number): Result {
  // Waiting in a fight means holding your guard.
  const engaged = engagedWith(lv, id);
  if (engaged.length && isPlayer(lv, id)) return melee(g, lv, id, 'guard', engaged[0]);
  return OK(ticks ?? WAIT_TICKS);
}

function stance(_g: Game, lv: Level, id: EntityId, s: Stance): Result {
  const actor = lv.c.actor.get(id)!;
  if (s === 'dash' && !lv.c.sheet.get(id)?.techniques.includes('dash')) {
    return FAIL('You haven\'t learned Chakra Dash yet (Ninjutsu 10).');
  }
  actor.stance = s;
  return { ok: true, ticks: 0 };
}

// ── Melee ──

function melee(g: Game, lv: Level, id: EntityId, m: Move, target: EntityId): Result {
  const p = lv.c.pos.get(id)!;
  const tp = lv.c.pos.get(target);
  if (!tp || chebyshev(p, tp) !== 1) return FAIL('Nobody within reach.');
  if (!canAttack(lv, id, target)) return FAIL('You won\'t strike them.');
  if (!isStanding(lv, target)) return FAIL('They\'re already down.');
  const dir = dirFromDelta(tp.x - p.x, tp.y - p.y)!;
  p.facing = dir;

  if (lv.c.invisible.has(id)) {
    lv.remove(id, 'invisible');
    lv.emit({ t: 'smoke', at: { x: p.x, y: p.y } });
  }

  // Striking from the shadows is a takedown.
  if (m !== 'guard' && canTakedown(g, lv, id, target)) {
    return takedown(g, lv, id, target, isLethal(g, lv, id));
  }
  if (!canAfford(lv, id, m)) return FAIL('Too exhausted — you can only Guard.');

  if (isPlayer(lv, id)) {
    playerExchange(g, lv, m, target);
  } else if (target === lv.playerId) {
    // NPCs never initiate exchanges against the player: they commit and wait (AI handles it).
    return FAIL('npc-vs-player handled by intents');
  } else {
    npcExchange(g, lv, id, target);
  }
  if (lv.c.aware.has(target) && isStanding(lv, target)) alertTo(g, lv, target, id);
  return OK(EXCHANGE_TICKS);
}

function takedown(g: Game, lv: Level, id: EntityId, target: EntityId, lethal: boolean): Result {
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target);
  if (!tp || chebyshev(p, tp) !== 1) return FAIL('Too far.');
  if (!canTakedown(g, lv, id, target)) return FAIL('They\'re watching you.');
  const stealth = lv.c.sheet.get(id)?.skills.stealth ?? 0;
  const ticks = Math.round(TAKEDOWN_TICKS * (1 - Math.min(0.5, stealth / 100)));
  lv.emit({ t: 'takedown', id, target, lethal });
  const name = displayName(lv, target);
  if (lethal) {
    if (isPlayer(lv, id)) g.say(`You slip behind ${name} and open their throat. Silent.`, 'good');
    kill(g, lv, target, id, 'assassination');
  } else {
    if (isPlayer(lv, id)) g.say(`You choke ${name} out from behind. They sag without a sound.`, 'good');
    knockOut(g, lv, target, id);
  }
  if (isPlayer(lv, id)) {
    g.player.record.takedowns++;
    const opp = lv.c.sheet.get(target)?.skills.taijutsu ?? 0;
    train(g, lv, id, 'stealth', XP.takedown, challengeMult(stealth, opp));
    train(g, lv, id, 'taijutsu', XP.takedown * 0.4);
  }
  makeNoise(g, lv, tp, 1, id);
  return OK(ticks);
}

// ── Interaction ──

function interact(g: Game, lv: Level, id: EntityId, target: EntityId): Result {
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target);
  if (!tp || chebyshev(p, tp) > 1) return FAIL('Too far away.');
  const door = lv.c.door.get(target);
  if (door) {
    if (door.locked) return FAIL('Locked.');
    door.open = !door.open;
    const b = lv.c.blocker.get(target);
    if (b) { b.move = !door.open; b.sight = !door.open; }
    lv.sightVersion++;
    lv.emit({ t: 'door', id: target, open: door.open });
    return OK(DOOR_TICKS);
  }
  const it = lv.c.interact.get(target);
  if (!it) {
    if (lv.c.talk.has(target) && isStanding(lv, target)) {
      if (lv.c.brain.get(target)?.mode === 'inside') return FAIL('Nobody answers.');
      const tp2 = lv.c.pos.get(target)!;
      const d = dirFromDelta(p.x - tp2.x, p.y - tp2.y);
      if (d) { tp2.facing = d; lv.emit({ t: 'face', id: target, dir: d }); }
      fire(g, lv, { type: 'talked', id: target });
      if (isPlayer(lv, id)) g.request({ kind: 'talk', entity: target });
      return OK(SECONDS2);
    }
    if (isPlayer(lv, id)) g.request({ kind: 'examine', entity: target });
    return { ok: true, ticks: 0 };
  }
  switch (it.kind) {
    case 'facility':
      g.request({ kind: 'facility', facility: it.facility ?? '', entity: target });
      return { ok: true, ticks: 0 };
    case 'talk':
    case 'deliver':
      fire(g, lv, { type: 'talked', id: target });
      g.request({ kind: 'talk', entity: target });
      return OK(SECONDS2);
    case 'collect':
      fire(g, lv, { type: 'collected', id: target });
      g.say(`You take ${displayName(lv, target)}.`, 'item');
      lv.destroy(target);
      return OK(PICKUP_TICKS);
    case 'examine':
      g.request({ kind: 'examine', entity: target });
      return { ok: true, ticks: 0 };
  }
}
const SECONDS2 = 20;

// ── Thrown weapons ──

export function throwHitChance(g: Game, lv: Level, id: EntityId, weapon: 'kunai' | 'shuriken', target: EntityId): number {
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target)!;
  const d = euclid(p, tp);
  const buki = lv.c.sheet.get(id)?.skills.bukijutsu ?? 0;
  const tTai = lv.c.sheet.get(target)?.skills.taijutsu ?? 0;
  let chance = THROW_HIT_BASE + buki * THROW_HIT_PER_BUKI + THROWN[weapon].accuracy + Math.max(0, d - 2) * THROW_HIT_PER_TILE - tTai * 0.35;
  const aw = lv.c.aware.get(target);
  if (!aw || aw.state !== 'alert' || lv.c.brain.get(target)?.sleeping) chance += THROW_HIT_UNAWARE;
  if (engagedWith(lv, target).length) chance += THROW_HIT_ENGAGED;
  if (lv.c.dummy.has(target)) chance += 15;
  if (lv.c.ko.has(target) || lv.c.restrained.has(target)) chance = 100;
  void g;
  return Math.max(5, Math.min(97, chance));
}

function throwWeapon(g: Game, lv: Level, id: EntityId, weapon: 'kunai' | 'shuriken', target: EntityId): Result {
  const inv = lv.c.inventory.get(id);
  if (!inv || (inv.items[weapon] ?? 0) <= 0) return FAIL(`No ${weapon} left.`);
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target);
  if (!tp) return FAIL('No target.');
  const d = euclid(p, tp);
  if (d > THROWN[weapon].range) return FAIL('Out of range.');
  if (d < 1.5 && engagedWith(lv, id).includes(target)) return FAIL('Too close to throw.');
  if (!hasLos(lv, p.x, p.y, tp.x, tp.y)) return FAIL('No clear line.');
  if (lv.c.invisible.has(id)) { lv.remove(id, 'invisible'); lv.emit({ t: 'smoke', at: { x: p.x, y: p.y } }); }

  // Throwing in melee leaves you open.
  if (isPlayer(lv, id) && engagedWith(lv, id).length) punishOpening(g, lv, id);
  if (!isStanding(lv, id)) return OK(EXCHANGE_TICKS);

  inv.items[weapon]! -= 1;
  const chance = throwHitChance(g, lv, id, weapon, target);
  const hit = g.rng.next() * 100 < chance;
  const unaware = !lv.c.aware.get(target) || lv.c.aware.get(target)!.state !== 'alert';
  const dir = dirFromDelta(tp.x - p.x, tp.y - p.y);
  if (dir) p.facing = dir;

  // Where the weapon ends up.
  let land: Vec = { x: tp.x, y: tp.y };
  if (!hit) {
    const over = { x: tp.x + Math.sign(tp.x - p.x) * g.rng.int(1, 2), y: tp.y + Math.sign(tp.y - p.y) * g.rng.int(0, 2) };
    if (lv.isPassable(over.x, over.y)) land = over;
  }
  lv.emit({ t: 'throw', source: id, from: { x: p.x, y: p.y }, to: land, weapon, hit, target: hit ? target : null });
  dropItem(lv, land.x, land.y, weapon, 1);

  const buki = lv.c.sheet.get(id)?.skills.bukijutsu ?? 0;
  if (hit) {
    const [lo, hi] = THROWN[weapon].damage;
    let dmg = g.rng.range(lo, hi) * (1 + buki / 100);
    if (unaware) dmg *= SNEAK_THROW_MULT;
    const crit = unaware && g.rng.chance(0.25);
    const knocked = damage(g, lv, target, dmg * (crit ? 1.5 : 1), id, 'thrown', crit);
    if (weapon === 'kunai' && g.rng.chance(0.35)) applyBleed(g, lv, target, 0.5 + g.rng.next() * 0.5);
    if (knocked && isLethal(g, lv, id) && weapon === 'kunai' && g.rng.chance(0.25) && target !== lv.playerId) kill(g, lv, target, id, 'kunai');
    if (isPlayer(lv, id)) g.say(`Your ${weapon} ${unaware ? 'flies true from the shadows into' : 'strikes'} ${displayName(lv, target)}.`, 'hit');
    else if (target === lv.playerId) g.say(`A ${weapon} from ${displayName(lv, id)} bites into you.`, 'hurt');
  } else {
    if (isPlayer(lv, id)) g.say(`Your ${weapon} misses ${displayName(lv, target)}.`, 'combat');
    else if (target === lv.playerId) g.say(`A ${weapon} whistles past your ear.`, 'combat');
  }
  makeNoise(g, lv, land, NOISE_IMPACT, id);
  if (lv.c.aware.has(target) && isStanding(lv, target)) alertTo(g, lv, target, id);
  if (isPlayer(lv, id)) {
    const opp = lv.c.sheet.get(target)?.skills.taijutsu ?? 0;
    train(g, lv, id, 'bukijutsu', hit ? XP.throwHit : XP.throwAny, lv.c.dummy.has(target) ? 0.5 : challengeMult(buki, opp));
  }
  const ticks = Math.round(THROW_TICKS * (1 - Math.min(0.5, buki / 120)));
  return OK(ticks);
}

export function dropItem(lv: Level, x: number, y: number, kind: ItemKind, count: number): void {
  for (const e of lv.at(x, y)) {
    const it = lv.c.item.get(e);
    if (it && it.kind === kind) { it.count += count; return; }
  }
  const e = lv.create();
  lv.add(e, 'pos', { x, y, facing: 's' });
  lv.add(e, 'item', { kind, count });
  lv.add(e, 'sprite', { art: `item_${kind}` });
  lv.add(e, 'name', { name: ITEMS[kind].name });
}

// ── Hand signs & techniques ──

function sign(g: Game, lv: Level, id: EntityId, s: number): Result {
  const sheet = lv.c.sheet.get(id);
  if (!sheet) return FAIL('');
  if (isPlayer(lv, id) && engagedWith(lv, id).length) punishOpening(g, lv, id);
  if (!isStanding(lv, id)) return OK(EXCHANGE_TICKS);
  let sg = lv.c.signing.get(id);
  if (!sg) sg = lv.add(id, 'signing', { signs: [], nextTick: 0 });
  sg.signs.push(s);
  lv.emit({ t: 'sign', id, sign: s });
  const ticks = signTicks(sheet.skills.ninjutsu);
  train(g, lv, id, 'ninjutsu', XP.sign);
  const m = matchSigns(sg.signs);
  if (m.status === 'invalid') {
    lv.remove(id, 'signing');
    if (isPlayer(lv, id)) g.say(`${HAND_SIGNS[s].jp}… the sequence falls apart.`, 'info');
    return OK(ticks);
  }
  if (m.status === 'partial') return OK(ticks);
  lv.remove(id, 'signing');
  const tech = TECHNIQUES[m.id];
  if (!sheet.techniques.includes(m.id)) {
    if (isPlayer(lv, id)) g.say('The signs are right, but you can\'t mold the chakra for it yet.', 'info');
    return OK(ticks);
  }
  const cost = tech.cost(sheet.skills.ninjutsu);
  if (!spendChakra(lv, id, cost)) {
    if (isPlayer(lv, id)) g.say('Not enough chakra. The technique fizzles.', 'info');
    return OK(ticks);
  }
  train(g, lv, id, 'ninjutsu', XP.technique);
  train(g, lv, id, 'chakra', XP.chakraUse * cost);
  lv.emit({ t: 'cast', id, technique: m.id });
  const p = lv.c.pos.get(id)!;
  if (m.id === 'vanish') {
    lv.add(id, 'invisible', { until: g.clock + vanishDurationTicks(sheet.skills.ninjutsu), power: sheet.skills.ninjutsu });
    lv.emit({ t: 'smoke', at: { x: p.x, y: p.y } });
    if (isPlayer(lv, id)) g.say('You fold the light around yourself and vanish.', 'good');
    for (const [o, aw] of lv.c.aware) {
      if (aw.target === id && aw.state === 'alert') { aw.lastSeenTick = g.clock - 60; aw.lastKnown = { x: p.x, y: p.y }; }
      void o;
    }
  } else if (m.id === 'shadow_step') {
    g.player.flags.shadowStep = shadowStepRange(sheet.skills.ninjutsu);
    if (isPlayer(lv, id)) g.request({ kind: 'aim_shadow_step', range: shadowStepRange(sheet.skills.ninjutsu) });
  }
  return OK(ticks);
}

function teleport(g: Game, lv: Level, id: EntityId, to: Vec): void {
  const p = lv.c.pos.get(id)!;
  const from = { x: p.x, y: p.y };
  lv.emit({ t: 'smoke', at: from });
  lv.moveTo(id, to.x, to.y);
  lv.emit({ t: 'teleport', id, from, to: { ...to } });
  lv.emit({ t: 'smoke', at: { ...to } });
  // Everyone who was fighting us loses the thread for a moment.
  for (const [o, aw] of lv.c.aware) {
    const c = lv.c.combat.get(o);
    if (c?.intentTarget === id) clearIntent(lv, o);
    if (aw.target === id && aw.state === 'alert') {
      aw.lastKnown = from;
      aw.lastSeenTick = g.clock - 60;
      aw.state = 'searching';
      lv.emit({ t: 'aware', id: o, state: 'searching' });
    }
  }
  void g;
}

function kawarimi(g: Game, lv: Level, id: EntityId): Result {
  const sheet = lv.c.sheet.get(id);
  if (!sheet?.techniques.includes('kawarimi')) return FAIL('You don\'t know Kawarimi yet (Ninjutsu 5).');
  const engaged = engagedWith(lv, id);
  const c = combatOf(lv, id);
  if (engaged.length && c.tempo < 1) return FAIL('No opening — you need 1 tempo to substitute.');
  const cost = TECHNIQUES.kawarimi.cost(sheet.skills.ninjutsu);
  if ((lv.c.vitals.get(id)?.chakra ?? 0) < cost) return FAIL('Not enough chakra.');
  const p = lv.c.pos.get(id)!;
  const foes = [...lv.c.aware.keys()].filter(o => isStanding(lv, o) && isHostile(lv, o, id) && chebyshev(lv.c.pos.get(o)!, p) <= 6);
  // Score candidate tiles 2–4 away: far from foes, in cover, out of their view.
  let best: Vec | null = null;
  let bestScore = -Infinity;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const r = Math.max(Math.abs(dx), Math.abs(dy));
    if (r < 2) continue;
    const x = p.x + dx, y = p.y + dy;
    if (!lv.isFree(x, y)) continue;
    let score = g.rng.next() * 0.5;
    for (const f of foes) score += Math.min(6, chebyshev(lv.c.pos.get(f)!, { x, y })) * 0.6;
    if (lv.hasCover(x, y)) score += 2;
    if (!hasLos(lv, p.x, p.y, x, y)) score += 1;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  if (!best) return FAIL('Nowhere to substitute to.');
  spendChakra(lv, id, cost);
  if (engaged.length) c.tempo -= 1;
  lv.emit({ t: 'cast', id, technique: 'kawarimi' });
  teleport(g, lv, id, best);
  if (isPlayer(lv, id)) g.say('A puff of smoke — a log takes your place.', 'good');
  else lv.emit({ t: 'bark', id, text: BARKS.kawarimi[0] });
  train(g, lv, id, 'ninjutsu', XP.technique);
  return OK(5);
}

function shadowStep(g: Game, lv: Level, id: EntityId, x: number, y: number): Result {
  const range = Number(g.player.flags.shadowStep ?? 0);
  if (!range) return FAIL('You need to form the signs first.');
  const p = lv.c.pos.get(id)!;
  if (chebyshev(p, { x, y }) > range) return FAIL('Too far.');
  if (!lv.visible[lv.idx(x, y)]) return FAIL('You must see where you step.');
  if (!lv.isFree(x, y)) return FAIL('Something is in the way.');
  delete g.player.flags.shadowStep;
  teleport(g, lv, id, { x, y });
  return OK(3);
}

// ── Items & medicine ──

function bandageTicks(lv: Level, id: EntityId): number {
  const med = lv.c.sheet.get(id)?.skills.medicine ?? 0;
  return BANDAGE_TICKS[Math.min(3, Math.floor(med / 15))];
}

function applyBandage(g: Game, lv: Level, medic: EntityId, target: EntityId): void {
  const med = lv.c.sheet.get(medic)?.skills.medicine ?? 0;
  lv.remove(target, 'bleed');
  const v = lv.c.vitals.get(target);
  if (v && !lv.c.ko.has(target)) v.hp = Math.min(v.hpMax, v.hp + v.hpMax * (0.08 + med / 400));
  train(g, lv, medic, 'medicine', XP.bandage);
}

function useItem(g: Game, lv: Level, id: EntityId, item: ItemKind): Result {
  const inv = lv.c.inventory.get(id);
  if (!inv || (inv.items[item] ?? 0) <= 0) return FAIL(`No ${ITEMS[item].plural} left.`);
  if (item === 'bandage') return bandage(g, lv, id, id);
  if (item === 'soldier_pill') {
    if (isPlayer(lv, id) && engagedWith(lv, id).length) punishOpening(g, lv, id);
    inv.items.soldier_pill! -= 1;
    const v = lv.c.vitals.get(id);
    if (v) {
      v.sta = Math.min(v.staMax, v.sta + v.staMax * 0.6);
      v.chakra = Math.min(v.chakraMax, v.chakra + v.chakraMax * 0.5);
    }
    if (isPlayer(lv, id)) g.say('You crunch a soldier pill. Bitter heat floods your limbs.', 'good');
    return OK(5);
  }
  return FAIL('You can\'t use that here.');
}

function bandage(g: Game, lv: Level, id: EntityId, target: EntityId): Result {
  const inv = lv.c.inventory.get(id);
  if (!inv || (inv.items.bandage ?? 0) <= 0) return FAIL('No bandages left.');
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target);
  if (!tp || chebyshev(p, tp) > 1) return FAIL('Too far.');
  if (lv.c.dead.has(target)) return FAIL('Too late for that.');
  const v = lv.c.vitals.get(target);
  if (!lv.c.bleed.has(target) && v && v.hp >= v.hpMax) return FAIL(target === id ? 'You\'re not hurt.' : 'They don\'t need it.');
  if (isPlayer(lv, id) && engagedWith(lv, id).length) punishOpening(g, lv, id);
  if (!isStanding(lv, id)) return OK(EXCHANGE_TICKS);
  inv.items.bandage! -= 1;
  applyBandage(g, lv, id, target);
  if (isPlayer(lv, id)) g.say(target === id ? 'You bind your wounds tight.' : `You bandage ${displayName(lv, target)}.`, 'good');
  return OK(bandageTicks(lv, id));
}

// ── Bodies: restrain, carry, search ──

function restrain(g: Game, lv: Level, id: EntityId, target: EntityId): Result {
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target);
  if (!tp || chebyshev(p, tp) > 1) return FAIL('Too far.');
  if (!lv.c.ko.has(target)) return FAIL('They have to be out cold first.');
  if (lv.c.restrained.has(target)) return FAIL('Already tied up.');
  lv.add(target, 'restrained', { by: id });
  if (isPlayer(lv, id)) g.say(`You bind and gag ${displayName(lv, target)}.`, 'good');
  fire(g, lv, { type: 'restrained', id: target, by: id });
  return OK(RESTRAIN_TICKS);
}

function carry(g: Game, lv: Level, id: EntityId, target: EntityId): Result {
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target);
  if (!tp || chebyshev(p, tp) > 1) return FAIL('Too far.');
  if (lv.c.carrying.has(id)) return FAIL('Your hands are full.');
  if (isStanding(lv, target) && !lv.c.restrained.has(target)) return FAIL('They won\'t let you.');
  if (!isDown(lv, target) && !lv.c.restrained.has(target)) return FAIL('You can\'t carry that.');
  lv.add(id, 'carrying', { target });
  lv.add(target, 'carried', { by: id });
  lv.moveTo(target, p.x, p.y);
  if (isPlayer(lv, id)) g.say(`You heave ${displayName(lv, target)} over your shoulder.`, 'info');
  return OK(CARRY_TICKS);
}

function drop(g: Game, lv: Level, id: EntityId): Result {
  const c = lv.c.carrying.get(id);
  if (!c) return FAIL('You\'re not carrying anyone.');
  lv.remove(id, 'carrying');
  lv.remove(c.target, 'carried');
  if (isPlayer(lv, id)) g.say(`You set ${displayName(lv, c.target)} down.`, 'info');
  return OK(CARRY_TICKS);
}

function search(g: Game, lv: Level, id: EntityId, target: EntityId): Result {
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target);
  if (!tp || chebyshev(p, tp) > 1) return FAIL('Too far.');
  if (isStanding(lv, target) && !lv.c.restrained.has(target)) return FAIL('Not while they\'re awake.');
  const inv = lv.c.inventory.get(target);
  const mine = lv.c.inventory.get(id);
  fire(g, lv, { type: 'searched', id: target, by: id });
  if (inv && mine && !inv.searched) {
    inv.searched = true;
    const found: string[] = [];
    for (const [k, n] of Object.entries(inv.items) as Array<[ItemKind, number]>) {
      if (!n) continue;
      mine.items[k] = (mine.items[k] ?? 0) + n;
      found.push(itemLabel(k, n));
      inv.items[k] = 0;
    }
    if (inv.ryo > 0) { mine.ryo += inv.ryo; found.push(`${inv.ryo} ryo`); inv.ryo = 0; }
    if (isPlayer(lv, id)) g.say(found.length ? `You find ${found.join(', ')}.` : 'Nothing worth taking.', 'item');
  } else if (isPlayer(lv, id)) {
    g.say('Nothing more to find.', 'info');
  }
  return OK(SEARCH_TICKS);
}

function finish(g: Game, lv: Level, id: EntityId, target: EntityId): Result {
  const p = lv.c.pos.get(id)!, tp = lv.c.pos.get(target);
  if (!tp || chebyshev(p, tp) > 1) return FAIL('Too far.');
  if (!lv.c.ko.has(target) || lv.c.dead.has(target)) return FAIL('Only an unconscious foe.');
  if (isPlayer(lv, id)) g.player.record.kills++;
  kill(g, lv, target, id, 'execution');
  return OK(SECONDS2);
}

/** Direction vector helper for AI. */
export function stepToward(from: Vec, to: Vec): { dx: number; dy: number } {
  return { dx: Math.sign(to.x - from.x), dy: Math.sign(to.y - from.y) };
}

export { DIR_VEC };
