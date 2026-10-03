/**
 * Component types. `COMPONENT_KEYS` is the single registry: Level storage, entity destruction
 * and serialization all iterate it, so a new component is one entry here plus its type.
 */

import type { Dir8, Vec } from '../core/geometry.ts';

export type EntityId = number;

// ── Domain enums ──

export type Attr = 'body' | 'chakra' | 'mind';
export type Skill = 'taijutsu' | 'bukijutsu' | 'ninjutsu' | 'stealth' | 'medicine';
export const ATTRS: readonly Attr[] = ['body', 'chakra', 'mind'];
export const SKILLS: readonly Skill[] = ['taijutsu', 'bukijutsu', 'ninjutsu', 'stealth', 'medicine'];

export type Rank = 'civilian' | 'academy' | 'genin' | 'chunin' | 'jonin' | 'anbu' | 'kage';
export const RANK_ORDER: readonly Rank[] = ['civilian', 'academy', 'genin', 'chunin', 'jonin', 'anbu', 'kage'];

export type Faction = 'leaf' | 'civilian' | 'bandit' | 'rogue' | 'neutral';
export type Move = 'strike' | 'break' | 'guard';
export type Stance = 'walk' | 'run' | 'sneak' | 'dash';
export type Reveal = 'clear' | 'partial' | 'hidden';
export type AwareState = 'idle' | 'suspicious' | 'alert' | 'searching';
export type ItemKind = 'kunai' | 'shuriken' | 'bandage' | 'soldier_pill';
export type AiKind =
  | 'player' | 'villager' | 'guard' | 'bandit' | 'ninja' | 'squad' | 'client' | 'dummy' | 'examiner';

// ── Appearance (character paper doll, fully data-driven so it serializes) ──

export interface Appearance {
  frame: 'm' | 'f';
  skin: number;                 // index into skin palette
  hair: string;                 // hair style key
  hairColor: string;            // hex
  eyes: string;                 // hex
  top: string;                  // hex — shirt/jacket
  bottom: string;               // hex — trousers/skirt
  accent: string;               // hex — belt, sash, wraps
  headband: 'leaf' | 'slashed' | 'plain' | 'none';
  headbandColor: string;        // cloth hex
  vest?: 'chunin' | null;
  mask?: 'anbu' | 'cloth' | null;
  hat?: 'straw' | 'kage' | null;
}

// ── Components ──

export interface Position { x: number; y: number; facing: Dir8 }
export interface Name { name: string; title?: string; unique?: boolean }
export interface Sprite { art: string; /** Only visible within this many tiles of the player (hidden items). */ reveal?: number }
export interface Blocker { move: boolean; sight: boolean }
export interface FactionC { id: Faction }

export interface Actor {
  ai: AiKind;
  stance: Stance;
  /** Multiplier on action durations (lower = faster). */
  speed: number;
}

export interface Vitals {
  hp: number; hpMax: number;
  sta: number; staMax: number;
  chakra: number; chakraMax: number;
  /** Tick of last stamina exertion (regen waits after it). */
  exertTick: number;
}

export interface Sheet {
  attrs: Record<Attr, number>;
  skills: Record<Skill, number>;
  rank: Rank;
  /** Technique ids known (sign sequences learned). */
  techniques: string[];
}

export interface Combat {
  tempo: number;
  staggered: boolean;
  /** Last moves this entity made (most recent last), used by opponents to read habits. */
  history: Move[];
  /** Committed move for the next exchange, and against whom. */
  intent: Move | null;
  intentTarget: EntityId | null;
  /** What the player perceives of this intent. */
  reveal: Reveal;
  revealAlt: Move | null;
  /** Fights with a blade (bleeding, kill chance). */
  lethal: boolean;
  /** Move preference weights (NPCs). */
  style: Record<Move, number> | null;
}

export interface Aware {
  level: number;
  state: AwareState;
  lastKnown: Vec | null;
  lastSeenTick: number;
  target: EntityId | null;
  /** Bodies of allies this NPC has already reacted to. */
  bodies: EntityId[];
}

export interface Brain {
  mode: string;
  /** Mode to return to after a temporary one (e.g. coming back outside). */
  baseMode?: string;
  home: Vec;
  patrol: Vec[];
  patrolIdx: number;
  path: Vec[] | null;
  goal: Vec | null;
  waitUntil: number;
  leader: EntityId | null;
  /** Daily schedule for villagers: where to be between hours. */
  schedule: Array<{ from: number; to: number; at: Vec; activity: string }> | null;
  sleeping: boolean;
  /** Courage 0..1: below this HP fraction the NPC tries to flee. */
  flee: number;
  barkTick: number;
}

export interface Ko { since: number; wake: number }
export interface Dead { tick: number; killer: EntityId | null; cause: string }
export interface Bleed { rate: number; since: number }
export interface Invisible { until: number; power: number }
export interface Restrained { by: EntityId }
export interface Carried { by: EntityId }
export interface Carrying { target: EntityId }
export interface Signing { signs: number[]; nextTick: number }

export interface Door { open: boolean; locked: boolean }
export interface Item { kind: ItemKind; count: number }
export interface Inventory { items: Partial<Record<ItemKind, number>>; ryo: number; searched?: boolean }

export type InteractKind = 'facility' | 'talk' | 'examine' | 'collect' | 'deliver';
export interface Interact { kind: InteractKind; label: string; facility?: string; ref?: string }

export interface SquadTag { rosterId: string; personality: string }
export interface MissionTag { role: 'leader' | 'enemy' | 'client' | 'objective' | 'recipient' }
export interface Talk { lines: string[]; lastTick: number; /** Next line index for conversations. */ next?: number }
export interface Light { radius: number }
export interface Structure { w: number; d: number; style: string; label?: string }
export interface Duel { opponent: EntityId }

export interface Components {
  pos: Position;
  name: Name;
  sprite: Sprite;
  appearance: Appearance;
  blocker: Blocker;
  faction: FactionC;
  actor: Actor;
  vitals: Vitals;
  sheet: Sheet;
  combat: Combat;
  aware: Aware;
  brain: Brain;
  ko: Ko;
  dead: Dead;
  bleed: Bleed;
  invisible: Invisible;
  restrained: Restrained;
  carried: Carried;
  carrying: Carrying;
  signing: Signing;
  door: Door;
  item: Item;
  inventory: Inventory;
  interact: Interact;
  squad: SquadTag;
  mission: MissionTag;
  talk: Talk;
  light: Light;
  structure: Structure;
  duel: Duel;
  dummy: Record<string, never>;
}

export type ComponentKey = keyof Components;

export const COMPONENT_KEYS = [
  'pos', 'name', 'sprite', 'appearance', 'blocker', 'faction', 'actor', 'vitals', 'sheet',
  'combat', 'aware', 'brain', 'ko', 'dead', 'bleed', 'invisible', 'restrained', 'carried',
  'carrying', 'signing', 'door', 'item', 'inventory', 'interact', 'squad', 'mission', 'talk',
  'light', 'structure', 'duel', 'dummy',
] as const satisfies readonly ComponentKey[];

// Compile-time guarantee that the registry lists every component.
type MissingKeys = Exclude<ComponentKey, typeof COMPONENT_KEYS[number]>;
const _registryComplete: MissingKeys extends never ? true : MissingKeys = true;
void _registryComplete;

/** Components on the player entity that are shared by reference with the player profile. */
export const PLAYER_LINKED: readonly ComponentKey[] = ['sheet', 'vitals', 'inventory', 'appearance', 'name'];

export type Stores = { [K in ComponentKey]: Map<EntityId, Components[K]> };
