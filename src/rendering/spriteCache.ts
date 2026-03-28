import type { SpriteRegistration } from '../sprites/manifest.ts';

/**
 * Preloads SVG strings into OffscreenCanvas objects for fast canvas drawImage() calls.
 * Each SVG is rasterized once at its target pixel dimensions.
 */
class SpriteCache {
  private cache = new Map<string, OffscreenCanvas>();

  /** Preload all sprites from the manifest */
  async preload(registrations: SpriteRegistration[]): Promise<void> {
    const promises = registrations.map(reg => this.loadSprite(reg));
    await Promise.all(promises);
  }

  private loadSprite(reg: SpriteRegistration): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([reg.svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = new OffscreenCanvas(reg.width, reg.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error(`Failed to get 2D context for sprite ${reg.id}`));
          return;
        }

        // Disable image smoothing for crisp pixel art
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, reg.width, reg.height);

        this.cache.set(reg.id, canvas);
        URL.revokeObjectURL(url);
        resolve();
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load sprite: ${reg.id}`));
      };

      img.src = url;
    });
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
