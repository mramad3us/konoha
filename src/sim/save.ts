/**
 * Whole-game serialization. A save is plain JSON: game root + every live level.
 */

import { Game, type LogEntry, type PlayerProfile } from './game.ts';
import { Rng, type RngState } from '../core/rng.ts';
import { serializeLevel, deserializeLevel, type LevelData } from '../ecs/serialize.ts';
import { linkPlayer } from './spawn.ts';
import { SAVE_VERSION, TICKS_PER_DAY } from '../core/config.ts';
import { primeLevel } from './turn.ts';

export interface SaveMeta {
  name: string;
  rank: string;
  day: number;
  location: string;
  ryo: number;
  savedAt: number;
  playSeconds: number;
}

export interface SaveData {
  version: number;
  meta: SaveMeta;
  seed: number;
  clock: number;
  rng: RngState;
  player: PlayerProfile;
  activeId: string;
  log: LogEntry[];
  ext: Record<string, unknown>;
  levels: LevelData[];
}

export function saveGame(g: Game, playSeconds: number): SaveData {
  return {
    version: SAVE_VERSION,
    meta: {
      name: g.player.name.name,
      rank: g.player.sheet.rank,
      day: Math.floor(g.clock / TICKS_PER_DAY) + 1,
      location: g.level.meta.name,
      ryo: g.player.inventory.ryo,
      savedAt: Date.now(),
      playSeconds,
    },
    seed: g.seed,
    clock: g.clock,
    rng: g.rng.state,
    player: structuredClone(g.player),
    activeId: g.activeId,
    log: g.log.slice(-120),
    ext: structuredClone(g.ext),
    levels: [...g.levels.values()].map(serializeLevel),
  };
}

export function loadGame(d: SaveData): Game {
  if (d.version !== SAVE_VERSION) throw new Error(`Save version ${d.version} is not supported (expected ${SAVE_VERSION}).`);
  const g = new Game(d.seed, structuredClone(d.player), d.clock);
  g.rng = new Rng(d.rng);
  g.log = d.log.slice();
  g.ext = structuredClone(d.ext);
  for (const ld of d.levels) {
    const lv = deserializeLevel(ld);
    g.levels.set(lv.id, lv);
    if (lv.playerId) linkPlayer(g, lv);
  }
  g.activeId = d.activeId;
  primeLevel(g, g.level);
  return g;
}
