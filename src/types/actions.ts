export type GameAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'wait' }
  | { type: 'cycleStance' }
  | { type: 'toggleKeybindings' }
  | { type: 'toggleCharacterSheet' }
  | { type: 'interact' };

/** Log entry categories for color-coding */
export type LogCategory =
  | 'hit_outgoing'    // You deal damage (aggressive, good)
  | 'miss_outgoing'   // You miss or get blocked (neutral-bad)
  | 'hit_incoming'    // You take damage (alert, danger)
  | 'miss_incoming'   // Enemy misses you / you parry (defensive, good)
  | 'combat_neutral'  // Stalemate, circling (neutral)
  | 'combat_tempo'    // Tempo gained/spent (tactical info)
  | 'info'            // General info
  | 'system'          // System messages
  | 'movement'        // Movement descriptions
  // Legacy compat
  | 'combat'
  | 'damage';

export interface GameLogEntry {
  tick: number;
  text: string;
  category: LogCategory;
}
