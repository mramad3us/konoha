/**
 * Single source of truth for all game constants.
 * Every magic number, version string, and config value lives here.
 */

export const GAME_VERSION = '0.1.5';
export const GAME_TITLE = 'Konoha';
export const GAME_SUBTITLE = 'Path of the Shinobi';

export const DB_NAME = 'konoha-saves';
export const DB_VERSION = 1;
export const DB_STORE_NAME = 'saves';
export const DB_SETTINGS_STORE = 'settings';

export const MAX_SAVE_SLOTS = 20;
export const AUTO_SAVE_SLOT_ID = '__autosave__';

export const SCREEN_TRANSITION_MS = 400;
export const MENU_STAGGER_MS = 80;

export const LOCAL_STORAGE_KEYS = {
  LAST_SAVE_ID: 'konoha_last_save_id',
  SETTINGS: 'konoha_settings',
} as const;

export const PIXEL_SCALE = 4;

// ── Game Engine ──
export const TILE_WIDTH = 48;
export const TILE_HEIGHT = 32;

export const TRAINING_GROUNDS_WIDTH = 40;
export const TRAINING_GROUNDS_HEIGHT = 40;

// ── Village ──
export const VILLAGE_WIDTH = 160;
export const VILLAGE_HEIGHT = 160;
export const VILLAGE_PLAYER_START_X = 80;
export const VILLAGE_PLAYER_START_Y = 140;

// Training grounds offset within village
export const TG_OFFSET_X = 6;
export const TG_OFFSET_Y = 16;

// Legacy (for training grounds standalone)
export const PLAYER_START_X = 20;
export const PLAYER_START_Y = 37;

export const FOV_RADIUS = 10;

// ── Player Base Stats (actual max = base + stat * scaling) ──
export const BASE_PLAYER_HP = 50;
export const HP_PHY_SCALING = 2;           // maxHP = 50 + PHY * 2
export const BASE_PLAYER_CHAKRA = 20;
export const CHAKRA_CHA_SCALING = 1.5;     // maxChakra = 20 + CHA * 1.5
export const BASE_PLAYER_WILLPOWER = 10;
export const WILLPOWER_MEN_SCALING = 1;    // maxWillpower = 10 + MEN * 1
export const BASE_PLAYER_STAMINA = 20;
export const STAMINA_PHY_SCALING = 0.8;    // maxStamina = 20 + PHY * 0.8
export const BASE_PLAYER_DAMAGE = 5;
export const BASE_PLAYER_ACCURACY = 85;
export const BASE_PLAYER_EVASION = 15;

// ── Training Dummy ──
export const TRAINING_DUMMY_HP = 25;

// ── Combat ──
export const MELEE_STAMINA_COST = 1;

// ── Game Time ──
export const PASS_DURATION_SECONDS = 2;   // 1 combat exchange = 2s in-game
export const TICK_DURATION_SECONDS = 6;   // 1 movement step (walk) = 6s in-game
export const SECONDS_PER_DAY = 86400;
export const GAME_START_HOUR = 8;         // game starts at 8:00 AM

// ── Day/Night ──
export const DAWN_HOUR = 6;
export const DUSK_HOUR = 18;
export const NIGHT_MAX_DIM = 0.55;        // max darkness alpha at midnight
export const NIGHT_FOV_REDUCTION = 4;     // tiles of FOV lost at deepest night

// ── Stamina Rework ──
export const STAMINA_ATTACK_COST = 1;     // per combat key press (attack only)
export const STAMINA_SPRINT_COST = 2;     // per sprint step
export const STAMINA_RESTORE_RATE = 0.02; // fraction of max per tick when resting
export const STAMINA_REST_TICKS = 3;      // consecutive non-exerting passes before regen
export const STAMINA_FATIGUE_DRAIN = 0.1; // ceiling drop per exertion
export const STAMINA_FATIGUE_FLOOR = 0.3; // min ceiling as fraction of max
// STAMINA_PHY_SCALING defined above in base stats section

// ── Respawn ──
export const RESPAWN_FADE_MS = 800;
export const TRAINING_RESPAWN_TIME_S = 3600;  // 1 in-game hour

// ── Interact ──
export const INTERACT_TIME_SECONDS = 2;

// ── Jutsu ──
export const SUBSTITUTION_CHAKRA_COST = 15;
export const SUBSTITUTION_COOLDOWN_PASSES = 5;

// ── Critical Hits ──
export const CRIT_BASE_CHANCE = 0.05;     // 5% base chance per clean hit
export const SCREEN_SHAKE_DURATION_MS = 300;
export const SCREEN_SHAKE_INTENSITY = 4;  // pixels

// ── Camera ──
export const CAMERA_LERP_FACTOR = 0.15;

// ── Saves ──
export const AUTO_SAVE_INTERVAL_TURNS = 20;

// ── Game Log ──
export const MAX_LOG_ENTRIES = 50;
export const VISIBLE_LOG_ENTRIES = 50;

// ── Layout ──
export const GAME_CANVAS_WIDTH_PERCENT = 75;
export const GAME_HUD_WIDTH_PERCENT = 25;

// ── Input ──
export const INPUT_DEBOUNCE_MS = 50;

// ── Stance Tick Costs ──
export const STANCE_TICK_COST = {
  sprint: 1,
  walk: 2,
  creep: 3,
  crawl: 4,
} as const;

export const STANCE_STAMINA_COST = {
  sprint: 2,
  walk: 0,
  creep: 0,
  crawl: 0,
} as const;
