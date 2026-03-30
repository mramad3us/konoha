import { createElement } from '../utils/dom.ts';
import { sfxMenuClick } from '../systems/audioSystem.ts';
import type { SquadROE } from '../types/squad.ts';

/** Pixel art shield icon (defensive) — 12×12 */
const SHIELD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" class="pixel-sprite">
  <rect x="3" y="1" width="6" height="1" fill="#4a7ab5"/>
  <rect x="2" y="2" width="8" height="1" fill="#4a7ab5"/>
  <rect x="2" y="3" width="8" height="1" fill="#3a6a9f"/>
  <rect x="2" y="4" width="8" height="1" fill="#3a6a9f"/>
  <rect x="3" y="5" width="6" height="1" fill="#2a5a8f"/>
  <rect x="3" y="6" width="6" height="1" fill="#2a5a8f"/>
  <rect x="4" y="7" width="4" height="1" fill="#1a4a7f"/>
  <rect x="4" y="8" width="4" height="1" fill="#1a4a7f"/>
  <rect x="5" y="9" width="2" height="1" fill="#0a3a6f"/>
  <rect x="5" y="3" width="2" height="1" fill="#6a9acf"/>
  <rect x="5" y="4" width="2" height="1" fill="#6a9acf"/>
</svg>`;

/** Pixel art crossed swords icon (aggressive) — 12×12 */
const SWORDS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" class="pixel-sprite">
  <rect x="1" y="1" width="1" height="1" fill="#d0d0d0"/>
  <rect x="2" y="2" width="1" height="1" fill="#c0c0c0"/>
  <rect x="3" y="3" width="1" height="1" fill="#b0b0b0"/>
  <rect x="4" y="4" width="1" height="1" fill="#a0a0a0"/>
  <rect x="5" y="5" width="2" height="2" fill="#8B4513"/>
  <rect x="10" y="1" width="1" height="1" fill="#d0d0d0"/>
  <rect x="9" y="2" width="1" height="1" fill="#c0c0c0"/>
  <rect x="8" y="3" width="1" height="1" fill="#b0b0b0"/>
  <rect x="7" y="4" width="1" height="1" fill="#a0a0a0"/>
  <rect x="4" y="7" width="1" height="1" fill="#555"/>
  <rect x="3" y="8" width="1" height="1" fill="#555"/>
  <rect x="7" y="7" width="1" height="1" fill="#555"/>
  <rect x="8" y="8" width="1" height="1" fill="#555"/>
</svg>`;

/**
 * ROE indicator — shows current squad rules of engagement.
 * Sits next to the kill intent toggle. Only visible when a squad is active.
 */
export class ROEIndicator {
  readonly element: HTMLElement;
  private iconEl: HTMLElement;
  private labelEl: HTMLElement;
  private _roe: SquadROE = 'defensive';
  private onChange: ((roe: SquadROE) => void) | null = null;

  constructor() {
    this.element = createElement('div', { className: 'roe-indicator' });

    this.iconEl = createElement('div', { className: 'roe-indicator__icon' });
    this.iconEl.innerHTML = SHIELD_SVG;
    this.element.appendChild(this.iconEl);

    this.labelEl = createElement('span', { className: 'roe-indicator__label', text: 'Defensive' });
    this.element.appendChild(this.labelEl);

    const keyHint = createElement('span', { className: 'roe-indicator__key', text: 'R' });
    this.element.appendChild(keyHint);

    this.element.addEventListener('click', () => this.toggle());

    // Hidden by default — shown when squad is active
    this.element.style.display = 'none';
  }

  get roe(): SquadROE { return this._roe; }

  setChangeCallback(cb: (roe: SquadROE) => void): void {
    this.onChange = cb;
  }

  toggle(): void {
    this._roe = this._roe === 'defensive' ? 'aggressive' : 'defensive';
    sfxMenuClick();
    this.render();
    if (this.onChange) this.onChange(this._roe);
  }

  setState(roe: SquadROE): void {
    this._roe = roe;
    this.render();
  }

  show(): void {
    this.element.style.display = '';
  }

  hide(): void {
    this.element.style.display = 'none';
  }

  private render(): void {
    if (this._roe === 'aggressive') {
      this.iconEl.innerHTML = SWORDS_SVG;
      this.labelEl.textContent = 'Aggressive';
      this.element.classList.add('roe-indicator--aggressive');
    } else {
      this.iconEl.innerHTML = SHIELD_SVG;
      this.labelEl.textContent = 'Defensive';
      this.element.classList.remove('roe-indicator--aggressive');
    }
  }
}
