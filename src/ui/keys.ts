/**
 * Key bindings by physical key code (KeyboardEvent.code), so AZERTY and QWERTY share the same
 * positions: the combat row is Q W E on QWERTY and A Z E on AZERTY. Labels shown in the UI come
 * from the active layout when the browser exposes it.
 */

import type { ScreenDir } from '../core/geometry.ts';

export type Command =
  | { k: 'move'; dir: ScreenDir }
  | { k: 'wait' }
  | { k: 'rest' }
  | { k: 'strike' } | { k: 'break' } | { k: 'guard' }
  | { k: 'target' }
  | { k: 'run' } | { k: 'sneak' } | { k: 'dash' }
  | { k: 'interact' }
  | { k: 'throw' }
  | { k: 'kawarimi' }
  | { k: 'sign'; sign: number }
  | { k: 'lethal' }
  | { k: 'bandage' }
  | { k: 'squad' }
  | { k: 'profile' } | { k: 'journal' } | { k: 'inventory' } | { k: 'help' }
  | { k: 'confirm' } | { k: 'cancel' } | { k: 'cycle' }
  | { k: 'zoomIn' } | { k: 'zoomOut' };

type Binding = { codes: string[]; cmd: Command; label: string };

const SIGN_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];

export const BINDINGS: Binding[] = [
  { codes: ['ArrowUp', 'KeyK', 'Numpad8'], cmd: { k: 'move', dir: 'up' }, label: 'Move' },
  { codes: ['ArrowDown', 'KeyJ', 'Numpad2'], cmd: { k: 'move', dir: 'down' }, label: 'Move' },
  { codes: ['ArrowLeft', 'KeyH', 'Numpad4'], cmd: { k: 'move', dir: 'left' }, label: 'Move' },
  { codes: ['ArrowRight', 'KeyL', 'Numpad6'], cmd: { k: 'move', dir: 'right' }, label: 'Move' },
  { codes: ['KeyY', 'Numpad7'], cmd: { k: 'move', dir: 'upleft' }, label: 'Move' },
  { codes: ['KeyU', 'Numpad9'], cmd: { k: 'move', dir: 'upright' }, label: 'Move' },
  { codes: ['KeyB', 'Numpad1'], cmd: { k: 'move', dir: 'downleft' }, label: 'Move' },
  { codes: ['KeyN', 'Numpad3'], cmd: { k: 'move', dir: 'downright' }, label: 'Move' },
  { codes: ['Space', 'Period', 'Numpad5'], cmd: { k: 'wait' }, label: 'Wait' },
  { codes: ['KeyQ'], cmd: { k: 'strike' }, label: 'Strike' },
  { codes: ['KeyW'], cmd: { k: 'break' }, label: 'Break' },
  { codes: ['KeyE'], cmd: { k: 'guard' }, label: 'Guard' },
  { codes: ['Tab'], cmd: { k: 'target' }, label: 'Next target' },
  { codes: ['KeyR'], cmd: { k: 'run' }, label: 'Run' },
  { codes: ['KeyC'], cmd: { k: 'sneak' }, label: 'Sneak' },
  { codes: ['KeyD'], cmd: { k: 'dash' }, label: 'Chakra Dash' },
  { codes: ['KeyF', 'Enter', 'NumpadEnter'], cmd: { k: 'interact' }, label: 'Interact' },
  { codes: ['KeyT'], cmd: { k: 'throw' }, label: 'Throw' },
  { codes: ['KeyG'], cmd: { k: 'kawarimi' }, label: 'Kawarimi' },
  { codes: ['KeyX'], cmd: { k: 'lethal' }, label: 'Draw / sheathe kunai' },
  { codes: ['KeyV'], cmd: { k: 'bandage' }, label: 'Bandage' },
  { codes: ['KeyZ'], cmd: { k: 'squad' }, label: 'Squad orders' },
  { codes: ['KeyP'], cmd: { k: 'profile' }, label: 'Character' },
  { codes: ['KeyO'], cmd: { k: 'journal' }, label: 'Journal' },
  { codes: ['KeyI'], cmd: { k: 'inventory' }, label: 'Inventory' },
  { codes: ['Slash', 'F1'], cmd: { k: 'help' }, label: 'Controls' },
  { codes: ['PageUp', 'NumpadAdd'], cmd: { k: 'zoomIn' }, label: 'Zoom in' },
  { codes: ['PageDown', 'NumpadSubtract'], cmd: { k: 'zoomOut' }, label: 'Zoom out' },
  ...SIGN_CODES.map((code, i) => ({ codes: [code], cmd: { k: 'sign', sign: i } as Command, label: 'Hand sign' })),
];

const BY_CODE = new Map<string, Command>();
for (const b of BINDINGS) for (const c of b.codes) BY_CODE.set(c, b.cmd);

export function commandFor(e: KeyboardEvent): Command | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.code === 'Escape') return { k: 'cancel' };
  if (e.code === 'Space' && e.shiftKey) return { k: 'rest' };
  return BY_CODE.get(e.code) ?? null;
}

// ── Labels from the user's layout ──

const layout = new Map<string, string>();

export async function loadLayoutLabels(): Promise<void> {
  const kb = (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
  if (!kb?.getLayoutMap) return;
  try {
    const m = await kb.getLayoutMap();
    for (const [code, key] of m) layout.set(code, key);
  } catch {
    /* not available (insecure context, Firefox, Safari) — fall back to code names */
  }
}

/** Learn layout labels from real keypresses (fallback when getLayoutMap is unavailable). */
export function learnKey(e: KeyboardEvent): void {
  if (e.key.length === 1 && !layout.has(e.code)) layout.set(e.code, e.key);
}

const FRIENDLY: Record<string, string> = {
  Space: 'Space', Tab: 'Tab', Enter: 'Enter', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  PageUp: 'PgUp', PageDown: 'PgDn', Slash: '?',
};

export function keyLabel(code: string): string {
  if (FRIENDLY[code]) return FRIENDLY[code];
  const k = layout.get(code);
  if (k) return k.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}

export function labelFor(k: Command['k']): string {
  const b = BINDINGS.find(x => x.cmd.k === k);
  return b ? keyLabel(b.codes[0]) : '?';
}

export function signLabel(i: number): string {
  return keyLabel(SIGN_CODES[i]);
}
