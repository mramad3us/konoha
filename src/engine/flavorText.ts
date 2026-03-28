/**
 * Scalable flavor text generation for combat and other systems.
 *
 * Design: Each outcome type has a pool of template strings.
 * Templates use {attacker}, {defender}, {damage} placeholders.
 * Pools are filtered/weighted by context (skill level, PHY, etc.)
 * to produce text that scales in epicness.
 *
 * Skill tiers for flavor selection:
 *  - low:    0-30   (novice, clumsy, uncertain)
 *  - mid:    31-65  (competent, solid, trained)
 *  - high:   66-100 (masterful, devastating, effortless)
 *
 * When both combatants are high-skill, text becomes "clash of titans".
 * When a high-skill fights low-skill, it reads as effortless dominance.
 */

import type { CombatOutcome, CombatOutcomeType } from '../types/combat.ts';

// ── SKILL TIER CLASSIFICATION ──

type SkillTier = 'low' | 'mid' | 'high';

function getSkillTier(skill: number): SkillTier {
  if (skill < 31) return 'low';
  if (skill < 66) return 'mid';
  return 'high';
}

type MatchupType = 'low_v_low' | 'low_v_mid' | 'low_v_high'
  | 'mid_v_low' | 'mid_v_mid' | 'mid_v_high'
  | 'high_v_low' | 'high_v_mid' | 'high_v_high';

function getMatchup(attackerSkill: number, defenderSkill: number): MatchupType {
  return `${getSkillTier(attackerSkill)}_v_${getSkillTier(defenderSkill)}` as MatchupType;
}

// ── TEMPLATE POOLS ──
// Each pool is keyed by outcome type.
// Templates are arrays — one picked at random.
// Optional matchup-specific overrides for richer narration.

interface FlavorPool {
  default: string[];
  matchups?: Partial<Record<MatchupType, string[]>>;
}

const FLAVOR_POOLS: Record<CombatOutcomeType, FlavorPool> = {

  // ── PERFECT PARRY ──
  perfect_parry: {
    default: [
      '{defender} reads the move perfectly and deflects with ease.',
      '{defender} catches {attacker}\'s strike mid-swing, turning it aside cleanly.',
      'A textbook counter — {defender} redirects the blow harmlessly.',
      '{defender} sidesteps and parries in one fluid motion.',
      '{attacker}\'s fist meets nothing but air as {defender} pivots away.',
    ],
    matchups: {
      high_v_low: [
        '{defender} barely glances at the incoming strike, brushing it aside like a leaf.',
        'Without even shifting stance, {defender} deflects the clumsy attempt.',
        '{attacker} swings wildly — {defender} simply isn\'t there.',
      ],
      high_v_high: [
        'Steel meets steel — {defender} reads the feint within the feint and counters flawlessly.',
        'A masterful exchange — {defender}\'s counter is so precise it draws gasps.',
        'Their eyes lock — {defender} predicted the strike three moves ago.',
      ],
      low_v_low: [
        '{defender} stumbles backwards but somehow avoids the hit.',
        'More luck than skill — {defender} bumps into {attacker}\'s arm before the strike lands.',
        '{defender} flinches away just in time, arms raised clumsily.',
      ],
      low_v_high: [
        '{defender} barely manages to block, hands trembling from the impact.',
        'A desperate guard — {defender} catches the blow but staggers from the force.',
      ],
    },
  },

  // ── IMPERFECT BLOCK ──
  imperfect_block: {
    default: [
      '{attacker}\'s strike slips through {defender}\'s guard, landing a glancing blow. ({damage} dmg)',
      '{defender} blocks late — the hit grazes past the defense. ({damage} dmg)',
      'Not quite fast enough — {attacker} clips {defender} despite the block. ({damage} dmg)',
      '{defender}\'s stance breaks as {attacker}\'s strike slides through. ({damage} dmg)',
      'A partial block — {defender} absorbs some of the impact but not all. ({damage} dmg)',
    ],
    matchups: {
      high_v_low: [
        '{attacker}\'s strike cuts through {defender}\'s weak guard like paper. ({damage} dmg)',
        '{defender} raises a defense but {attacker} finds the gap effortlessly. ({damage} dmg)',
      ],
      high_v_high: [
        'A near-perfect defense crumbles under {attacker}\'s relentless precision. ({damage} dmg)',
        '{defender}\'s guard holds for a heartbeat, then {attacker} finds the crack. ({damage} dmg)',
      ],
    },
  },

  // ── CLEAN HIT ──
  clean_hit: {
    default: [
      '{attacker} lands a solid strike on {defender}! ({damage} dmg)',
      '{attacker}\'s blow connects squarely — {defender} reels from the impact. ({damage} dmg)',
      'A clean hit — {attacker} drives a fist into {defender}. ({damage} dmg)',
      '{defender} takes the full force of {attacker}\'s attack. ({damage} dmg)',
      '{attacker} strikes true, catching {defender} off guard. ({damage} dmg)',
    ],
    matchups: {
      high_v_low: [
        '{attacker} delivers a devastating strike — {defender} never saw it coming. ({damage} dmg)',
        'With almost casual precision, {attacker} plants a blow that sends {defender} staggering. ({damage} dmg)',
        '{attacker} is already past {defender}\'s guard before the block even starts. ({damage} dmg)',
      ],
      high_v_high: [
        'In a flash of movement, {attacker} breaks through — a strike worthy of legends. ({damage} dmg)',
        '{attacker} finds the smallest opening and exploits it with lethal precision. ({damage} dmg)',
      ],
      low_v_low: [
        '{attacker} swings wide and connects — more by chance than design. ({damage} dmg)',
        'An ungraceful lunge connects — {defender} stumbles from the hit. ({damage} dmg)',
      ],
    },
  },

  // ── CLASH: STALEMATE ──
  clash_stalemate: {
    default: [
      'Both strike at once — their blows cancel out in a tangle of limbs.',
      'Fists collide mid-air, neither gaining an advantage.',
      'A simultaneous exchange — both fighters push off and reset.',
      'Their attacks mirror each other perfectly, resulting in a deadlock.',
      'Strike meets strike — the impact sends both combatants back a step.',
    ],
    matchups: {
      high_v_high: [
        'Two masters strike in perfect synchrony — the shockwave kicks up dust.',
        'Their fists meet with a crack that echoes across the grounds. Neither yields.',
        'A clash of titans — for a frozen moment, they are perfectly matched.',
      ],
      low_v_low: [
        'Both swing wildly — somehow they cancel each other out.',
        'A messy exchange where neither manages to land anything clean.',
      ],
    },
  },

  // ── CLASH: TEMPO WIN ──
  clash_tempo_win: {
    default: [
      '{attacker} leverages superior positioning to strike first! ({damage} dmg)',
      'A split-second advantage — {attacker} lands the blow before {defender} can. ({damage} dmg)',
      '{attacker}\'s prior setup pays off — the strike lands clean. ({damage} dmg)',
      'Riding momentum from earlier, {attacker} overwhelms {defender}. ({damage} dmg)',
    ],
    matchups: {
      high_v_high: [
        '{attacker} converts accumulated advantage into a devastating counter. ({damage} dmg)',
        'The tempo shift proves decisive — {attacker} was three moves ahead. ({damage} dmg)',
      ],
    },
  },

  // ── CLASH: RNG ──
  clash_rng: {
    default: [
      '{attacker}\'s technique proves superior in the exchange! ({damage} dmg)',
      'In a chaotic scramble, {attacker} comes out on top. ({damage} dmg)',
      'Both attack — {attacker}\'s strike finds its mark first. ({damage} dmg)',
      '{attacker} reads the opening mid-exchange and exploits it. ({damage} dmg)',
      'A frantic exchange — {attacker} lands while {defender} whiffs. ({damage} dmg)',
    ],
    matchups: {
      high_v_low: [
        '{attacker}\'s training shows — the inferior technique crumbles. ({damage} dmg)',
        '{defender}\'s reckless attack leaves them wide open for {attacker}\'s counter. ({damage} dmg)',
      ],
      high_v_high: [
        'In a breathtaking exchange, {attacker}\'s timing proves fractionally sharper. ({damage} dmg)',
        'Both masters commit — but {attacker} reads the feint and strikes true. ({damage} dmg)',
      ],
    },
  },

  // ── TEMPO SAVE ──
  tempo_save: {
    default: [
      '{defender} burns momentum to narrowly evade — a shadow absorbs the blow!',
      '{defender} twists away at the last instant, spending hard-won advantage to survive.',
      'A substitution! {defender} vanishes and the strike hits empty air.',
      '{defender}\'s prior advantage allows a split-second escape.',
      'Just in time — {defender} spends tempo to slip past the attack.',
    ],
    matchups: {
      high_v_high: [
        '{defender} executes a perfect body flicker — the accumulated advantage barely saves them.',
        'A master\'s instinct kicks in — {defender} was already moving before the strike began.',
      ],
      low_v_low: [
        '{defender} stumbles sideways — pure reflex, aided by earlier positioning.',
        'Barely! {defender} trips out of the way, burning their advantage in the process.',
      ],
    },
  },

  // ── CIRCLING ──
  circling: {
    default: [
      'Both combatants circle warily, searching for an opening.',
      'Neither commits — they study each other\'s stance intently.',
      'A tense standoff. Eyes locked, feet shifting on the training ground.',
      'They feint and withdraw, neither willing to overcommit.',
      'Measured footwork — both maintain defensive postures.',
    ],
    matchups: {
      high_v_high: [
        'Two masters read each other\'s micro-movements, neither finding a gap.',
        'The air between them crackles with tension — a battle fought with eyes alone.',
      ],
      low_v_low: [
        'Both hesitate, unsure of what to do next.',
        'Nervous shuffling — neither has the confidence to strike first.',
      ],
    },
  },

  // ── MISSED ──
  missed: {
    default: [
      '{attacker}\'s strike goes wide, hitting nothing.',
      'A clumsy swing — {attacker} misses completely.',
      '{attacker} overextends and whiffs the attack.',
    ],
  },
};

// ── PUBLIC API ──

/**
 * Generate flavor text for a combat outcome.
 * Picks from the appropriate pool based on outcome type and skill matchup.
 */
export function generateCombatFlavor(
  outcome: CombatOutcome,
  attackerName: string,
  defenderName: string,
  attackerSkill: number,
  defenderSkill: number,
): string {
  const pool = FLAVOR_POOLS[outcome.type];
  if (!pool) return `${attackerName} and ${defenderName} exchange blows.`;

  const matchup = getMatchup(attackerSkill, defenderSkill);

  // Try matchup-specific pool first, then fall back to default
  let templates = pool.matchups?.[matchup];
  if (!templates || templates.length === 0) {
    templates = pool.default;
  }

  // Pick a random template
  const template = templates[Math.floor(Math.random() * templates.length)];

  // Replace placeholders
  return template
    .replace(/\{attacker\}/g, attackerName)
    .replace(/\{defender\}/g, defenderName)
    .replace(/\{damage\}/g, String(outcome.damage));
}

/**
 * Generate a technical combat summary (shown in parentheses after flavor text).
 */
export function generateCombatTechnical(outcome: CombatOutcome): string {
  const parts: string[] = [];

  if (outcome.damage > 0) {
    parts.push(`${outcome.damage} dmg`);
  }

  if (outcome.tempoChange.attacker !== 0) {
    const sign = outcome.tempoChange.attacker > 0 ? '+' : '';
    parts.push(`atk tempo ${sign}${outcome.tempoChange.attacker}`);
  }
  if (outcome.tempoChange.defender !== 0) {
    const sign = outcome.tempoChange.defender > 0 ? '+' : '';
    parts.push(`def tempo ${sign}${outcome.tempoChange.defender}`);
  }

  if (parts.length === 0) return '';
  return `(${parts.join(', ')})`;
}
