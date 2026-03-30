import type { GameAction } from '../types/actions.ts';

/** Map keyboard keys to game actions */
const KEY_MAP: Record<string, GameAction> = {
  // Cardinal movement (vi-keys)
  'h': { type: 'move', dx: -1, dy:  0 },
  'j': { type: 'move', dx:  0, dy:  1 },
  'k': { type: 'move', dx:  0, dy: -1 },
  'l': { type: 'move', dx:  1, dy:  0 },

  // Diagonal movement
  'y': { type: 'move', dx: -1, dy: -1 },
  'u': { type: 'move', dx:  1, dy: -1 },
  'b': { type: 'move', dx: -1, dy:  1 },
  'n': { type: 'move', dx:  1, dy:  1 },

  // Wait
  '.': { type: 'wait' },

  // Stance speed — ',' faster, ';' slower (no loop)
  ',': { type: 'stanceFaster' },
  ';': { type: 'stanceSlower' },

  // UI toggles
  '?': { type: 'toggleKeybindings' },
  'c': { type: 'toggleCharacterSheet' },
  'f': { type: 'interact' },
};

/** Resolve a key press to a GameAction, or null if not a game key */
export function resolveAction(key: string): GameAction | null {
  return KEY_MAP[key] ?? null;
}

/** Set of keys that should prevent default browser behavior */
export const GAME_KEYS = new Set(Object.keys(KEY_MAP));

/** Jutsu combat keys — checked separately from regular combat keys */
export const JUTSU_COMBAT_KEYS = new Set(['@']);
