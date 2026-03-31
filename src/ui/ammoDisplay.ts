import { createElement } from '../utils/dom.ts';
import type { ThrownAmmoComponent, ThrownWeaponType } from '../types/throwing.ts';
import { MAX_THROWN_AMMO } from '../core/constants.ts';

/** Pixel art kunai icon — 12×12 SVG matching kill-intent style */
const KUNAI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" class="pixel-sprite">
  <rect x="5" y="0" width="2" height="1" fill="#d0d0d0"/>
  <rect x="5" y="1" width="2" height="1" fill="#b0b0b0"/>
  <rect x="4" y="2" width="4" height="1" fill="#a0a0a0"/>
  <rect x="5" y="3" width="2" height="1" fill="#808080"/>
  <rect x="4" y="4" width="4" height="1" fill="#8B4513"/>
  <rect x="5" y="5" width="2" height="1" fill="#1a1a1a"/>
  <rect x="5" y="6" width="2" height="1" fill="#b22234"/>
  <rect x="5" y="7" width="2" height="1" fill="#1a1a1a"/>
  <rect x="5" y="8" width="2" height="1" fill="#b22234"/>
  <rect x="4" y="9" width="4" height="1" fill="#555"/>
  <rect x="4" y="10" width="1" height="1" fill="#555"/>
  <rect x="7" y="10" width="1" height="1" fill="#555"/>
</svg>`;

/** Pixel art shuriken icon — 12×12 SVG */
const SHURIKEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" class="pixel-sprite">
  <rect x="5" y="1" width="2" height="1" fill="#a0a5b0"/>
  <rect x="5" y="2" width="2" height="1" fill="#c0c5d0"/>
  <rect x="4" y="3" width="1" height="1" fill="#9095a0"/>
  <rect x="5" y="3" width="2" height="1" fill="#b0b5c0"/>
  <rect x="7" y="3" width="1" height="1" fill="#9095a0"/>
  <rect x="2" y="4" width="2" height="1" fill="#a0a5b0"/>
  <rect x="4" y="4" width="1" height="1" fill="#c0c5d0"/>
  <rect x="7" y="4" width="1" height="1" fill="#c0c5d0"/>
  <rect x="8" y="4" width="2" height="1" fill="#a0a5b0"/>
  <rect x="1" y="5" width="1" height="2" fill="#9095a0"/>
  <rect x="2" y="5" width="1" height="2" fill="#b0b5c0"/>
  <rect x="3" y="5" width="1" height="2" fill="#c0c5d0"/>
  <rect x="4" y="5" width="1" height="2" fill="#d0d5e0"/>
  <rect x="5" y="5" width="2" height="2" fill="#606570"/>
  <rect x="7" y="5" width="1" height="2" fill="#d0d5e0"/>
  <rect x="8" y="5" width="1" height="2" fill="#c0c5d0"/>
  <rect x="9" y="5" width="1" height="2" fill="#b0b5c0"/>
  <rect x="10" y="5" width="1" height="2" fill="#9095a0"/>
  <rect x="2" y="7" width="2" height="1" fill="#a0a5b0"/>
  <rect x="4" y="7" width="1" height="1" fill="#c0c5d0"/>
  <rect x="7" y="7" width="1" height="1" fill="#c0c5d0"/>
  <rect x="8" y="7" width="2" height="1" fill="#a0a5b0"/>
  <rect x="4" y="8" width="1" height="1" fill="#9095a0"/>
  <rect x="5" y="8" width="2" height="1" fill="#b0b5c0"/>
  <rect x="7" y="8" width="1" height="1" fill="#9095a0"/>
  <rect x="5" y="9" width="2" height="1" fill="#c0c5d0"/>
  <rect x="5" y="10" width="2" height="1" fill="#a0a5b0"/>
</svg>`;

/**
 * Ammo display HUD component — shows weapon type with pixel art SVG icons,
 * current ammo counts, selected weapon indicator, and cooldown progress.
 */
export class AmmoDisplay {
  readonly element: HTMLElement;
  private kunaiCount: HTMLElement;
  private shurikenCount: HTMLElement;
  private kunaiRow: HTMLElement;
  private shurikenRow: HTMLElement;
  private kunaiCooldown: HTMLElement;
  private shurikenCooldown: HTMLElement;

  constructor() {
    this.element = createElement('div', { className: 'hud-ammo' });

    const title = createElement('div', { className: 'hud-ammo__title', text: '// Thrown' });
    this.element.appendChild(title);

    // Kunai row
    this.kunaiRow = createElement('div', { className: 'hud-ammo__row' });
    const kunaiSelector = createElement('span', { className: 'hud-ammo__selector', text: '\u25B8' });
    this.kunaiRow.appendChild(kunaiSelector);
    const kunaiIcon = createElement('div', { className: 'hud-ammo__icon' });
    kunaiIcon.innerHTML = KUNAI_SVG;
    this.kunaiRow.appendChild(kunaiIcon);
    const kunaiLabel = createElement('span', { className: 'hud-ammo__label', text: 'KUN' });
    this.kunaiRow.appendChild(kunaiLabel);
    this.kunaiCount = createElement('span', { className: 'hud-ammo__count', text: `0/${MAX_THROWN_AMMO}` });
    this.kunaiRow.appendChild(this.kunaiCount);
    this.kunaiCooldown = createElement('div', { className: 'hud-ammo__cooldown' });
    this.kunaiCooldown.appendChild(createElement('div', { className: 'hud-ammo__cooldown-fill' }));
    this.kunaiRow.appendChild(this.kunaiCooldown);
    this.element.appendChild(this.kunaiRow);

    // Shuriken row
    this.shurikenRow = createElement('div', { className: 'hud-ammo__row' });
    const shurikenSelector = createElement('span', { className: 'hud-ammo__selector', text: '\u25B8' });
    this.shurikenRow.appendChild(shurikenSelector);
    const shurikenIcon = createElement('div', { className: 'hud-ammo__icon' });
    shurikenIcon.innerHTML = SHURIKEN_SVG;
    this.shurikenRow.appendChild(shurikenIcon);
    const shurikenLabel = createElement('span', { className: 'hud-ammo__label', text: 'SHU' });
    this.shurikenRow.appendChild(shurikenLabel);
    this.shurikenCount = createElement('span', { className: 'hud-ammo__count', text: `0/${MAX_THROWN_AMMO}` });
    this.shurikenRow.appendChild(this.shurikenCount);
    this.shurikenCooldown = createElement('div', { className: 'hud-ammo__cooldown' });
    this.shurikenCooldown.appendChild(createElement('div', { className: 'hud-ammo__cooldown-fill' }));
    this.shurikenRow.appendChild(this.shurikenCooldown);
    this.element.appendChild(this.shurikenRow);
  }

  /**
   * Update ammo counts, selected weapon indicator, and cooldown state.
   * @param cooldownProgress 0 = just thrown (full cooldown), 1 = ready to throw
   */
  update(
    ammo: ThrownAmmoComponent | undefined,
    selectedWeapon: ThrownWeaponType,
    throwingMode: boolean,
    cooldownProgress: number,
  ): void {
    const kunai = ammo?.kunai ?? 0;
    const shuriken = ammo?.shuriken ?? 0;

    this.kunaiCount.textContent = `${kunai}/${MAX_THROWN_AMMO}`;
    this.shurikenCount.textContent = `${shuriken}/${MAX_THROWN_AMMO}`;

    // Dim when empty
    this.kunaiRow.classList.toggle('hud-ammo__row--empty', kunai <= 0);
    this.shurikenRow.classList.toggle('hud-ammo__row--empty', shuriken <= 0);

    // Always show selected weapon indicator (arrow marker)
    this.kunaiRow.classList.toggle('hud-ammo__row--selected', selectedWeapon === 'kunai');
    this.shurikenRow.classList.toggle('hud-ammo__row--selected', selectedWeapon === 'shuriken');

    // Throwing mode active highlight (brighter when aiming)
    this.kunaiRow.classList.toggle('hud-ammo__row--aiming', throwingMode && selectedWeapon === 'kunai');
    this.shurikenRow.classList.toggle('hud-ammo__row--aiming', throwingMode && selectedWeapon === 'shuriken');

    // Cooldown overlay on the selected weapon row
    const onCooldown = cooldownProgress < 1;
    const selectedCooldown = selectedWeapon === 'kunai' ? this.kunaiCooldown : this.shurikenCooldown;
    const otherCooldown = selectedWeapon === 'kunai' ? this.shurikenCooldown : this.kunaiCooldown;

    // Show cooldown bar only on selected weapon
    selectedCooldown.classList.toggle('hud-ammo__cooldown--active', onCooldown);
    otherCooldown.classList.toggle('hud-ammo__cooldown--active', false);

    // Fill width represents remaining cooldown (shrinks as cooldown expires)
    const fill = selectedCooldown.firstElementChild as HTMLElement;
    if (fill) {
      fill.style.width = onCooldown ? `${(1 - cooldownProgress) * 100}%` : '0%';
    }
    const otherFill = otherCooldown.firstElementChild as HTMLElement;
    if (otherFill) {
      otherFill.style.width = '0%';
    }
  }
}
