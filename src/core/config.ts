/**
 * Every tuning number in one place. Gameplay code imports from here, never hardcodes.
 */

declare const __GAME_VERSION__: string;
export const GAME_VERSION: string = __GAME_VERSION__;
export const GAME_TITLE = 'Konoha';
export const GAME_SUBTITLE = 'Path of the Shinobi';
export const SAVE_VERSION = 1;

// ── Time ──
export const TICK_SECONDS = 0.1;
export const TICKS_PER_SECOND = 10;
export const SECONDS_PER_DAY = 86_400;
export const TICKS_PER_DAY = SECONDS_PER_DAY * TICKS_PER_SECOND;
export const TICKS_PER_HOUR = 3600 * TICKS_PER_SECOND;
export const START_HOUR = 7;
export const PULSE_TICKS = 10;            // 1 s: bleeding, regen, statuses, awareness decay, NPC melee
export const DAWN_HOUR = 6;
export const DUSK_HOUR = 19;

export const SECONDS = (s: number): number => Math.round(s * TICKS_PER_SECOND);

// ── Movement (ticks per step) ──
export const STEP_TICKS = {
  walk: 10,
  run: 5,
  sneak: 20,
  dash: 3,
  swim: 30,
} as const;
export const CARRY_STEP_MULT = 2;
export const RUN_STAMINA_PER_STEP = 1;
export const DASH_CHAKRA_PER_STEP = 1;
export const SWIM_STAMINA_PER_STEP = 2;
export const WATER_WALK_CHAKRA_PER_STEP = 1;

// ── Durations ──
export const WAIT_TICKS = SECONDS(1);
export const EXCHANGE_TICKS = SECONDS(1);
export const DOOR_TICKS = SECONDS(1);
export const PICKUP_TICKS = SECONDS(0.5);
export const TAKEDOWN_TICKS = SECONDS(2);
export const RESTRAIN_TICKS = SECONDS(8);
export const SEARCH_TICKS = SECONDS(3);
export const CARRY_TICKS = SECONDS(1.5);
export const THROW_TICKS = SECONDS(1);
export const BANDAGE_TICKS = [SECONDS(20), SECONDS(12), SECONDS(8), SECONDS(5)]; // by medicine tier

// ── Vitals ──
export const HP_BASE = 40;
export const HP_PER_BODY = 1.5;
export const STAMINA_BASE = 12;
export const STAMINA_PER_BODY = 0.6;
export const CHAKRA_BASE = 20;
export const CHAKRA_PER_CHAKRA = 1.5;
export const STAMINA_REGEN_PER_SEC = 0.5;      // when not exerting
export const STAMINA_REGEN_DELAY_TICKS = SECONDS(3);
export const CHAKRA_REGEN_PER_SEC = 0.02;      // per point of Chakra attribute, out of combat
export const HP_REGEN_PER_SEC = 0.01;          // natural healing, out of combat
export const KO_MIN_SECONDS = 60;
export const KO_MAX_SECONDS = 600;
export const KO_BLEED_DEATH_SECONDS = 45;       // bleeding while KO → death after this long

// ── Melee ──
export const EXCHANGE_STAMINA = { strike: 1, break: 2, guard: -1 } as const;
export const DAMAGE_BASE = 6;
export const DAMAGE_PER_TAIJUTSU = 0.12;
export const DAMAGE_PER_BODY = 0.18;
export const DAMAGE_VARIANCE = 0.2;
export const TRADE_DAMAGE_MULT = 0.5;
export const PARRY_COUNTER_MULT = 0.35;
export const BREAK_DAMAGE_MULT = 0.8;
export const FLANK_DAMAGE_MULT = 1.25;
export const OPEN_DAMAGE_MULT = 1.0;          // hit while doing something else
export const TEMPO_DAMAGE_BONUS = 0.12;       // per tempo point
export const TEMPO_READ_BONUS = 10;           // read score per tempo point
export const LETHAL_DAMAGE_MULT = 1.25;       // kunai drawn
export const CRIT_ON_CLEAR_READ = 0.35;       // chance a clear-read win is a crit
export const CRIT_MULT = 1.6;
export const READ_BASE = 45;
export const READ_PER_TAIJUTSU_DIFF = 2.5;
export const READ_PER_MIND = 0.4;
export const READ_FULL_MARGIN = 45;           // score above this margin → clear read
/** Tempo slots: one at Taijutsu 5, then every 12 points. */
export function tempoSlots(taijutsu: number): number {
  if (taijutsu < 5) return 0;
  return Math.min(5, 1 + Math.floor((taijutsu - 5) / 12));
}

// ── Ranged ──
export const THROWN = {
  kunai: { damage: [5, 9] as const, range: 8, accuracy: 0 },
  shuriken: { damage: [3, 6] as const, range: 9, accuracy: 10 },
} as const;
export const THROW_HIT_BASE = 55;
export const THROW_HIT_PER_BUKI = 0.8;
export const THROW_HIT_PER_TILE = -3;
export const THROW_HIT_UNAWARE = 30;
export const THROW_HIT_ENGAGED = -10;          // target busy in melee with someone else... harder to aim cleanly
export const SNEAK_THROW_MULT = 1.8;

// ── Stealth ──
export const VIEW_CONE_RADIANS = (120 * Math.PI) / 180;
export const VIEW_RANGE_DAY = 9;
export const VIEW_RANGE_NIGHT = 5;
export const PERIPHERAL_RANGE = 1.5;          // sees/feels you even behind when this close
export const AWARE_SUSPICIOUS = 40;
export const AWARE_ALERT = 100;
export const AWARE_GAIN_PER_SEC = 55;         // at walk, 1 tile, full light, no cover
export const AWARE_DECAY_PER_SEC = 6;
export const STANCE_VISIBILITY = { walk: 1, run: 1.5, sneak: 0.35, dash: 1.6, swim: 1 } as const;
export const COVER_VISIBILITY = 0.35;
export const STANCE_NOISE = { walk: 2, run: 5, sneak: 0, dash: 3, swim: 3 } as const;
export const NOISE_COMBAT = 7;
export const NOISE_IMPACT = 4;
export const SEARCH_GIVE_UP_SECONDS = 25;

// ── Progression ──
export const SKILL_GAIN_CURVE = 1.6;
export const XP = {
  exchangeWin: 0.06,
  exchangeAny: 0.02,
  takedown: 0.25,
  throwHit: 0.08,
  throwAny: 0.02,
  sneakStepSeen: 0.004,       // sneaking within view range of an unaware enemy
  technique: 0.08,
  sign: 0.01,
  bandage: 0.15,
  bodyExertion: 0.003,        // per stamina point spent
  chakraUse: 0.004,           // per chakra point spent
  trainingHour: 0.35,         // per hour of focused training, before daily fatigue
  meditationHour: 0.3,
} as const;
/** XP multiplier for fighting/acting against a stronger/weaker opponent. */
export function challengeMult(own: number, opp: number): number {
  const d = opp - own;
  return Math.max(0.15, Math.min(2.5, 1 + d / 15));
}
export const TRAINING_DAILY_HOURS = 6;          // full gain hours per day; beyond that, 20 %

// ── Economy ──
export const START_RYO = 120;
export const PRICES = {
  kunai: 15,
  shuriken: 8,
  bandage: 12,
  soldier_pill: 60,
} as const;
export const HOSPITAL_PRICE = 40;
export const DEFEAT_RYO_LOSS = 0.15;

// ── Missions ──
export const BOARD_SIZE = 6;
export const C_RANK_REQUIRES_D = 3;

// ── Render ──
export const TILE_W = 32;
export const TILE_H = 16;
export const CHUNK = 16;
export const MOVE_TWEEN_MS = 110;
export const DEFAULT_ZOOM = 3;
