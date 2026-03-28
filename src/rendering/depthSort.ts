import type { RenderLayer } from '../types/ecs.ts';
import { LAYER_ORDER } from '../types/ecs.ts';

export interface DrawCommand {
  screenX: number;
  screenY: number;
  spriteId: string;
  depth: number;        // mapX + mapY for back-to-front ordering
  layer: RenderLayer;
  alpha: number;
  offsetY: number;
}

/** Sort draw commands back-to-front for correct isometric rendering */
export function sortDrawCommands(commands: DrawCommand[]): void {
  commands.sort((a, b) => {
    // Primary: depth (lower = further back = drawn first)
    if (a.depth !== b.depth) return a.depth - b.depth;
    // Secondary: layer order
    return LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer];
  });
}
