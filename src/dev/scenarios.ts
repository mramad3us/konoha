/** Dev-only scenarios for visual QA and quick playtesting (?dev=name&hour=n&seed=n). */
import { Game } from '../sim/game.ts';
import { newProfile, placePlayer, spawnArchetype } from '../sim/spawn.ts';
import { generateMissionMap } from '../world/gen/mission.ts';
import { TICKS_PER_HOUR } from '../core/config.ts';

export function devScenario(name: string): Game {
  const q = new URLSearchParams(location.search);
  const hour = Number(q.get('hour') ?? 14);
  const seed = Number(q.get('seed') ?? 7);
  const g = new Game(seed, newProfile('Hasuke', 'm'), hour * TICKS_PER_HOUR);
  g.player.appearance.hair = 'spiky';
  const biome = (q.get('biome') ?? 'forest') as 'forest';
  const r = generateMissionMap(g, {
    id: 'dev', name: 'Kusagaya Woods', seed, size: Number(q.get('size') ?? 64), biome, hour,
    site: { kind: name === 'empty' ? 'none' : 'camp', leader: 'bandit_boss', guards: ['bandit_thug', 'bandit_thug'], patrols: ['bandit_enforcer'], campers: ['bandit_thug', 'bandit_thug'] },
  });
  if (name === 'duel') {
    const p = r.start;
    const b = spawnArchetype(g, r.level, q.get('foe') ?? 'bandit_enforcer', p.x, p.y - 1, { facing: 's' });
    Object.assign(r.level.c.aware.get(b)!, { state: 'alert', level: 100, target: -1 });
  }
  g.levels.set('dev', r.level);
  g.activeId = 'dev';
  placePlayer(g, r.level, r.start.x, r.start.y, 'n');
  for (const [, aw] of r.level.c.aware) if (aw.target === -1) aw.target = r.level.playerId;
  g.ext.objectives = [{ text: 'Find the bandit camp' }, { text: 'Capture the leader alive' }];
  g.say('You reach the edge of the woods. Somewhere ahead, smoke rises.', 'system');
  return g;
}
