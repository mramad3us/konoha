/**
 * Game: the root of all state. Owns the clock, RNG, player profile, levels, log, missions,
 * squad roster and travel. Serializing a Game is a complete save.
 */

import { Rng } from '../core/rng.ts';
import type { Level } from '../ecs/level.ts';
import type { Appearance, Inventory, Name, Sheet, Vitals, EntityId } from '../ecs/components.ts';
import { TICKS_PER_DAY, TICKS_PER_HOUR, START_HOUR } from '../core/config.ts';

export type LogCat =
  | 'info' | 'system' | 'good' | 'bad' | 'combat' | 'hit' | 'hurt' | 'stealth' | 'mission' | 'skill' | 'speech' | 'item';

export interface LogEntry { tick: number; text: string; cat: LogCat }

export type MissionRankLetter = 'D' | 'C' | 'B' | 'A';

export interface PlayerProfile {
  name: Name;
  appearance: Appearance;
  sheet: Sheet;
  vitals: Vitals;
  inventory: Inventory;
  /** Kunai drawn: lethal intent in melee. */
  lethal: boolean;
  record: {
    missions: Record<MissionRankLetter, number>;
    failed: number;
    kills: number;
    takedowns: number;
    defeats: number;
  };
  training: { day: number; hours: number };
  /** Tick until which the player is injured (reduced max HP). */
  injuredUntil: number;
  flags: Record<string, number | boolean | string>;
}

/** Requests from the sim to the UI layer (open a panel, start a flow). */
export type UiRequest =
  | { kind: 'facility'; facility: string; entity: EntityId }
  | { kind: 'talk'; entity: EntityId }
  | { kind: 'aim_shadow_step'; range: number }
  | { kind: 'defeat' }
  | { kind: 'leave_area' }
  | { kind: 'depart' }
  | { kind: 'examine'; entity: EntityId };

export class Game {
  clock: number;
  rng: Rng;
  seed: number;
  player: PlayerProfile;
  levels = new Map<string, Level>();
  activeId = 'village';
  log: LogEntry[] = [];
  requests: UiRequest[] = [];
  /** Free-form persistent state owned by subsystems (missions, roster, travel…). */
  ext: Record<string, unknown> = {};

  constructor(seed: number, player: PlayerProfile, clock = START_HOUR * TICKS_PER_HOUR) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.player = player;
    this.clock = clock;
  }

  get level(): Level {
    const lv = this.levels.get(this.activeId);
    if (!lv) throw new Error(`No active level '${this.activeId}'`);
    return lv;
  }

  get day(): number {
    return Math.floor(this.clock / TICKS_PER_DAY) + 1;
  }

  /** Hour of day as a float 0..24. */
  get hour(): number {
    return (this.clock % TICKS_PER_DAY) / TICKS_PER_HOUR;
  }

  say(text: string, cat: LogCat = 'info'): void {
    this.log.push({ tick: this.clock, text, cat });
    if (this.log.length > 300) this.log.splice(0, this.log.length - 300);
  }

  request(r: UiRequest): void {
    this.requests.push(r);
  }
}
