/**
 * Missions: the daily board, accepting, objective tracking (driven by domain events), failure,
 * reporting and rewards. All state lives in g.ext.missions (plain data, serializable).
 */

import type { Game, MissionRankLetter } from './game.ts';
import type { Level } from '../ecs/level.ts';
import type { EntityId, Rank, Skill, Attr } from '../ecs/components.ts';
import { RANK_ORDER } from '../ecs/components.ts';
import type { Vec } from '../core/geometry.ts';
import { chebyshev } from '../core/geometry.ts';
import { Rng, hashString } from '../core/rng.ts';
import { onDomain } from './hooks.ts';
import { VILLAGERS } from '../content/villagers.ts';
import { PLACES, place } from '../content/world.ts';
import { BANDIT_NAMES, BANDIT_EPITHETS, ROGUE_NAMES } from '../content/archetypes.ts';
import { BOARD_SIZE, C_RANK_REQUIRES_D } from '../core/config.ts';
import { train } from './progress.ts';
import { displayName } from './names.ts';

export type MissionKind =
  | 'delivery' | 'search' | 'patrol'
  | 'capture' | 'eliminate' | 'recover' | 'escort' | 'sweep'
  | 'infiltrate' | 'hunt';

export interface Mission {
  id: string;
  rank: MissionRankLetter;
  kind: MissionKind;
  title: string;
  client: string;
  brief: string;
  reward: number;
  posted: number;
  expires: number;
  seed: number;
  place?: string;
  target?: string;
  recipient?: string;
  item?: string;
  area?: string;
  checkpoints?: Array<Vec & { label: string }>;
}

export interface ActiveMission {
  m: Mission;
  status: 'active' | 'complete' | 'failed';
  flags: Record<string, boolean | number>;
  refs: { leader?: EntityId; item?: EntityId; client?: EntityId };
  failReason?: string;
}

export interface MissionState {
  board: Mission[];
  boardDay: number;
  active: ActiveMission | null;
  counter: number;
  history: Array<{ title: string; rank: MissionRankLetter; ok: boolean; day: number }>;
}

export function missions(g: Game): MissionState {
  let s = g.ext.missions as MissionState | undefined;
  if (!s) {
    s = { board: [], boardDay: 0, active: null, counter: 0, history: [] };
    g.ext.missions = s;
  }
  return s;
}

export function active(g: Game): ActiveMission | null {
  return missions(g).active;
}

export const RANK_REWARD: Record<MissionRankLetter, [number, number]> = { D: [40, 70], C: [260, 380], B: [900, 1300], A: [2600, 3400] };

const rankIdx = (r: Rank) => RANK_ORDER.indexOf(r);

/** Can the player take missions of this rank right now? */
export function canTake(g: Game, r: MissionRankLetter): { ok: boolean; why?: string } {
  const rank = g.player.sheet.rank;
  const rec = g.player.record.missions;
  if (r === 'D') return { ok: true };
  if (r === 'C') {
    if (rankIdx(rank) >= rankIdx('chunin') || rec.D >= C_RANK_REQUIRES_D) return { ok: true };
    return { ok: false, why: `Complete ${C_RANK_REQUIRES_D} D-rank missions first (${rec.D}/${C_RANK_REQUIRES_D}).` };
  }
  if (r === 'B') return rankIdx(rank) >= rankIdx('chunin') ? { ok: true } : { ok: false, why: 'Chunin rank required.' };
  return rankIdx(rank) >= rankIdx('jonin') ? { ok: true } : { ok: false, why: 'Jonin rank required.' };
}

// ── Promotion ──

export function promotionStatus(g: Game): { next: Rank | null; ready: boolean; needs: string[] } {
  const s = g.player.sheet;
  const rec = g.player.record.missions;
  const best = Math.max(s.skills.taijutsu, s.skills.ninjutsu);
  if (s.rank === 'genin') {
    const needs: string[] = [];
    if (rec.C < 5) needs.push(`${rec.C}/5 C-rank missions`);
    if (best < 25) needs.push(`Taijutsu or Ninjutsu 25 (best ${Math.floor(best)})`);
    return { next: 'chunin', ready: needs.length === 0, needs };
  }
  if (s.rank === 'chunin') {
    const needs: string[] = [];
    if (rec.B < 6) needs.push(`${rec.B}/6 B-rank missions`);
    if (best < 50) needs.push(`Taijutsu or Ninjutsu 50 (best ${Math.floor(best)})`);
    return { next: 'jonin', ready: needs.length === 0, needs };
  }
  return { next: null, ready: false, needs: [] };
}

// ── Board ──

export function refreshBoard(g: Game): void {
  const s = missions(g);
  if (s.boardDay === g.day && s.board.length) return;
  s.board = s.board.filter(m => m.expires >= g.day);
  const want: MissionRankLetter[] = ['D', 'D', 'C', 'C', 'B', 'A'];
  const have = s.board.map(m => m.rank);
  for (const r of want) {
    const k = have.indexOf(r);
    if (k >= 0) { have.splice(k, 1); continue; }
    if (s.board.length >= BOARD_SIZE) break;
    s.board.push(generate(g, r));
  }
  s.boardDay = g.day;
}

const D_KINDS: MissionKind[] = ['delivery', 'search', 'patrol'];
const C_KINDS: MissionKind[] = ['capture', 'eliminate', 'recover', 'escort', 'sweep'];
const B_KINDS: MissionKind[] = ['eliminate', 'infiltrate', 'recover'];
const A_KINDS: MissionKind[] = ['hunt', 'eliminate'];

const CLIENTS_C = ['A merchant guild clerk', 'The Mizuhara headman', 'A caravan master', 'Lady Ayane, a landholder', 'The ferry guild of Hinoki', 'A quarry foreman'];
const CLIENTS_B = ['The Daimyo\'s border office', 'Konoha Intelligence', 'A provincial governor', 'The Hokage\'s office'];

export function generate(g: Game, rank: MissionRankLetter): Mission {
  const s = missions(g);
  const id = `m${++s.counter}`;
  const seed = hashString(`${g.seed}:${id}:${g.day}`);
  const rng = new Rng(seed);
  const [lo, hi] = RANK_REWARD[rank];
  const base: Mission = {
    id, rank, kind: 'delivery', title: '', client: '', brief: '', reward: Math.round(rng.int(lo, hi) / 5) * 5,
    posted: g.day, expires: g.day + rng.int(3, 5), seed,
  };
  const kind = rng.pick(rank === 'D' ? D_KINDS : rank === 'C' ? C_KINDS : rank === 'B' ? B_KINDS : A_KINDS);
  base.kind = kind;
  const places = PLACES.filter(p => p.id !== 'konoha' && (p.ranks as readonly string[]).includes(rank));
  const where = places.length ? rng.pick(places) : place('kusagaya');
  switch (kind) {
    case 'delivery': {
      const who = rng.pick(VILLAGERS.filter(v => v.recipient));
      const item = rng.pick(['sealed letter', 'medicine parcel', 'bundle of scrolls', 'repaired sandals', 'box of tea', 'package']);
      Object.assign(base, {
        title: rng.pick(['Courier Run', 'Urgent Delivery', 'Village Errand']), client: rng.pick(['The village post office', 'Mrs. Mori', 'The Academy office']),
        brief: `Deliver a ${item} to ${who.name} (${who.title.toLowerCase()}). They can usually be found around the ${spotName(who.work)} during the day.`,
        recipient: who.name, item,
      });
      break;
    }
    case 'search': {
      const area = rng.pick(['market', 'river', 'training', 'fields', 'plaza']);
      const item = rng.pick(['lost cat collar', 'dropped coin purse', 'child\'s wooden kunai', 'missing ledger', 'heirloom hairpin']);
      Object.assign(base, {
        title: rng.pick(['Lost and Found', 'Search Detail', 'Missing Item']), client: rng.pick(['A worried villager', 'A shop owner', 'An academy parent']),
        brief: `Someone lost a ${item} near the ${spotName(area)}. Search the area — it won't be lying in the open.`,
        item, area,
      });
      break;
    }
    case 'patrol': {
      const labels = rng.shuffle(['plaza', 'market', 'river', 'training', 'gate', 'fields']).slice(0, 4);
      Object.assign(base, {
        title: rng.pick(['Village Patrol', 'Watch Rotation', 'Perimeter Walk']), client: 'Konoha watch office',
        brief: `Walk the patrol route and check in at each post: ${labels.map(spotName).join(', ')}.`,
        area: labels.join(','),
      });
      break;
    }
    case 'capture': {
      const target = `${rng.pick(BANDIT_NAMES)} ${rng.pick(BANDIT_EPITHETS)}`;
      Object.assign(base, {
        title: rng.pick(['Bandit Apprehension', 'Bring Him In', 'Highway Robbers']), client: rng.pick(CLIENTS_C), place: where.id, target,
        brief: `${target} leads a bandit gang camped near ${where.name}. The magistrate wants him alive. Knock him out, bind him, and leave him for the retrieval team. If he dies, the mission fails.`,
      });
      break;
    }
    case 'eliminate': {
      const rogue = rank !== 'C';
      const target = rogue ? rng.pick(ROGUE_NAMES) : `${rng.pick(BANDIT_NAMES)} ${rng.pick(BANDIT_EPITHETS)}`;
      Object.assign(base, {
        title: rogue ? rng.pick(['Rogue Shinobi', 'Defector Cell', 'Silent Removal']) : rng.pick(['Gang Suppression', 'Bounty', 'Road Security']),
        client: rogue ? rng.pick(CLIENTS_B) : rng.pick(CLIENTS_C), place: where.id, target,
        brief: rogue
          ? `A rogue shinobi called ${target} has set up near ${where.name} with others of their kind. Eliminate ${target} and bring proof.`
          : `${target} has killed travelers on the road near ${where.name}. Lethal force is authorized. Bring proof.`,
      });
      break;
    }
    case 'recover': {
      const item = rng.pick(['tax strongbox', 'crate of medicine', 'sealed cargo', 'shrine relic']);
      Object.assign(base, {
        title: rng.pick(['Stolen Goods', 'Recovery', 'Retrieve the Cargo']), client: rank === 'C' ? rng.pick(CLIENTS_C) : rng.pick(CLIENTS_B), place: where.id, item,
        brief: `A ${item} was taken to a camp near ${where.name}. Get it back. How you deal with its keepers is up to you.`,
      });
      break;
    }
    case 'escort': {
      Object.assign(base, {
        title: rng.pick(['Escort Duty', 'Safe Passage', 'Caravan Guard']), client: rng.pick(['A silk merchant', 'A traveling doctor', 'A minor official']), place: where.id,
        brief: `Escort the client to ${where.name}. Bandits watch that road — expect at least one ambush. Keep the client alive.`,
      });
      break;
    }
    case 'sweep': {
      Object.assign(base, {
        title: rng.pick(['Woodland Sweep', 'Clear the Road', 'Bandit Sightings']), client: 'Konoha watch office', place: where.id,
        brief: `Scouts report armed groups around ${where.name}. Check the marked points and deal with whoever you find.`,
      });
      break;
    }
    case 'infiltrate': {
      const item = rng.pick(['coded ledger', 'troop roster', 'stolen jutsu scroll']);
      Object.assign(base, {
        title: rng.pick(['Infiltration', 'In and Out', 'Shadow Work']), client: 'Konoha Intelligence', place: where.id, item,
        brief: `Rogue shinobi near ${where.name} hold a ${item}. Steal it. If nobody ever knows you were there, so much the better.`,
      });
      break;
    }
    case 'hunt': {
      const target = rng.pick(ROGUE_NAMES);
      Object.assign(base, {
        title: rng.pick(['Missing-nin Pursuit', 'The Hunt', 'Bingo Book Entry']), client: 'The Hokage', place: where.id, target,
        brief: `${target}, a missing-nin of jonin caliber, was sighted at ${where.name} with an escort. End the threat. Bring proof.`,
      });
      break;
    }
  }
  return base;
}

function spotName(k: string): string {
  return ({ market: 'market', river: 'river bank', training: 'training grounds', fields: 'fields', plaza: 'central plaza', gate: 'main gate', shop: 'weapon shop', ramen: 'ramen stand', hospital: 'hospital', academy: 'Academy', tower: 'Hokage Tower' } as Record<string, string>)[k] ?? k;
}

export function isAway(m: Mission): boolean {
  return m.rank !== 'D';
}

export function accept(g: Game, id: string): { ok: boolean; why?: string } {
  const s = missions(g);
  if (s.active) return { ok: false, why: 'Finish or abandon your current mission first.' };
  const i = s.board.findIndex(m => m.id === id);
  if (i < 0) return { ok: false, why: 'That mission is gone.' };
  const m = s.board[i];
  const c = canTake(g, m.rank);
  if (!c.ok) return { ok: false, why: c.why };
  s.board.splice(i, 1);
  s.active = { m, status: 'active', flags: {}, refs: {} };
  g.say(`Mission accepted: ${m.title} (${m.rank}-rank).`, 'mission');
  return { ok: true };
}

export function abandon(g: Game): void {
  const s = missions(g);
  if (!s.active) return;
  const lv = g.levels.get('village');
  if (lv && s.active.refs.item !== undefined && lv.entities.has(s.active.refs.item)) lv.destroy(s.active.refs.item);
  s.history.push({ title: s.active.m.title, rank: s.active.m.rank, ok: false, day: g.day });
  g.player.record.failed++;
  g.say(`Mission abandoned: ${s.active.m.title}.`, 'bad');
  s.active = null;
}

export function fail(g: Game, reason: string): void {
  const a = active(g);
  if (!a || a.status !== 'active') return;
  a.status = 'failed';
  a.failReason = reason;
  g.say(`Mission failed — ${reason}`, 'bad');
}

function complete(g: Game, msg: string): void {
  const a = active(g);
  if (!a || a.status !== 'active') return;
  a.status = 'complete';
  g.say(msg, 'mission');
}

/** Report at the desk. Returns a summary line. */
export function report(g: Game): string | null {
  const s = missions(g);
  const a = s.active;
  if (!a || a.status === 'active') return null;
  const m = a.m;
  s.active = null;
  s.history.push({ title: m.title, rank: m.rank, ok: a.status === 'complete', day: g.day });
  if (a.status === 'failed') {
    g.player.record.failed++;
    return `Mission failed: ${m.title}. ${a.failReason ?? ''} No pay.`;
  }
  let pay = m.reward;
  const notes: string[] = [];
  if (m.kind === 'infiltrate' && !a.flags.alarm) { pay = Math.round(pay * 1.25); notes.push('Undetected: +25%.'); }
  g.player.inventory.ryo += pay;
  g.player.record.missions[m.rank]++;
  const lv = g.level;
  const base = { D: 0.12, C: 0.35, B: 0.7, A: 1.2 }[m.rank];
  for (const st of MISSION_STATS[m.kind]) train(g, lv, lv.playerId, st, base);
  return `Mission complete: ${m.title}. You are paid ${pay} ryo. ${notes.join(' ')}`.trim();
}

const MISSION_STATS: Record<MissionKind, Array<Skill | Attr>> = {
  delivery: ['body'], search: ['mind'], patrol: ['body', 'mind'],
  capture: ['taijutsu', 'stealth'], eliminate: ['taijutsu', 'bukijutsu'], recover: ['stealth', 'taijutsu'],
  escort: ['taijutsu', 'mind'], sweep: ['taijutsu', 'body'], infiltrate: ['stealth', 'ninjutsu'], hunt: ['taijutsu', 'ninjutsu'],
};

// ── Objectives (for the HUD) ──

export interface Objective { text: string; done: boolean }

export function objectives(g: Game): Objective[] {
  const a = active(g);
  if (!a) return [];
  const m = a.m, f = a.flags;
  const report: Objective = { text: a.status === 'failed' ? 'Report the failure at the Mission Desk' : 'Report to the Mission Desk', done: false };
  const out: Objective[] = [];
  const there = m.place ? place(m.place).name : '';
  const leave: Objective = { text: 'Leave the area (map edge where you entered)', done: !!f.left };
  switch (m.kind) {
    case 'delivery': out.push({ text: `Deliver the ${m.item} to ${m.recipient}`, done: !!f.delivered }); break;
    case 'search': out.push({ text: `Find the ${m.item} near the ${spotName(m.area ?? '')}`, done: !!f.found }); break;
    case 'patrol':
      for (const [i, k] of (m.area ?? '').split(',').entries()) out.push({ text: `Check in at the ${spotName(k)}`, done: !!f[`cp${i}`] });
      break;
    case 'capture':
      out.push({ text: `Travel to ${there}`, done: !!f.arrived }, { text: `Knock out ${m.target}`, done: !!f.leaderDown }, { text: `Bind ${m.target}`, done: !!f.leaderBound }, leave);
      break;
    case 'eliminate': case 'hunt':
      out.push({ text: `Travel to ${there}`, done: !!f.arrived }, { text: `Eliminate ${m.target}`, done: !!f.leaderDead }, { text: 'Take proof from the body', done: !!f.proof }, leave);
      break;
    case 'recover':
      out.push({ text: `Travel to ${there}`, done: !!f.arrived }, { text: `Recover the ${m.item}`, done: !!f.item }, leave);
      break;
    case 'infiltrate':
      out.push({ text: `Travel to ${there}`, done: !!f.arrived }, { text: `Steal the ${m.item}`, done: !!f.item }, { text: 'Stay undetected (bonus)', done: !f.alarm && !!f.item }, leave);
      break;
    case 'escort':
      out.push({ text: `Escort the client to ${there}`, done: !!f.arrived }, { text: 'Keep the client alive', done: !!f.arrived && !f.clientDown });
      break;
    case 'sweep':
      out.push({ text: `Travel to ${there}`, done: !!f.arrived });
      for (let i = 0; i < (m.checkpoints?.length ?? 3); i++) out.push({ text: `Check point ${i + 1}${m.checkpoints?.[i] ? ` (${m.checkpoints[i].label})` : ''}`, done: !!f[`cp${i}`] });
      out.push(leave);
      break;
  }
  if (a.status !== 'active') {
    for (const o of out) if (a.status === 'complete') o.done = true;
  }
  out.push(report);
  return out;
}

/** Are the in-field objectives done (ready to extract with success)? */
export function fieldDone(g: Game): boolean {
  const a = active(g);
  if (!a) return false;
  const f = a.flags;
  switch (a.m.kind) {
    case 'capture': return !!f.leaderBound;
    case 'eliminate': case 'hunt': return !!f.leaderDead && !!f.proof;
    case 'recover': case 'infiltrate': return !!f.item;
    case 'sweep': return (a.m.checkpoints ?? []).every((_, i) => !!f[`cp${i}`]);
    case 'escort': return !!f.arrived;
    default: return a.status === 'complete';
  }
}

/** Called when the player leaves a mission map through the exit. */
export function onLeaveArea(g: Game): void {
  const a = active(g);
  if (!a || a.status !== 'active') return;
  a.flags.left = true;
  if (fieldDone(g)) complete(g, 'Objective complete. Head home and report to the Mission Desk.');
  else fail(g, 'you left before finishing the job.');
}

// ── Event-driven progress ──

onDomain((g, lv, e) => {
  const a = active(g);
  if (!a || a.status !== 'active') return;
  const m = a.m, f = a.flags;
  switch (e.type) {
    case 'talked': {
      if (m.kind === 'delivery' && !f.delivered && lv.c.name.get(e.id)?.name === m.recipient) {
        f.delivered = true;
        complete(g, `${m.recipient} takes the ${m.item}. "Thank you, shinobi." Report back to the desk.`);
      }
      break;
    }
    case 'collected': {
      if (e.id === a.refs.item) {
        f.found = true; f.item = true;
        if (m.kind === 'search') complete(g, `You found the ${m.item}! Return it via the Mission Desk.`);
        else g.say(`You have the ${m.item}. Now get out.`, 'mission');
      }
      break;
    }
    case 'stepped': {
      if (m.kind === 'patrol' && lv.kind === 'village') {
        const cps = (g.ext.patrolSpots as Vec[] | undefined) ?? [];
        cps.forEach((p, i) => {
          if (!f[`cp${i}`] && chebyshev(p, e) <= 2) {
            f[`cp${i}`] = true;
            g.say(`Checked in (${cps.filter((_, k) => f[`cp${k}`]).length}/${cps.length}).`, 'mission');
          }
        });
        if (cps.length && cps.every((_, i) => f[`cp${i}`])) complete(g, 'Patrol complete. Report to the Mission Desk.');
      }
      if (m.kind === 'sweep' && lv.kind === 'mission') {
        (m.checkpoints ?? []).forEach((p, i) => {
          if (!f[`cp${i}`] && chebyshev(p, e) <= 2) { f[`cp${i}`] = true; g.say(`Point ${i + 1} checked.`, 'mission'); }
        });
      }
      break;
    }
    case 'ko': {
      if (e.id === a.refs.leader) { f.leaderDown = true; g.say(`${m.target} is down.`, 'mission'); }
      if (e.id === a.refs.client) { f.clientDown = true; }
      if (e.id === lv.playerId) f.playerDown = true;
      break;
    }
    case 'death': {
      if (e.id === a.refs.leader) {
        if (m.kind === 'capture') fail(g, `${m.target} is dead. The client wanted him alive.`);
        else { f.leaderDead = true; g.say(`${m.target} is dead. Search the body for proof.`, 'mission'); }
      }
      if (e.id === a.refs.client) fail(g, 'the client is dead.');
      break;
    }
    case 'restrained': {
      if (e.id === a.refs.leader && m.kind === 'capture') {
        f.leaderBound = true;
        g.say(`${m.target} is bound and gagged. The retrieval team will collect him — now leave.`, 'mission');
      }
      break;
    }
    case 'searched': {
      if (e.id === a.refs.leader && (m.kind === 'eliminate' || m.kind === 'hunt') && f.leaderDead && !f.proof) {
        f.proof = true;
        g.say(`You take ${displayName(lv, e.id)}'s ${m.rank === 'C' ? 'tattooed armband' : 'slashed forehead protector'} as proof.`, 'mission');
      }
      break;
    }
  }
});

/** Track alarms during infiltration (any enemy reaching alert). */
export function noteAlarm(g: Game, lv: Level): void {
  const a = active(g);
  if (!a || a.m.kind !== 'infiltrate' || a.flags.alarm) return;
  for (const [, aw] of lv.c.aware) if (aw.state === 'alert' && aw.target === lv.playerId) { a.flags.alarm = true; g.say('You\'ve been seen. So much for a clean job.', 'bad'); return; }
}
