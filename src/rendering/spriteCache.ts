import type { SpriteRegistration } from '../sprites/manifest.ts';
import { rasterizePattern, rasterizeWithOutline } from '../sprites/pixelPatterns.ts';

/**
 * Preloads pixel-pattern sprites into OffscreenCanvas objects
 * for fast canvas drawImage() calls.
 *
 * Patterns are rasterized via fillRect — each pattern pixel becomes
 * a block of screen pixels. Zero anti-aliasing, pure crisp edges.
 */
class SpriteCache {
  private cache = new Map<string, OffscreenCanvas>();

  /** Preload all sprites from the manifest */
  async preload(registrations: SpriteRegistration[]): Promise<void> {
    for (const reg of registrations) {
      const canvas = reg.outline
        ? rasterizeWithOutline(reg.pattern, reg.displayWidth, reg.displayHeight)
        : rasterizePattern(reg.pattern, reg.displayWidth, reg.displayHeight);
      this.cache.set(reg.id, canvas);
    }
  }

  /** Get a preloaded sprite canvas */
  get(spriteId: string): OffscreenCanvas | null {
    return this.cache.get(spriteId) ?? null;
  }

  /** Check if a sprite is loaded */
  has(spriteId: string): boolean {
    return this.cache.has(spriteId);
  }

  /** Get total loaded sprite count */
  get size(): number {
    return this.cache.size;
  }
}

export const spriteCache = new SpriteCache();
