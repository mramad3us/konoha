import type { GameAction } from '../types/actions.ts';
import type { MovementStance } from '../types/ecs.ts';

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

  // Stance changes
  '1': { type: 'changeStance', stance: 'sprint' as MovementStance },
  '2': { type: 'changeStance', stance: 'walk' as MovementStance },
  '3': { type: 'changeStance', stance: 'creep' as MovementStance },
  '4': { type: 'changeStance', stance: 'crawl' as MovementStance },

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
