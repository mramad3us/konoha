/**
 * Balance probes: a fresh genin against each enemy tier, with a random player and one who
 * plays the reads well. Prints a table; asserts only broad sanity bounds.
 */
import { describe, it, expect } from 'vitest';
import { testGame, spawn } from './helpers.ts';
import { playerAct } from '../src/sim/turn.ts';
import { COUNTER, MOVES, BEATS, canAfford } from '../src/sim/combat.ts';
import { isStanding } from '../src/sim/vitals.ts';
import type { Move } from '../src/ecs/components.ts';
import type { Game } from '../src/sim/game.ts';
import type { Level } from '../src/ecs/level.ts';

type Strategy = 'random' | 'smart';

function pick(g: Game, lv: Level, foe: number, s: Strategy): Move {
  const me = lv.playerId;
  const ok = (m: Move) => canAfford(lv, me, m);
  if (s === 'random') {
    const opts = MOVES.filter(ok);
    return g.rng.pick(opts);
  }
  const c = lv.c.combat.get(foe)!;
  let want: Move = 'guard';
  if (c.intent && c.reveal === 'clear') want = COUNTER[c.intent];
  else if (c.intent && c.reveal === 'partial' && c.revealAlt) {
    const pair = [c.intent, c.revealAlt];
    want = MOVES.find(m => pair.some(x => BEATS[m] === x) && !pair.some(x => BEATS[x] === m)) ?? 'guard';
  } else {
    want = g.rng.weighted([['strike', 4], ['break', 2], ['guard', 4]] as const);
  }
  return ok(want) ? want : 'guard';
}

function duel(seed: number, arch: string, s: Strategy, playerTai = 8): { win: boolean; exchanges: number; hpLeft: number } {
  const { g, lv, player } = testGame({ seed });
  g.player.sheet.skills.taijutsu = playerTai;
  const foe = spawn(g, lv, arch, 11, 10, 'w');
  Object.assign(lv.c.aware.get(foe)!, { state: 'alert', level: 100, target: player });
  lv.c.brain.get(foe)!.flee = 0;
  playerAct(g, { type: 'wait' }); // let them commit
  let n = 0;
  while (isStanding(lv, player) && isStanding(lv, foe) && n < 300) {
    playerAct(g, { type: 'melee', move: pick(g, lv, foe, s), target: foe });
    n++;
  }
  const v = lv.c.vitals.get(player)!;
  return { win: !isStanding(lv, foe) && isStanding(lv, player), exchanges: n, hpLeft: v.hp / v.hpMax };
}

describe('balance probes', () => {
  it('prints win rates for a fresh genin', () => {
    const rows: string[] = [];
    const results: Record<string, number> = {};
    for (const arch of ['bandit_thug', 'bandit_enforcer', 'bandit_boss', 'rogue_genin']) {
      for (const s of ['random', 'smart'] as Strategy[]) {
        let wins = 0, ex = 0, hp = 0;
        const N = 60;
        for (let i = 0; i < N; i++) {
          const r = duel(1000 + i, arch, s);
          if (r.win) wins++;
          ex += r.exchanges; hp += r.hpLeft;
        }
        results[`${arch}:${s}`] = wins / N;
        rows.push(`${arch.padEnd(16)} ${s.padEnd(7)} win ${(wins / N * 100).toFixed(0).padStart(3)}%  exchanges ${(ex / N).toFixed(1).padStart(5)}  hp left ${(hp / N * 100).toFixed(0)}%`);
      }
    }
    console.log('\n' + rows.join('\n'));
    // A fresh genin who reads well should beat a thug most of the time…
    expect(results['bandit_thug:smart']).toBeGreaterThan(0.75);
    // …and reading should matter.
    expect(results['bandit_enforcer:smart']).toBeGreaterThan(results['bandit_enforcer:random']);
    // A rogue shinobi should be a real threat to a fresh genin in a fair fight.
    expect(results['rogue_genin:smart']).toBeLessThan(0.6);
  });
});
