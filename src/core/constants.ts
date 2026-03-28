/**
 * Single source of truth for all game constants.
 * Every magic number, version string, and config value lives here.
 */

export const GAME_VERSION = '0.1.0';
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
export const PLAYER_START_X = 20;
export const PLAYER_START_Y = 37;

export const FOV_RADIUS = 10;

// ── Player Base Stats ──
export const BASE_PLAYER_HP = 100;
export const BASE_PLAYER_CHAKRA = 50;
export const BASE_PLAYER_WILLPOWER = 30;
export const BASE_PLAYER_STAMINA = 40;
export const BASE_PLAYER_DAMAGE = 5;
export const BASE_PLAYER_ACCURACY = 85;
export const BASE_PLAYER_EVASION = 15;

// ── Training Dummy ──
export const TRAINING_DUMMY_HP = 25;

// ── Combat ──
export const MELEE_STAMINA_COST = 1;

// ── Camera ──
export const CAMERA_LERP_FACTOR = 0.15;

// ── Saves ──
export const AUTO_SAVE_INTERVAL_TURNS = 20;

// ── Game Log ──
export const MAX_LOG_ENTRIES = 200;
export const VISIBLE_LOG_ENTRIES = 15;

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
