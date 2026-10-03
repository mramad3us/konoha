import { describe, it, expect } from 'vitest';
import { newGame, prepareVillageMission, spotsOf } from '../src/sim/campaign.ts';
import { missions, accept, report, generate, active, objectives } from '../src/sim/missions.ts';
import { playerAct, advance, skipTime } from '../src/sim/turn.ts';
import { TICKS_PER_HOUR } from '../src/core/config.ts';
import { depart, travel, enterAmbush, leaveAmbush, arrive, extract, returnHome, rescue, journey } from '../src/sim/journey.ts';
import { knockOut } from '../src/sim/vitals.ts';
import { saveGame, loadGame } from '../src/sim/save.ts';
import { sleep, trainSession, buy } from '../src/sim/facilities.ts';
import { startDuel } from '../src/sim/duel.ts';
import { nearestFree } from '../src/world/gen/mission.ts';
import type { Game } from '../src/sim/game.ts';
import type { EntityId } from '../src/ecs/components.ts';
import type { MissionRankLetter } from '../src/sim/game.ts';
import type { MissionKind } from '../src/sim/missions.ts';

function mk(seed = 11): Game {
  return newGame('Tester', 'm', undefined, seed);
}

/** Teleport the player next to an entity. */
function goNextTo(g: Game, id: EntityId): void {
  const lv = g.level;
  const p = lv.c.pos.get(id)!;
  const spot = nearestFree(lv, { x: p.x, y: p.y + 1 }, 4)!;
  lv.moveTo(lv.playerId, spot.x, spot.y);
}

function forceMission(g: Game, rank: MissionRankLetter, kind: MissionKind) {
  const s = missions(g);
  for (let i = 0; i < 200; i++) {
    const m = generate(g, rank);
    if (m.kind === kind) { s.board.push(m); return m; }
  }
  throw new Error('could not generate ' + kind);
}

describe('new game', () => {
  it('builds the village, its people and a mission board', () => {
    const g = mk();
    const lv = g.level;
    expect(lv.kind).toBe('village');
    expect([...lv.c.talk.keys()].length).toBeGreaterThan(15);
    expect(missions(g).board.length).toBeGreaterThanOrEqual(4);
    expect(lv.c.sheet.get(lv.playerId)).toBe(g.player.sheet);
    expect(advance(g)).toBe('player');
  });
});

describe('D-rank missions', () => {
  it('delivery: talk to the recipient, report, get paid', () => {
    const g = mk();
    skipTime(g, 5 * TICKS_PER_HOUR); // noon: everyone is out and about
    const m = forceMission(g, 'D', 'delivery');
    expect(accept(g, m.id).ok).toBe(true);
    const lv = g.level;
    const who = [...lv.c.name].find(([, n]) => n.name === m.recipient)![0];
    goNextTo(g, who);
    playerAct(g, { type: 'interact', target: who });
    expect(active(g)!.status).toBe('complete');
    const ryo = g.player.inventory.ryo;
    expect(report(g)).toMatch(/complete/);
    expect(g.player.inventory.ryo).toBe(ryo + m.reward);
    expect(g.player.record.missions.D).toBe(1);
  });

  it('search: the item is hidden in the village; picking it up completes', () => {
    const g = mk(5);
    const m = forceMission(g, 'D', 'search');
    accept(g, m.id);
    prepareVillageMission(g);
    const item = active(g)!.refs.item!;
    expect(g.level.entities.has(item)).toBe(true);
    goNextTo(g, item);
    playerAct(g, { type: 'interact', target: item });
    expect(active(g)!.status).toBe('complete');
  });

  it('patrol: walking past every post completes', () => {
    const g = mk(9);
    const m = forceMission(g, 'D', 'patrol');
    accept(g, m.id);
    prepareVillageMission(g);
    const spots = g.ext.patrolSpots as Array<{ x: number; y: number }>;
    const lv = g.level;
    for (const s of spots) {
      const near = nearestFree(lv, { x: s.x, y: s.y + 3 }, 6)!;
      lv.moveTo(lv.playerId, near.x, near.y);
      const free = nearestFree(lv, s, 2)!;
      const p = lv.c.pos.get(lv.playerId)!;
      // step toward it
      playerAct(g, { type: 'move', dx: Math.sign(free.x - p.x), dy: Math.sign(free.y - p.y) });
      lv.moveTo(lv.playerId, free.x, free.y);
      playerAct(g, { type: 'move', dx: 0, dy: 0 });
      playerAct(g, { type: 'wait' });
      // stepped events fire on moves; make one legal step out and back
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of opts) {
        if (lv.isFree(free.x + dx, free.y + dy)) { playerAct(g, { type: 'move', dx, dy }); playerAct(g, { type: 'move', dx: -dx, dy: -dy }); break; }
      }
    }
    expect(active(g)!.status).toBe('complete');
  });
});

/** Drive a whole C-rank capture from the desk back to the desk. */
function runCapture(g: Game, opts: { saveMid?: boolean } = {}): Game {
  g.player.record.missions.D = 3;
  const m = forceMission(g, 'C', 'capture');
  expect(accept(g, m.id).ok).toBe(true);
  depart(g);
  for (let guard = 0; guard < 10; guard++) {
    const step = travel(g);
    if (step.kind === 'ambush') {
      enterAmbush(g);
      expect(g.level.kind).toBe('encounter');
      advance(g);
      leaveAmbush(g);
      continue;
    }
    expect(step.kind).toBe('arrive');
    break;
  }
  const lv = arrive(g)!;
  expect(lv.kind).toBe('mission');
  const a = active(g)!;
  const leader = a.refs.leader!;
  expect(lv.c.name.get(leader)!.name).toBe(m.target);
  if (opts.saveMid) {
    const data = JSON.parse(JSON.stringify(saveGame(g, 0)));
    g = loadGame(data);
  }
  const L = g.level;
  const a2 = active(g)!;
  knockOut(g, L, a2.refs.leader!, L.playerId);
  goNextTo(g, a2.refs.leader!);
  expect(playerAct(g, { type: 'restrain', target: a2.refs.leader! }).ok).toBe(true);
  expect(active(g)!.flags.leaderBound).toBe(true);
  extract(g);
  expect(active(g)!.status).toBe('complete');
  const back = travel(g);
  if (back.kind === 'ambush') { enterAmbush(g); leaveAmbush(g); travel(g); }
  returnHome(g);
  expect(g.level.kind).toBe('village');
  expect(journey(g)).toBeNull();
  const msg = report(g);
  expect(msg).toMatch(/complete/);
  expect(g.player.record.missions.C).toBe(1);
  return g;
}

describe('C-rank away mission', () => {
  it('capture: travel, ambushes, subdue, bind, extract, return, report', () => {
    runCapture(mk(21));
  });

  it('survives a save/load in the middle of the mission map', () => {
    const g = runCapture(mk(23), { saveMid: true });
    expect(g.level.c.sheet.get(g.level.playerId)).toBe(g.player.sheet);
  });

  it('killing the capture target fails the mission', () => {
    const g = mk(31);
    g.player.record.missions.D = 3;
    const m = forceMission(g, 'C', 'capture');
    accept(g, m.id);
    depart(g);
    let s = travel(g);
    while (s.kind === 'ambush') { enterAmbush(g); leaveAmbush(g); s = travel(g); }
    arrive(g);
    const lv = g.level;
    const leader = active(g)!.refs.leader!;
    goNextTo(g, leader);
    knockOut(g, lv, leader, lv.playerId);
    playerAct(g, { type: 'finish', target: leader });
    expect(active(g)!.status).toBe('failed');
    expect(objectives(g).at(-1)!.text).toMatch(/failure/);
  });

  it('defeat on a mission: rescued home, mission failed, never dead', () => {
    const g = mk(41);
    g.player.record.missions.D = 3;
    const m = forceMission(g, 'C', 'eliminate');
    accept(g, m.id);
    depart(g);
    let s = travel(g);
    while (s.kind === 'ambush') { enterAmbush(g); leaveAmbush(g); s = travel(g); }
    arrive(g);
    const lv = g.level;
    knockOut(g, lv, lv.playerId, null);
    expect(g.requests.some(r => r.kind === 'defeat')).toBe(true);
    g.requests.length = 0;
    rescue(g);
    expect(g.level.kind).toBe('village');
    expect(active(g)!.status).toBe('failed');
    expect(g.level.c.dead.has(g.level.playerId)).toBe(false);
    expect(advance(g)).toBe('player');
  });
});

describe('more away missions', () => {
  it('escort: the client travels with you through ambushes; arriving completes it', () => {
    const g = mk(51);
    g.player.record.missions.D = 3;
    const m = forceMission(g, 'C', 'escort');
    accept(g, m.id);
    depart(g);
    let ambushes = 0;
    for (let guard = 0; guard < 10; guard++) {
      const s = travel(g);
      if (s.kind === 'ambush') {
        ambushes++;
        const lv = enterAmbush(g);
        const client = active(g)!.refs.client!;
        expect(lv.c.mission.get(client)?.role).toBe('client');
        leaveAmbush(g);
        continue;
      }
      expect(s.kind).toBe('arrive');
      expect(arrive(g)).toBeNull();
      break;
    }
    expect(ambushes).toBeGreaterThanOrEqual(1);
    expect(active(g)!.status).toBe('complete');
  });

  it('infiltration notices when you are seen', async () => {
    const { noteAlarm } = await import('../src/sim/missions.ts');
    const g = mk(61);
    g.player.sheet.rank = 'chunin';
    const m = forceMission(g, 'B', 'infiltrate');
    accept(g, m.id);
    depart(g);
    let s = travel(g);
    while (s.kind === 'ambush') { enterAmbush(g); leaveAmbush(g); s = travel(g); }
    const lv = arrive(g)!;
    expect(active(g)!.refs.item).toBeDefined();
    const [foe, aw] = [...lv.c.aware][0];
    Object.assign(aw, { state: 'alert', target: lv.playerId });
    void foe;
    noteAlarm(g, lv);
    expect(active(g)!.flags.alarm).toBe(true);
  });
});

describe('village life', () => {
  it('sleep jumps to the next morning and restores you', () => {
    const g = mk();
    g.player.vitals.hp = 5;
    sleep(g);
    expect(Math.floor(g.hour)).toBe(6);
    expect(g.player.vitals.hp).toBe(g.player.vitals.hpMax);
    expect(advance(g)).toBe('player');
  });

  it('training raises a skill and costs the day', () => {
    const g = mk();
    const t0 = g.player.sheet.skills.taijutsu;
    trainSession(g, 'taijutsu', 4);
    expect(g.player.sheet.skills.taijutsu).toBeGreaterThan(t0);
  });

  it('the shop sells for ryo', () => {
    const g = mk();
    const k0 = g.player.inventory.items.kunai ?? 0;
    expect(buy(g, 'kunai', 2).ok).toBe(true);
    expect(g.player.inventory.items.kunai).toBe(k0 + 2);
  });

  it('a spar ends cleanly when someone drops', () => {
    const g = mk();
    const lv = g.level;
    const spots = spotsOf(g);
    const daichi = [...lv.c.name].find(([, n]) => n.name === 'Daichi')![0];
    startDuel(g, lv, spots.arena, daichi, 'spar');
    expect(lv.c.duel.has(lv.playerId)).toBe(true);
    knockOut(g, lv, daichi, lv.playerId);
    expect(lv.c.duel.has(lv.playerId)).toBe(false);
    expect(lv.c.ko.has(daichi)).toBe(false);
    expect(g.requests.some(r => r.kind === 'defeat')).toBe(false);
  });

  it('losing a spar never triggers the defeat flow', () => {
    const g = mk();
    const lv = g.level;
    const daichi = [...lv.c.name].find(([, n]) => n.name === 'Daichi')![0];
    startDuel(g, lv, spotsOf(g).arena, daichi, 'spar');
    knockOut(g, lv, lv.playerId, daichi);
    expect(g.requests.some(r => r.kind === 'defeat')).toBe(false);
    expect(lv.c.ko.has(lv.playerId)).toBe(false);
  });

  it('a village save round-trips and keeps playing', () => {
    const g = mk(3);
    for (let i = 0; i < 20; i++) playerAct(g, { type: 'wait' });
    const g2 = loadGame(JSON.parse(JSON.stringify(saveGame(g, 12))));
    expect(g2.clock).toBe(g.clock);
    expect(g2.level.entities.size).toBe(g.level.entities.size);
    for (let i = 0; i < 20; i++) playerAct(g2, { type: 'wait' });
    expect(g2.clock).toBeGreaterThan(g.clock);
  });
});
