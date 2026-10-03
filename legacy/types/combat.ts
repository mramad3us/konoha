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
  isCritical: boolean;
  conditionApplied: CombatCondition | null;
}

// ── TEMPO ──

export interface TempoState {
  current: number;
  max: number;  // = floor(taijutsuSkill / 10), min 1
}

/** Calculate max tempo slots from combat skill (taijutsu for shinobi).
 *  First bead unlocks at skill 5, then one more every 10 points. */
export function maxTempoSlots(combatSkill: number): number {
  if (combatSkill < 5) return 0;
  return 1 + Math.floor((combatSkill - 5) / 10);
}

/** Calculate starting tempo beads from skill difference.
 *  1 prefilled bead per 10 points of skill advantage.
 *  Guaranteed 1 bead when opponent has no tempo capacity at all. */
export function startingTempo(ownSkill: number, opponentSkill: number): number {
  const ownMax = maxTempoSlots(ownSkill);
  if (ownMax <= 0) return 0;

  const diff = ownSkill - opponentSkill;
  const fromDiff = diff > 0 ? Math.floor(diff / 10) : 0;

  // Guarantee at least 1 starting bead when opponent has no tempo capacity
  const opponentMax = maxTempoSlots(opponentSkill);
  const minBeads = opponentMax === 0 ? 1 : 0;

  return Math.min(ownMax, Math.max(fromDiff, minBeads));
}

// ── DAMAGE ──

/**
 * Calculate base damage for a clean hit.
 * Taijutsu × 0.5 + PHY, with ±20% variance.
 */
export function calculateDamage(taijutsu: number, phy: number): number {
  const base = (taijutsu * 0.5 + phy) * 0.5;
  const variance = 0.8 + Math.random() * 0.4;
  return Math.max(1, Math.round(base * variance));
}

/** Threshold for a blow strong enough to destroy a training dummy */
export const DUMMY_DESTROY_THRESHOLD = 80;

// ── COMBAT ENGAGEMENT STATE ──
// Tracks an ongoing melee exchange between two entities

export interface CombatEngagement {
  entityA: number;
  entityB: number;
  tempoA: TempoState;
  tempoB: TempoState;
  conditionA: ConditionState;
  conditionB: ConditionState;
  round: number;
  nextRoundTick: number;
  /** When the player is in melee range, this is the pending NPC move (hidden) */
  pendingNpcMove: CombatMove | null;
}

// ── KEY MAPPING ──

// ── CONDITIONS ──

export type CombatCondition = 'down' | 'stunned' | 'bleeding';

/**
 * Down: next pass, opponent acts as if they have a free bead
 *   (if they already have one, the clash won't consume it)
 * Stunned: prevents action entirely, any attack is a free hit
 */
export interface ConditionState {
  condition: CombatCondition | null;
  turnsRemaining: number;
}

// ── CRITICAL HITS ──

/**
 * Calculate crit chance: 5% base + skill difference as percentage.
 * Only on clean hits. Dummies are immune.
 */
export function critChance(attackerSkill: number, defenderSkill: number): number {
  const diff = Math.max(0, attackerSkill - defenderSkill);
  return 0.05 + diff / 100;
}

export const COMBAT_KEYS = new Set<string>(['a', 'z', 'e', 'q', 's', 'd']);

export function isCombatKey(key: string): key is CombatMove {
  return COMBAT_KEYS.has(key);
}
