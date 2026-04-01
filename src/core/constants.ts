/**
 * Single source of truth for all game constants.
 * Every magic number, version string, and config value lives here.
 */

declare const __GAME_VERSION__: string;
export const GAME_VERSION: string = __GAME_VERSION__;
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
export const NIGHT_MAX_DIM = 0.72;        // max darkness alpha at midnight
export const NIGHT_FOV_REDUCTION = 6;     // tiles of FOV lost at deepest night

// ── Unified Tick System ──
// The world ticks at 0.1s granularity. One universal tick, no subticks or coarse ticks.
// All systems fire at their own cadence within worldTick().
export const TICK_SECONDS = 0.1;              // seconds per tick (the single time unit)
export const SLOW_SYSTEM_INTERVAL = 30;       // ticks between slow system updates (3s)
export const COMBAT_PASS_TICKS = 20;          // 2 seconds = 20 ticks (1 combat exchange)
export const WAIT_TICKS = 5;                  // 0.5 seconds
export const THROW_ACTION_TICKS = 5;          // 0.5 seconds
export const DOOR_OPEN_TICKS = 20;            // 2 seconds
export const SURPRISE_ATTACK_TICKS = 40;      // 4 seconds
export const SWIM_STEP_TICKS = 240;           // 24 seconds

// ── Stamina Rework ──
export const STAMINA_ATTACK_COST = 1;     // per combat key press (attack only)
export const STAMINA_SPRINT_COST = 1;     // per sprint step
export const STAMINA_RESTORE_RATE = 0.02; // fraction of max per tick when resting
export const STAMINA_REST_TICKS = 90;     // ticks of rest before regen starts (9s)
export const STAMINA_FATIGUE_DRAIN = 0.1; // ceiling drop per exertion
export const STAMINA_FATIGUE_FLOOR = 0.3; // min ceiling as fraction of max

// ── Chakra Regen (mirrors stamina, uses CHA stat) ──
export const CHAKRA_RESTORE_RATE = 0.02;  // fraction of max per tick when resting
export const CHAKRA_REST_TICKS = 90;      // ticks of rest before regen starts (9s)
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
export const AUTO_SAVE_INTERVAL_TICKS = 600;  // 60 seconds

// ── Game Log ──
export const MAX_LOG_ENTRIES = 50;
export const VISIBLE_LOG_ENTRIES = 50;

// ── Layout ──
export const GAME_CANVAS_WIDTH_PERCENT = 75;
export const GAME_HUD_WIDTH_PERCENT = 25;

// ── NPC Movement ──
export const NPC_WANDER_RADIUS = 4;
export const NPC_WANDER_INTERVAL_MIN = 90;   // min ticks between idle steps (9s)
export const NPC_WANDER_INTERVAL_MAX = 150;  // max ticks between idle steps (15s)
export const NPC_CHASE_STEP_TICKS = 30;      // ticks between chase/flee steps (3s)
export const NPC_RETURN_STEP_TICKS = 60;     // ticks between return-to-anchor steps (6s)
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

// ── Stance Tick Costs ──
// How many ticks (0.1s each) each step costs.
export const STANCE_TICK_COST: Record<string, number> = {
  sprint: 30,           // 3s
  walk: 60,             // 6s
  creep: 90,            // 9s
  crawl: 120,           // 12s
  chakra_sprint: 20,    // 2s base (dynamic: 20/10/5 ticks at nin 10/30/50)
};

export const STANCE_STAMINA_COST: Record<string, number> = {
  sprint: 1,
  walk: 0,
  creep: 0,
  crawl: 0,
  chakra_sprint: 0,
};

// ── Chakra Sprint ──
export const CHAKRA_SPRINT_COST = 1;    // chakra per step

// ── Water Walk ──
export const WATER_WALK_CHAKRA_COST = 2;  // chakra per step on water

// ── Thrown Weapons ──
export const KUNAI_BASE_DAMAGE = 8;
export const KUNAI_SPEED = 5;             // ticks per tile (0.5s)
export const KUNAI_EVASION_PENALTY = 0;   // % penalty to dodge
export const KUNAI_MAX_RANGE = 10;

export const SHURIKEN_BASE_DAMAGE = 5;
export const SHURIKEN_SPEED = 10;         // ticks per tile (1s)
export const SHURIKEN_EVASION_PENALTY = 20;
export const SHURIKEN_MAX_RANGE = 10;

export const MAX_THROWN_AMMO = 10;        // per weapon type on restock
export const BLOOD_DECAL_DURATION_HOURS = 1;

// Throw cooldown tiers (ticks) by bukijutsu skill
export const THROW_COOLDOWN_TIER1 = 30;  // buki 1-15:  3s
export const THROW_COOLDOWN_TIER2 = 20;  // buki 16-30: 2s
export const THROW_COOLDOWN_TIER3 = 10;  // buki 31-45: 1s
export const THROW_COOLDOWN_TIER4 = 5;   // buki 46+:   0.5s

// ── Ninpo (hand-sign jutsu) ──
export const NINPO_SIGN_SPEED_THRESHOLDS = [10, 30, 50] as const;
// Sign speed in ticks per hand sign (0.1s each)
export const NINPO_SIGN_SPEED_TICKS = { tier1: 20, tier2: 15, tier3: 10, tier4: 5 } as const;
// Vanish duration brackets: <30 → 60s, 30-49 → 3600s, 50+ → permanent (-1)
// Shadow Step range: level 10 → 3 tiles, level 50+ → 10 tiles (linear fill)

// ── Reaction Delay (ticks, 0.1s each) ──
// Indexed by taijutsu bracket: [<10, 10-19, 20-39, 40-59, 60+]
export const REACTION_DELAY_FRESH: number[] = [40, 25, 15, 8, 3];       // 4s → 0.3s
export const REACTION_DELAY_REPOSITION: number[] = [20, 12, 8, 4, 2];   // 2s → 0.2s (mid-combat halved)

// ── Throw Mode Timing (ticks) ──
// Indexed by bukijutsu bracket: [<10, 10-15, 16-30, 31-45, 46+]
export const THROW_ENTRY_TICKS: number[] = [10, 8, 5, 3, 2];           // 1s → 0.2s to draw weapon
export const THROW_REENTRY_TICKS: number[] = [20, 15, 10, 7, 5];       // 2s → 0.5s between throws

// ── Subdue/Assassinate ──
export const SUBDUE_ASSASSINATE_TICKS = 20;  // 2 seconds = 1 combat pass

// ── Substitution ──
export const SUBSTITUTION_COOLDOWN_TICKS = 20;  // 2 seconds = 1 combat pass

// ── Blood Decals ──
export const BLOOD_DECAL_MAX_AGE_TICKS = 36000;  // 1 hour at 0.1s/tick

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
