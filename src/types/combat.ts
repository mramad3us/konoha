/**
 * Hand-to-hand combat system types.
 *
 * Combat is simultaneous blind pick (rock-paper-scissors style).
 * Both combatants choose a move, then both resolve at once.
 *
 * Keys (AZERTY): a/z/e = attack, q/s/d = defend
 * Mirror pairs: a↔q, z↔s, e↔d
 */

// ── COMBAT MOVES ──

export type AttackMove = 'a' | 'z' | 'e';
export type DefendMove = 'q' | 's' | 'd';
export type CombatMove = AttackMove | DefendMove;

export function isAttack(move: CombatMove): move is AttackMove {
  return move === 'a' || move === 'z' || move === 'e';
}

export function isDefend(move: CombatMove): move is DefendMove {
  return move === 'q' || move === 's' || move === 'd';
}

/** Mirror pairs: the perfect parry for each attack */
export const MIRROR_PAIRS: Record<AttackMove, DefendMove> = {
  'a': 'q',
  'z': 's',
  'e': 'd',
} as const;

/** Reverse lookup: which attack does this defense perfectly counter? */
export const COUNTER_PAIRS: Record<DefendMove, AttackMove> = {
  'q': 'a',
  's': 'z',
  'd': 'e',
} as const;

// ── COMBAT OUTCOME ──

export type CombatOutcomeType =
  | 'perfect_parry'        // Defender used mirror pair → earns tempo
  | 'imperfect_block'      // Defender used wrong block → half damage
  | 'clean_hit'            // Attacker hits, no defense → full damage
  | 'clash_stalemate'      // Both attack same key, no tempo diff → nothing
  | 'clash_tempo_win'      // Both attack same key, tempo advantage → winner hits
  | 'clash_rng'            // Both attack different keys → RNG decides
  | 'tempo_save'           // Hit would land but tempo auto-spent to dodge
  | 'circling'             // Both defend → nothing happens
  | 'missed'               // Attack missed (RNG at low skill)
  ;

export interface CombatOutcome {
  type: CombatOutcomeType;
  attackerId: number;        // who initiated / won
  defenderId: number;        // who received / lost
  damage: number;            // damage dealt (0 if blocked/missed)
  tempoChange: {
    attacker: number;        // +1 if earned, -1 if spent, 0 otherwise
    defender: number;
  };
  attackerMove: CombatMove;
  defenderMove: CombatMove;
}

// ── TEMPO ──

export interface TempoState {
  current: number;
  max: number;  // = floor(taijutsuSkill / 10), min 1
}

/** Calculate max tempo slots from combat skill (taijutsu for shinobi) */
export function maxTempoSlots(combatSkill: number): number {
  return Math.max(1, Math.floor(combatSkill / 10));
}

/** Calculate starting tempo beads from skill difference */
export function startingTempo(ownSkill: number, opponentSkill: number): number {
  const diff = ownSkill - opponentSkill;
  if (diff <= 0) return 0;
  return Math.floor(diff / 20);
}

// ── DAMAGE ──

/**
 * Calculate base damage for a clean hit.
 * Taijutsu primary (70%), PHY secondary (30%).
 */
export function calculateDamage(taijutsu: number, phy: number): number {
  const base = (taijutsu * 0.7 + phy * 0.3) / 10;
  // Min 1 damage, slight random variance ±20%
  const variance = 0.8 + Math.random() * 0.4;
  return Math.max(1, Math.round(base * variance));
}

// ── COMBAT ENGAGEMENT STATE ──
// Tracks an ongoing melee exchange between two entities

export interface CombatEngagement {
  entityA: number;
  entityB: number;
  tempoA: TempoState;
  tempoB: TempoState;
  round: number;
  /** When the player is in melee range, this is the pending NPC move (hidden) */
  pendingNpcMove: CombatMove | null;
}

// ── KEY MAPPING ──

export const COMBAT_KEYS = new Set<string>(['a', 'z', 'e', 'q', 's', 'd']);

export function isCombatKey(key: string): key is CombatMove {
  return COMBAT_KEYS.has(key);
}
