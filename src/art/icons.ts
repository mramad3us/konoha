/**
 * Small pixel icons for in-world overlays: move intents, awareness marks.
 */

import { Pix } from './pix.ts';
import { hex, OUTLINE, type RGB } from './color.ts';
import type { Move } from '../ecs/components.ts';

const ICON: Record<string, string[]> = {
  strike: ['...11', '..111', '.111.', '111..', '.1...'],
  break: ['1...1', '11.11', '.111.', '11.11', '1...1'],
  guard: ['11111', '1...1', '1...1', '.1.1.', '..1..'],
  hidden: ['.111.', '1...1', '..11.', '.....', '..1..'],
  alert: ['..1..', '..1..', '..1..', '.....', '..1..'],
  question: ['.111.', '...1.', '..1..', '.....', '..1..'],
};

export const MOVE_COLOR: Record<Move, RGB> = {
  strike: hex('#ff6a4a'),
  break: hex('#f0b040'),
  guard: hex('#6ab0ff'),
};

export function iconPix(name: string, color: RGB, plate = true): Pix {
  const rows = ICON[name];
  const p = new Pix(9, 9);
  if (plate) p.rect(1, 1, 7, 7, [24, 20, 28], 220);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (rows[j][i] === '1') p.set(2 + i, 2 + j, color);
  p.outline(OUTLINE);
  return p;
}
