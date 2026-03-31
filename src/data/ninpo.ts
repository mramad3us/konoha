/**
 * Ninpo registry — hand-sign jutsu definitions and sequence matcher.
 *
 * Each ninpo is a sequence of hand signs on the AZERTY number row.
 * A trie structure enables real-time prefix matching as the player signs.
 */

import type { HandSignKey, NinpoDefinition } from '../types/ninpo.ts';
import { HAND_SIGNS } from '../types/ninpo.ts';

// ── Registry ──

export const NINPO_REGISTRY: NinpoDefinition[] = [
  {
    id: 'vanish',
    name: 'Ninpo: Vanish',
    description: 'Conceal your presence entirely. Higher mastery extends the duration.',
    sequence: ['&', '-', 'é', ')', '"', 'à'],
    requiredNinjutsu: 5,
    category: 'stealth',
    chakraCost: (nin) => {
      if (nin >= 50) return 5;
      if (nin >= 30) return 10;
      if (nin >= 10) return 15;
      return 20;
    },
    effectType: 'vanish',
    castMessages: [
      '{caster} completes the signs — their form shimmers and fades into nothing.',
      'The final seal locks. {caster} dissolves like morning mist.',
      '{caster}\'s presence vanishes completely. Only silence remains.',
      'A ripple in the air, and {caster} is gone — as if they were never there.',
      'The signs flow like water. {caster} becomes one with the shadows.',
    ],
    failMessages: {
      no_chakra: [
        'Your chakra falters on the final sign — the jutsu dissolves.',
        'Not enough chakra. The concealment technique slips away.',
        'The signs are correct, but your chakra reserves are empty.',
      ],
      not_learned: [
        'You don\'t know this sign sequence.',
        'The technique is beyond your current training.',
      ],
    },
  },
  {
    id: 'shadow_step',
    name: 'Ninpo: Shadow Step',
    description: 'Flicker to a visible location in an instant. Range improves with mastery.',
    sequence: ['é', ')', '&', '-', '"', 'à'],
    requiredNinjutsu: 10,
    category: 'movement',
    chakraCost: (nin) => {
      if (nin >= 50) return 8;
      if (nin >= 30) return 15;
      return 25;
    },
    effectType: 'shadow_step',
    castMessages: [
      '{caster} blurs — and reappears across the field in an instant.',
      'A flicker of displaced air. {caster} is already somewhere else.',
      '{caster} vanishes mid-step and materializes at the target location.',
      'The body flicker is instantaneous — {caster} was here, now they\'re there.',
      'Between one heartbeat and the next, {caster} crosses the distance.',
    ],
    failMessages: {
      no_chakra: [
        'Your body flickers but snaps back — not enough chakra to sustain it.',
        'The Shadow Step falters. Your chakra cannot carry you.',
        'You feel the pull of the technique, but your reserves give out.',
      ],
      not_learned: [
        'You don\'t know this sign sequence.',
        'That technique requires deeper ninjutsu training.',
      ],
    },
  },
];

// ── Hand Sign Key Set ──

const HAND_SIGN_KEY_SET = new Set<string>(Object.keys(HAND_SIGNS));

export function isHandSignKey(key: string): key is HandSignKey {
  return HAND_SIGN_KEY_SET.has(key);
}

// ── Queries ──

export function getAvailableNinpo(ninjutsuLevel: number): NinpoDefinition[] {
  return NINPO_REGISTRY.filter(n => ninjutsuLevel >= n.requiredNinjutsu);
}

export function getNextNinpo(ninjutsuLevel: number): NinpoDefinition | null {
  return NINPO_REGISTRY.find(n => ninjutsuLevel < n.requiredNinjutsu) ?? null;
}

// ── Sign Speed ──

/** Returns subticks per hand sign based on ninjutsu level */
export function getSignSpeedSubticks(ninjutsuLevel: number): number {
  if (ninjutsuLevel >= 50) return 1;   // 0.5s
  if (ninjutsuLevel >= 30) return 2;   // 1.0s
  if (ninjutsuLevel >= 10) return 3;   // 1.5s
  return 4;                             // 2.0s
}

// ── Shadow Step Range ──

/** Returns max teleport range in tiles based on ninjutsu level */
export function getShadowStepRange(ninjutsuLevel: number): number {
  if (ninjutsuLevel >= 50) return 10;
  if (ninjutsuLevel < 10) return 0;
  // Linear interpolation: level 10 → 3, level 50 → 10
  return 3 + Math.floor((ninjutsuLevel - 10) * 7 / 40);
}

// ── Vanish Duration ──

/** Returns vanish duration in game-seconds. -1 = permanent (until interaction) */
export function getVanishDuration(ninjutsuLevel: number): number {
  if (ninjutsuLevel >= 50) return -1;        // Permanent
  if (ninjutsuLevel >= 30) return 3600;      // 1 hour
  return 60;                                  // 1 minute
}

// ── Trie Prefix Matcher ──

interface TrieNode {
  children: Map<HandSignKey, TrieNode>;
  ninpo: NinpoDefinition | null;  // non-null if this node completes a sequence
}

function buildTrie(): TrieNode {
  const root: TrieNode = { children: new Map(), ninpo: null };
  for (const ninpo of NINPO_REGISTRY) {
    let node = root;
    for (const sign of ninpo.sequence) {
      let child = node.children.get(sign);
      if (!child) {
        child = { children: new Map(), ninpo: null };
        node.children.set(sign, child);
      }
      node = child;
    }
    node.ninpo = ninpo;
  }
  return root;
}

const TRIE_ROOT = buildTrie();

export type NinpoMatchResult =
  | { status: 'partial' }
  | { status: 'match'; ninpo: NinpoDefinition }
  | { status: 'invalid' };

/**
 * Check if a sequence of signs matches any known ninpo.
 * Walks the trie and returns:
 * - 'partial': valid prefix, more signs needed
 * - 'match': exact technique found (regardless of level — caller checks)
 * - 'invalid': no technique starts with this prefix
 */
export function matchNinpoSequence(signs: HandSignKey[]): NinpoMatchResult {
  let node = TRIE_ROOT;
  for (const sign of signs) {
    const child = node.children.get(sign);
    if (!child) return { status: 'invalid' };
    node = child;
  }
  if (node.ninpo) return { status: 'match', ninpo: node.ninpo };
  return { status: 'partial' };
}
