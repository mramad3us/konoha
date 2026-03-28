import type { MovementStance } from './ecs.ts';

export type GameAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'wait' }
  | { type: 'changeStance'; stance: MovementStance }
  | { type: 'toggleKeybindings' }
  | { type: 'toggleCharacterSheet' };

/** Log entry categories for color-coding */
export type LogCategory = 'combat' | 'damage' | 'info' | 'system' | 'movement';

export interface GameLogEntry {
  tick: number;
  text: string;
  category: LogCategory;
}
