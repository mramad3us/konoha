/**
 * Floating text system — speech bubbles / combat callouts above NPC heads.
 * Follows the same pattern as particleSystem.ts: grid coords projected to screen.
 */

import { TILE_WIDTH, TILE_HEIGHT } from '../core/constants.ts';

export interface FloatingText {
  gridX: number;
  gridY: number;
  text: string;
  life: number;       // remaining life in seconds
  maxLife: number;
  color: string;       // CSS color
  offsetY: number;     // drifts upward over time (pixels)
  fontSize: number;
}

const texts: FloatingText[] = [];

/** Spawn floating text above a grid position */
export function spawnFloatingText(
  gridX: number,
  gridY: number,
  text: string,
  color: string = '#ffffff',
  duration: number = 1.8,
  fontSize: number = 11,
): void {
  // Don't pile up too many texts on the same tile — skip if 2+ already there
  let count = 0;
  for (const t of texts) {
    if (t.gridX === gridX && t.gridY === gridY) count++;
  }
  if (count >= 2) return;

  texts.push({
    gridX,
    gridY,
    text,
    life: duration,
    maxLife: duration,
    color,
    offsetY: 0,
    fontSize,
  });
}

/** Update all floating texts — call once per frame */
export function updateFloatingTexts(dt: number): void {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    if (t.life <= 0) {
      texts.splice(i, 1);
      continue;
    }
    // Drift upward at 18 px/s
    t.offsetY -= 18 * dt;
  }
}

/** Draw all floating texts on the canvas */
export function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  offset: { ox: number; oy: number },
): void {
  if (texts.length === 0) return;

  const halfTW = TILE_WIDTH / 2;
  const halfTH = TILE_HEIGHT / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  for (const t of texts) {
    const sx = (t.gridX - t.gridY) * halfTW + offset.ox + halfTW;
    const sy = (t.gridX + t.gridY) * halfTH + offset.oy + t.offsetY - 28; // above head

    const alpha = Math.min(1, t.life / (t.maxLife * 0.3)); // fade out in last 30%
    ctx.globalAlpha = Math.max(0, alpha);

    ctx.font = `bold ${t.fontSize}px monospace`;

    // Dark outline for readability
    ctx.fillStyle = '#000000';
    ctx.fillText(t.text, sx + 1, sy + 1);
    ctx.fillText(t.text, sx - 1, sy + 1);
    ctx.fillText(t.text, sx + 1, sy - 1);
    ctx.fillText(t.text, sx - 1, sy - 1);

    // Main text
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, sx, sy);
  }

  ctx.globalAlpha = 1.0;
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/** Check if any floating texts are active */
export function hasActiveFloatingTexts(): boolean {
  return texts.length > 0;
}
