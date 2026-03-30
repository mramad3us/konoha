/**
 * Single source of truth for all game constants.
 * Every magic number, version string, and config value lives here.
 */

export const GAME_VERSION = '0.2.2';
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

// ── Subtick System ──
// The world ticks at 0.5s granularity. Coarse "ticks" = 6 subticks = 3 seconds.
// Slow systems (NPC movement, dialogue, day/night) only fire when a coarse tick boundary is crossed.
// Fast actions (combat, chakra sprint) don't cross boundaries → world doesn't react.
export const SUBTICK_DURATION = 0.5;      // seconds per subtick
export const SUBTICKS_PER_TICK = 6;       // 6 subticks = 3 seconds = 1 coarse tick
export const COMBAT_PASS_SUBTICKS = 4;    // 2 seconds = 4 subticks (1 combat exchange)

// ── Stamina Rework ──
export const STAMINA_ATTACK_COST = 1;     // per combat key press (attack only)
export const STAMINA_SPRINT_COST = 2;     // per sprint step
export const STAMINA_RESTORE_RATE = 0.02; // fraction of max per tick when resting
export const STAMINA_REST_TICKS = 3;      // coarse ticks of rest before regen starts
export const STAMINA_FATIGUE_DRAIN = 0.1; // ceiling drop per exertion
export const STAMINA_FATIGUE_FLOOR = 0.3; // min ceiling as fraction of max

// ── Chakra Regen (mirrors stamina, uses CHA stat) ──
export const CHAKRA_RESTORE_RATE = 0.02;  // fraction of max per tick when resting
export const CHAKRA_REST_TICKS = 3;       // coarse ticks of rest before regen starts
export const CHAKRA_FATIGUE_DRAIN = 0.1;  // ceiling drop per exertion
export const CHAKRA_FATIGUE_FLOOR = 0.3;  // min ceiling as fraction of max
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

// ── NPC Movement ──
export const NPC_WANDER_RADIUS = 4;
export const NPC_WANDER_INTERVAL_MIN = 3;  // min ticks between idle steps
export const NPC_WANDER_INTERVAL_MAX = 5;  // max ticks between idle steps
export const NPC_DESPAWN_MAX_WALK = 30;    // max tiles a civilian walks before forced despawn

// ── Combat Disengagement ──
// Same cost as one chakra-sprint step: 3 stamina + 3 chakra for a clean 1-pass retreat.
// Without chakra: slow retreat (3 passes, 3 free hits from opponent).
// Without stamina: can't disengage at all.
export const DISENGAGE_STAMINA_COST = 3;
export const DISENGAGE_CHAKRA_COST = 3;
export const CIVILIAN_DISENGAGE_HITS = 3;
export const NPC_FLEE_HP_THRESHOLD = 0.25;

// ── Input ──
export const INPUT_DEBOUNCE_MS = 50;

// ── Stance Subtick Costs ──
// How many subticks each step costs. 6 subticks = 1 coarse tick = 3 seconds.
export const STANCE_SUBTICK_COST: Record<string, number> = {
  sprint: 6,          // 3s — NPCs act once per step
  walk: 12,           // 6s — NPCs act twice per step
  creep: 18,          // 9s — NPCs act 3 times
  crawl: 24,          // 12s — NPCs act 4 times
  chakra_sprint: 4,   // 2s base (dynamic: 4/2/1 subticks at nin 10/30/50)
};

/** @deprecated — use STANCE_SUBTICK_COST. Kept for HUD display (coarse ticks per move). */
export const STANCE_TICK_COST: Record<string, number> = {
  sprint: 1,
  walk: 2,
  creep: 3,
  crawl: 4,
  chakra_sprint: 0,   // sub-tick (shows special display in HUD)
};

export const STANCE_STAMINA_COST: Record<string, number> = {
  sprint: 2,
  walk: 0,
  creep: 0,
  crawl: 0,
  chakra_sprint: 0,
};

// ── Chakra Sprint ──
export const CHAKRA_SPRINT_COST = 3;    // chakra per step

// ── Water Walk ──
export const WATER_WALK_CHAKRA_COST = 2;  // chakra per step on water

// ── Away Missions ──
export const MISSION_MAP_WIDTH = 160;
export const MISSION_MAP_HEIGHT = 160;
export const MISSION_MAP_EDGE_ZONE = 3;   // tiles from edge where extraction is available

// Overmap travel
export const OVERMAP_WALK_SPEED_KMH = 5;  // leisurely walking pace
export const OVERMAP_CAMP_START_HOUR = 20; // make camp at 8 PM
export const OVERMAP_CAMP_END_HOUR = 6;    // break camp at 6 AM
export const OVERMAP_CANVAS_WIDTH = 800;
export const OVERMAP_CANVAS_HEIGHT = 600;

// Rank tier thresholds (per skill/stat)
export const RANK_TIER_GENIN_MAX = 25;
export const RANK_TIER_CHUUNIN_MAX = 50;
export const RANK_TIER_JONIN_MAX = 70;

// Mission XP scaling
export const MISSION_XP_BELOW_RANK = 1.5;   // skill below mission rank: 150% bulk
export const MISSION_XP_AT_RANK = 1.0;       // skill at mission rank: 100% bulk
export const MISSION_XP_ABOVE_RANK = 0.5;    // skill one rank above: 50% bulk
export const MISSION_XP_FAR_ABOVE = 0.1;     // skill two+ ranks above: 10% bulk (floor)

export const MISSION_ACTION_XP_BELOW_RANK = 10;  // x10 during mission if below rank
export const MISSION_ACTION_XP_AT_RANK = 5;       // x5 at rank
export const MISSION_ACTION_XP_ABOVE_RANK = 2;    // x2 above rank (floor)

// C-rank mission bulk rewards (base values before scaling)
export const C_RANK_BULK_REWARD: Record<string, number> = {
  taijutsu: 0.8,
  ninjutsu: 0.3,
  phy: 0.5,
  cha: 0.2,
  men: 0.1,
};

// Mission-type-specific bonus rewards (added to base)
export const C_RANK_TYPE_BONUS: Record<string, Record<string, number>> = {
  bandit_capture: { taijutsu: 0.4, phy: 0.3 },
  gang_elimination: { taijutsu: 0.6, phy: 0.4, men: 0.2 },
  escort: { men: 0.3, cha: 0.2 },
};

// B-rank mission bulk rewards (base values before scaling)
export const B_RANK_BULK_REWARD: Record<string, number> = {
  taijutsu: 1.2,
  ninjutsu: 0.6,
  bukijutsu: 0.4,
  phy: 0.8,
  cha: 0.4,
  men: 0.3,
};

export const B_RANK_TYPE_BONUS: Record<string, Record<string, number>> = {
  encampment_assault: { taijutsu: 0.6, phy: 0.5, men: 0.3 },
  asset_recovery: { ninjutsu: 0.4, men: 0.4, cha: 0.3 },
  infiltration: { taijutsu: 0.3, ninjutsu: 0.5, men: 0.5 },
};

// A-rank mission bulk rewards (base values before scaling)
export const A_RANK_BULK_REWARD: Record<string, number> = {
  taijutsu: 1.8,
  ninjutsu: 1.0,
  bukijutsu: 0.6,
  phy: 1.2,
  cha: 0.6,
  men: 0.5,
};

export const A_RANK_TYPE_BONUS: Record<string, Record<string, number>> = {
  rogue_nin_pursuit: { taijutsu: 0.8, phy: 0.6, men: 0.4 },
  threat_response: { taijutsu: 1.0, phy: 0.8, ninjutsu: 0.5 },
  assassination_prevention: { ninjutsu: 0.8, men: 0.6, taijutsu: 0.5 },
};
