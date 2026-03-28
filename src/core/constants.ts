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
