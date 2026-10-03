/**
 * Lazily rasterized sprite cache. Art functions produce Pix buffers; the atlas turns them into
 * canvases once and keeps dim (fog), flash (hit) and mirrored variants.
 */

import type { Appearance } from '../ecs/components.ts';
import { drawCharacter, appearanceKey, type Pose } from '../art/characters.ts';
import { drawProp } from '../art/props.ts';
import { renderText } from '../art/font.ts';
import type { ArtSprite } from '../art/draw.ts';
import type { Pix } from '../art/pix.ts';
import type { RGB } from '../art/color.ts';

export interface Frame { cv: OffscreenCanvas; ax: number; ay: number; w: number; h: number }

export type Variant = 'normal' | 'dim' | 'flash' | 'ghost';

function flip(p: Pix): Pix {
  const out = p.tinted([255, 255, 255]);
  const w = p.w;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < w; x++) {
    const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
    for (let k = 0; k < 4; k++) out.data[a + k] = p.data[b + k];
  }
  return out;
}

function variantOf(p: Pix, v: Variant): Pix {
  switch (v) {
    case 'normal': return p;
    case 'dim': return p.tinted([120, 125, 150]);
    case 'flash': return p.silhouette([255, 255, 255]);
    case 'ghost': return p.tinted([150, 170, 230], [10, 14, 40]);
  }
}

class Atlas {
  private cache = new Map<string, Frame>();
  private art = new Map<string, ArtSprite>();

  private frame(key: string, make: () => ArtSprite, mirror: boolean, v: Variant): Frame {
    const full = `${key}#${mirror ? 1 : 0}#${v}`;
    let f = this.cache.get(full);
    if (f) return f;
    let base = this.art.get(key);
    if (!base) { base = make(); this.art.set(key, base); }
    let pix = base.pix;
    if (mirror) pix = flip(pix);
    pix = variantOf(pix, v);
    const ax = mirror ? base.pix.w - 1 - base.ax : base.ax;
    f = { cv: pix.toCanvas(), ax, ay: base.ay, w: pix.w, h: pix.h };
    this.cache.set(full, f);
    return f;
  }

  character(a: Appearance, pose: Pose, back: boolean, mirror: boolean, v: Variant = 'normal'): Frame {
    const key = `c:${appearanceKey(a)}:${pose}:${back ? 'b' : 'f'}`;
    return this.frame(key, () => drawCharacter(a, pose, back), mirror, v);
  }

  prop(art: string, variant: number, mask: number, anim: number, v: Variant = 'normal'): Frame {
    const key = `p:${art}:${variant}:${mask}:${anim}`;
    return this.frame(key, () => drawProp(art, variant, mask, anim), false, v);
  }

  text(text: string, color: RGB): Frame {
    const key = `t:${text}:${color.join(',')}`;
    return this.frame(key, () => {
      const pix = renderText(text, color);
      return { pix, ax: Math.floor(pix.w / 2), ay: pix.h };
    }, false, 'normal');
  }

  custom(key: string, make: () => ArtSprite, v: Variant = 'normal', mirror = false): Frame {
    return this.frame(`x:${key}`, make, mirror, v);
  }

  get size(): number {
    return this.cache.size;
  }
}

export const atlas = new Atlas();
