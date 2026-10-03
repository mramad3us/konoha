/**
 * Ninpo system types — hand-sign jutsu requiring deliberate key sequences.
 *
 * Ninpo are distinct from passive ninjutsu (water walk, chakra sprint,
 * substitution) which require no signs. Ninpo consumes chakra, requires
 * knowing the sign sequence, and scales with ninjutsu level.
 */

/** AZERTY number-row keys that map to hand signs */
export type HandSignKey = '&' | 'é' | '"' | "'" | '(' | '§' | 'è' | '!' | 'ç' | 'à' | ')' | '-';

export interface HandSign {
  key: HandSignKey;
  name: string;          // English name (Monkey, Dragon, etc.)
  japaneseName: string;  // Display name (Saru, Tatsu, etc.)
}

/** All twelve hand signs mapped to their AZERTY keys */
export const HAND_SIGNS: Record<HandSignKey, HandSign> = {
  '&': { key: '&', name: 'Monkey', japaneseName: 'Saru' },
  'é': { key: 'é', name: 'Dragon', japaneseName: 'Tatsu' },
  '"': { key: '"', name: 'Rat', japaneseName: 'Ne' },
  "'": { key: "'", name: 'Bird', japaneseName: 'Tori' },
  '(': { key: '(', name: 'Snake', japaneseName: 'Mi' },
  '§': { key: '§', name: 'Ox', japaneseName: 'Ushi' },
  'è': { key: 'è', name: 'Dog', japaneseName: 'Inu' },
  '!': { key: '!', name: 'Horse', japaneseName: 'Uma' },
  'ç': { key: 'ç', name: 'Tiger', japaneseName: 'Tora' },
  'à': { key: 'à', name: 'Boar', japaneseName: 'I' },
  ')': { key: ')', name: 'Ram', japaneseName: 'Hitsuji' },
  '-': { key: '-', name: 'Hare', japaneseName: 'U' },
};

export type NinpoEffectType = 'vanish' | 'shadow_step';

export interface NinpoDefinition {
  id: string;
  name: string;               // "Ninpo: Vanish"
  description: string;
  sequence: HandSignKey[];
  requiredNinjutsu: number;
  category: 'stealth' | 'movement';
  /** Returns chakra cost at a given ninjutsu level */
  chakraCost: (ninjutsuLevel: number) => number;
  effectType: NinpoEffectType;
  castMessages: string[];
  failMessages: Record<string, string[]>;
}

/** Timer for timed ninpo effects (e.g. vanish expiry) */
export interface NinpoTimerComponent {
  ninpoId: string;
  expiresAtTick: number;  // -1 = permanent (until interaction)
}
