import { describe, it, expect } from 'vitest';
import { testGame, spawn, freeze } from './helpers.ts';
import { playerAct, advance, rest } from '../src/sim/turn.ts';
import { compare, COUNTER, MOVES, engagedWith } from '../src/sim/combat.ts';
import { P } from '../src/world/tiles.ts';
import { STEP_TICKS, EXCHANGE_TICKS } from '../src/core/config.ts';
import { isStanding, applyBleed, knockOut } from '../src/sim/vitals.ts';
import { canTakedown } from '../src/sim/stealth.ts';
import type { Move } from '../src/ecs/components.ts';

describe('movement', () => {
  it('walking advances time by the stance cost and moves the player', () => {
    const { g, lv, player } = testGame();
    const t0 = g.clock;
    const r = playerAct(g, { type: 'move', dx: 1, dy: 0 });
    expect(r.ok).toBe(true);
    expect(lv.c.pos.get(player)).toMatchObject({ x: 11, y: 10 });
    expect(g.clock - t0).toBe(STEP_TICKS.walk);
  });

  it('trees block movement and cost no time', () => {
    const { g, lv, player } = testGame();
    lv.setProp(11, 10, P.tree_pine);
    const t0 = g.clock;
    const r = playerAct(g, { type: 'move', dx: 1, dy: 0 });
    expect(r.ok).toBe(false);
    expect(g.clock).toBe(t0);
    expect(lv.c.pos.get(player)).toMatchObject({ x: 10, y: 10 });
  });

  it('cannot cut a diagonal corner between two solid cells', () => {
    const { g, lv } = testGame();
    lv.setProp(11, 10, P.tree_pine);
    lv.setProp(10, 11, P.tree_pine);
    expect(playerAct(g, { type: 'move', dx: 1, dy: 1 }).ok).toBe(false);
  });
});

describe('the exchange triangle', () => {
  it('strike > break > guard > strike, mirrors tie', () => {
    expect(compare('strike', 'break')).toBe('win');
    expect(compare('break', 'guard')).toBe('win');
    expect(compare('guard', 'strike')).toBe('win');
    expect(compare('break', 'strike')).toBe('lose');
    expect(compare('strike', 'strike')).toBe('trade');
    expect(compare('guard', 'guard')).toBe('circle');
    expect(compare('break', 'break')).toBe('clinch');
    for (const m of MOVES) expect(compare(COUNTER[m], m)).toBe('win');
  });

  it('a partial read always has a move that beats one candidate and ties the other', () => {
    const pairs: Array<[Move, Move]> = [['strike', 'break'], ['strike', 'guard'], ['break', 'guard']];
    for (const [x, y] of pairs) {
      const safe = MOVES.find(m => {
        const a = compare(m, x), b = compare(m, y);
        return (a === 'win' && b !== 'lose') || (b === 'win' && a !== 'lose');
      });
      expect(safe).toBeDefined();
    }
  });
});

describe('melee', () => {
  it('an alert adjacent enemy commits an intent; answering it with the counter wins', () => {
    const { g, lv, player } = testGame({ seed: 3 });
    const b = spawn(g, lv, 'bandit_thug', 11, 10, 'w');
    lv.c.aware.get(b)!.state = 'alert';
    lv.c.aware.get(b)!.level = 100;
    lv.c.aware.get(b)!.target = player;
    playerAct(g, { type: 'wait' });
    const c = lv.c.combat.get(b)!;
    expect(c.intent).not.toBeNull();
    expect(c.intentTarget).toBe(player);
    const hp0 = lv.c.vitals.get(b)!.hp;
    playerAct(g, { type: 'melee', move: COUNTER[c.intent!], target: b });
    expect(lv.c.vitals.get(b)!.hp).toBeLessThan(hp0);
    expect(lv.c.combat.get(player)!.tempo).toBe(1);
  });

  it('walking away without tempo eats the committed blow; with tempo it is clean', () => {
    for (const tempo of [0, 1]) {
      const { g, lv, player } = testGame({ seed: 11 });
      const b = spawn(g, lv, 'bandit_thug', 11, 10, 'w');
      Object.assign(lv.c.aware.get(b)!, { state: 'alert', level: 100, target: player });
      playerAct(g, { type: 'wait' });
      // Force an attacking intent.
      lv.c.combat.get(b)!.intent = 'strike';
      lv.c.combat.get(player)!.tempo = tempo;
      const hp0 = lv.c.vitals.get(player)!.hp;
      playerAct(g, { type: 'move', dx: -1, dy: 0 });
      const hp1 = lv.c.vitals.get(player)!.hp;
      if (tempo === 0) expect(hp1).toBeLessThan(hp0);
      else expect(hp1).toBe(hp0);
    }
  });

  it('a fight always ends, and the player is never killed — only defeated', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { g, lv, player } = testGame({ seed });
      g.player.lethal = true;
      const b = spawn(g, lv, 'bandit_boss', 11, 10, 'w');
      Object.assign(lv.c.aware.get(b)!, { state: 'alert', level: 100, target: player });
      let guard = 0;
      while (isStanding(lv, player) && isStanding(lv, b) && guard++ < 400) {
        const m = g.rng.pick(MOVES);
        const r = playerAct(g, { type: 'melee', move: m, target: b });
        if (!r.ok) playerAct(g, { type: 'melee', move: 'guard', target: b });
        if (g.requests.length) break;
      }
      expect(guard).toBeLessThan(400);
      expect(lv.c.dead.has(player)).toBe(false);
      if (!isStanding(lv, player)) expect(g.requests.some(r => r.kind === 'defeat')).toBe(true);
    }
  });

  it('guard covers every attacker, strike leaves you open to the others', () => {
    const { g, lv, player } = testGame({ seed: 5 });
    const a = spawn(g, lv, 'bandit_thug', 11, 10, 'w');
    const b = spawn(g, lv, 'bandit_thug', 9, 10, 'e');
    for (const id of [a, b]) Object.assign(lv.c.aware.get(id)!, { state: 'alert', level: 100, target: player });
    playerAct(g, { type: 'wait' });
    expect(engagedWith(lv, player).sort()).toEqual([a, b].sort());
    lv.c.combat.get(a)!.intent = 'guard';
    lv.c.combat.get(b)!.intent = 'strike';
    const hp0 = lv.c.vitals.get(player)!.hp;
    playerAct(g, { type: 'melee', move: 'guard', target: a });
    expect(lv.c.vitals.get(player)!.hp).toBe(hp0); // b's strike was parried
  });
});

describe('stealth', () => {
  it('sneaking up behind an unaware guard allows a takedown', () => {
    const { g, lv, player } = testGame({ seed: 2, x: 10, y: 14 });
    const b = spawn(g, lv, 'bandit_thug', 10, 10, 'n'); // facing away (north), player is south
    freeze(lv, b);
    lv.c.actor.get(player)!.stance = 'sneak';
    for (let i = 0; i < 3; i++) playerAct(g, { type: 'move', dx: 0, dy: -1 });
    expect(lv.c.pos.get(player)).toMatchObject({ x: 10, y: 11 });
    expect(lv.c.aware.get(b)!.state).not.toBe('alert');
    expect(canTakedown(g, lv, player, b)).toBe(true);
    playerAct(g, { type: 'melee', move: 'strike', target: b });
    expect(lv.c.ko.has(b)).toBe(true);
  });

  it('walking openly in front of a guard in daylight gets you spotted', () => {
    const { g, lv } = testGame({ seed: 2, x: 10, y: 16 });
    const b = spawn(g, lv, 'bandit_thug', 10, 10, 's'); // facing the player
    freeze(lv, b);
    for (let i = 0; i < 4; i++) playerAct(g, { type: 'move', dx: 0, dy: -1 });
    expect(['alert', 'suspicious']).toContain(lv.c.aware.get(b)!.state);
    rest(g, 50, false);
    expect(lv.c.aware.get(b)!.state).toBe('alert');
  });

  it('the same approach at night in tall grass, sneaking, stays hidden longer', () => {
    const { g, lv, player } = testGame({ seed: 2, x: 10, y: 16, hour: 1 });
    for (let y = 11; y <= 16; y++) lv.setProp(10, y, P.tall_grass);
    const b = spawn(g, lv, 'bandit_thug', 10, 10, 's');
    freeze(lv, b);
    lv.c.actor.get(player)!.stance = 'sneak';
    for (let i = 0; i < 4; i++) playerAct(g, { type: 'move', dx: 0, dy: -1 });
    expect(lv.c.aware.get(b)!.state).not.toBe('alert');
  });
});

describe('vitals', () => {
  it('a knocked-out NPC that keeps bleeding dies; a bandaged one lives', () => {
    for (const bandaged of [false, true]) {
      const { g, lv } = testGame({ seed: 9 });
      const b = spawn(g, lv, 'bandit_thug', 11, 10, 'w');
      knockOut(g, lv, b, null);
      applyBleed(g, lv, b, 1);
      if (bandaged) {
        g.player.inventory.items.bandage = 1;
        expect(playerAct(g, { type: 'bandage', target: b }).ok).toBe(true);
      }
      rest(g, 600, false);
      expect(lv.c.dead.has(b)).toBe(!bandaged);
    }
  });

  it('advance returns control to the player', () => {
    const { g } = testGame();
    expect(advance(g)).toBe('player');
  });

  it('exchanges take one exchange of time', () => {
    const { g, lv } = testGame();
    const b = spawn(g, lv, 'bandit_thug', 11, 10, 'w');
    void b;
    const t0 = g.clock;
    playerAct(g, { type: 'melee', move: 'guard', target: b });
    expect(g.clock - t0).toBeGreaterThanOrEqual(EXCHANGE_TICKS);
  });
});
