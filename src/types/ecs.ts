/** Numeric entity identifier */
export type EntityId = number;

export type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type RenderLayer = 'floor' | 'object' | 'character' | 'effect';
export type MovementStance = 'sprint' | 'walk' | 'creep' | 'crawl';
export type AIBehavior = 'static' | 'patrol' | 'chase';

/** Direction vectors for grid movement */
export const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  n:  { dx:  0, dy: -1 },
  s:  { dx:  0, dy:  1 },
  e:  { dx:  1, dy:  0 },
  w:  { dx: -1, dy:  0 },
  ne: { dx:  1, dy: -1 },
  nw: { dx: -1, dy: -1 },
  se: { dx:  1, dy:  1 },
  sw: { dx: -1, dy:  1 },
} as const;

/** Render layer draw order (lower = drawn first) */
export const LAYER_ORDER: Record<RenderLayer, number> = {
  floor: 0,
  object: 1,
  character: 2,
  effect: 3,
} as const;

// ── Components ──

export interface PositionComponent {
  x: number;
  y: number;
  facing: Direction;
}

export interface RenderableComponent {
  spriteId: string;
  layer: RenderLayer;
  offsetY: number;
  tint?: string;
}

export interface BlockingComponent {
  blocksMovement: boolean;
  blocksSight: boolean;
}

export interface HealthComponent {
  current: number;
  max: number;
}

export interface CombatStatsComponent {
  damage: number;
  accuracy: number;
  evasion: number;
  attackVerb: string;
}

export interface PlayerControlledComponent {
  movementStance: MovementStance;
}

export interface ResourcesComponent {
  chakra: number;
  maxChakra: number;
  willpower: number;
  maxWillpower: number;
  stamina: number;
  maxStamina: number;
  staminaCeiling: number;       // max natural restore point (fatigue)
  lastExertionTick: number;     // tick of last stamina-consuming action
  blood: number;                // current blood (0-100)
  maxBlood: number;             // max blood capacity (always 100)
}

export interface BleedingComponent {
  intensity: number;            // bleed rate (1-10 dmg per tick to blood)
  tickApplied: number;          // tick when bleeding started/refreshed
}

export interface AIControlledComponent {
  behavior: AIBehavior;
}

export interface NameComponent {
  display: string;
  article: 'a' | 'an' | 'the' | '';
}

export interface DestructibleComponent {
  onDestroyMessage: string;
  respawnTicks: number;
}

export interface UnconsciousComponent {
  reason: 'hp' | 'willpower' | 'ability';
  tickFallen: number;
  recoveryTick: number; // tick at which entity auto-wakes (random 1min-1hr)
}

export type ObjectCategory = 'terrain' | 'object' | 'npc' | 'creature';

export interface ObjectSheetComponent {
  description: string;
  examineDetails?: string[];
  category: ObjectCategory;
}

export interface DeadComponent {
  tickDied: number;
  killer: EntityId | null;
}

export interface InteractableComponent {
  interactionType: 'sleep' | 'examine' | 'talk' | 'door' | 'mission_board';
  label: string;
}

export interface DoorComponent {
  isOpen: boolean;
}

export interface LightSourceComponent {
  radius: number;
  activeAtNight: boolean;
}

export interface ProximityDialogueComponent {
  /** Pools of dialogue lines keyed by situation */
  lines: Record<string, string[]>;
  /** Last tick this NPC spoke (prevent spam) */
  lastSpokeTick: number;
  /** Minimum ticks between lines */
  cooldownTicks: number;
}

// Re-export CharacterSheet as a component type
export type { CharacterSheet } from './character.ts';
