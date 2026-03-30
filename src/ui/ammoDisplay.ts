import { createElement } from '../utils/dom.ts';
import { spriteCache } from '../rendering/spriteCache.ts';
import type { ThrownAmmoComponent, ThrownWeaponType } from '../types/throwing.ts';
import { MAX_THROWN_AMMO } from '../core/constants.ts';

/**
 * Ammo display HUD component — shows selected weapon type with pixel art
 * and current ammo counts for both kunai and shuriken.
 */
export class AmmoDisplay {
  readonly element: HTMLElement;
  private kunaiCanvas: HTMLCanvasElement;
  private shurikenCanvas: HTMLCanvasElement;
  private kunaiCount: HTMLElement;
  private shurikenCount: HTMLElement;
  private kunaiRow: HTMLElement;
  private shurikenRow: HTMLElement;
  private spritesDrawn = false;

  constructor() {
    this.element = createElement('div', { className: 'hud-ammo' });

    const title = createElement('div', { className: 'hud-ammo__title', text: '// Thrown' });
    this.element.appendChild(title);

    // Kunai row
    this.kunaiRow = createElement('div', { className: 'hud-ammo__row' });
    this.kunaiCanvas = document.createElement('canvas');
    this.kunaiCanvas.width = 24;
    this.kunaiCanvas.height = 24;
    this.kunaiCanvas.className = 'hud-ammo__sprite';
    this.kunaiRow.appendChild(this.kunaiCanvas);

    const kunaiLabel = createElement('span', { className: 'hud-ammo__label', text: 'KUN' });
    this.kunaiRow.appendChild(kunaiLabel);

    this.kunaiCount = createElement('span', { className: 'hud-ammo__count', text: `0/${MAX_THROWN_AMMO}` });
    this.kunaiRow.appendChild(this.kunaiCount);

    this.element.appendChild(this.kunaiRow);

    // Shuriken row
    this.shurikenRow = createElement('div', { className: 'hud-ammo__row' });
    this.shurikenCanvas = document.createElement('canvas');
    this.shurikenCanvas.width = 24;
    this.shurikenCanvas.height = 24;
    this.shurikenCanvas.className = 'hud-ammo__sprite';
    this.shurikenRow.appendChild(this.shurikenCanvas);

    const shurikenLabel = createElement('span', { className: 'hud-ammo__label', text: 'SHU' });
    this.shurikenRow.appendChild(shurikenLabel);

    this.shurikenCount = createElement('span', { className: 'hud-ammo__count', text: `0/${MAX_THROWN_AMMO}` });
    this.shurikenRow.appendChild(this.shurikenCount);

    this.element.appendChild(this.shurikenRow);
  }

  /** Draw sprite art from cache (called once sprites are loaded) */
  private drawSprites(): void {
    const kunaiSprite = spriteCache.get('kunai_e');
    if (kunaiSprite) {
      const ctx = this.kunaiCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 24, 24);
        ctx.drawImage(kunaiSprite, 0, 0, 24, 24);
      }
    }

    const shurikenSprite = spriteCache.get('shuriken_e');
    if (shurikenSprite) {
      const ctx = this.shurikenCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 24, 24);
        ctx.drawImage(shurikenSprite, 0, 0, 24, 24);
      }
    }

    this.spritesDrawn = true;
  }

  /** Update ammo counts and highlight selected weapon */
  update(ammo: ThrownAmmoComponent | undefined, selectedWeapon: ThrownWeaponType, throwingMode: boolean): void {
    if (!this.spritesDrawn) {
      this.drawSprites();
    }

    const kunai = ammo?.kunai ?? 0;
    const shuriken = ammo?.shuriken ?? 0;

    this.kunaiCount.textContent = `${kunai}/${MAX_THROWN_AMMO}`;
    this.shurikenCount.textContent = `${shuriken}/${MAX_THROWN_AMMO}`;

    // Dim when empty
    this.kunaiRow.classList.toggle('hud-ammo__row--empty', kunai <= 0);
    this.shurikenRow.classList.toggle('hud-ammo__row--empty', shuriken <= 0);

    // Highlight selected weapon in throwing mode
    this.kunaiRow.classList.toggle('hud-ammo__row--selected', throwingMode && selectedWeapon === 'kunai');
    this.shurikenRow.classList.toggle('hud-ammo__row--selected', throwingMode && selectedWeapon === 'shuriken');
  }
}
