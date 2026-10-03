import { describe, it, expect } from 'vitest';
import { testGame, spawn, freeze } from './helpers.ts';
import { playerAct } from '../src/sim/turn.ts';
import { perform } from '../src/sim/actions.ts';

/** A bandit 6 tiles north throws a kunai at the player; returns HP lost. */
function scenario(seed: number, response: 'stay' | 'dodge' | 'brace'): number {
  const { g, lv, player } = testGame({ seed, x: 10, y: 16 });
  const b = spawn(g, lv, 'bandit_enforcer', 10, 10, 's');
  freeze(lv, b);
  Object.assign(lv.c.aware.get(b)!, { state: 'alert', level: 100, target: player });
  lv.c.inventory.get(b)!.items.kunai = 3;
  lv.c.sheet.get(b)!.skills.bukijutsu = 100; // never misses on accuracy alone
  lv.c.sheet.get(player)!.skills.taijutsu = 60;
  const hp0 = lv.c.vitals.get(player)!.hp;
  expect(perform(g, lv, b, { type: 'throw', weapon: 'kunai', target: player }).ok).toBe(true);
  lv.destroy(b); // only this one kunai matters
  // The player gets a turn while it's in the air.
  if (response === 'dodge') playerAct(g, { type: 'move', dx: 1, dy: 0 });
  else if (response === 'brace') playerAct(g, { type: 'brace' });
  else playerAct(g, { type: 'wait' });
  for (let i = 0; i < 3; i++) playerAct(g, { type: 'wait' });
  expect(lv.c.projectile.size).toBe(0);
  return hp0 - lv.c.vitals.get(player)!.hp;
}

describe('projectiles fly', () => {
  it('stepping out of the line makes a kunai miss', () => {
    for (let s = 1; s <= 10; s++) expect(scenario(s, 'dodge')).toBe(0);
  });

  it('standing still gets you hit', () => {
    let hits = 0;
    for (let s = 1; s <= 10; s++) if (scenario(s, 'stay') > 0) hits++;
    expect(hits).toBeGreaterThanOrEqual(8);
  });

  it('bracing deflects some — not all', () => {
    let blocked = 0;
    for (let s = 1; s <= 40; s++) if (scenario(s, 'brace') === 0) blocked++;
    expect(blocked).toBeGreaterThan(8);
    expect(blocked).toBeLessThan(40);
  });
});
