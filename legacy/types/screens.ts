export type ScreenId = 'landing' | 'newGame' | 'loadGame' | 'settings' | 'game';

export interface ScreenTransition {
  from: ScreenId | null;
  to: ScreenId;
  direction: 'forward' | 'back';
}
