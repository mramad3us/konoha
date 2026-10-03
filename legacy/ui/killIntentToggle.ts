import { createElement } from '../utils/dom.ts';
import { sfxMenuClick } from '../systems/audioSystem.ts';

/** Pixel art fist icon (subdue mode) — 12×12 */
const FIST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" class="pixel-sprite">
  <rect x="3" y="2" width="6" height="2" fill="#d4a574"/>
  <rect x="2" y="4" width="8" height="4" fill="#d4a574"/>
  <rect x="3" y="4" width="6" height="3" fill="#c89060"/>
  <rect x="2" y="8" width="3" height="2" fill="#d4a574"/>
  <rect x="6" y="8" width="4" height="1" fill="#d4a574"/>
</svg>`;

/** Pixel art kunai icon (kill mode) — 12×12 */
const KUNAI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" class="pixel-sprite">
  <rect x="5" y="0" width="2" height="1" fill="#d0d0d0"/>
  <rect x="5" y="1" width="2" height="1" fill="#b0b0b0"/>
  <rect x="4" y="2" width="4" height="1" fill="#a0a0a0"/>
  <rect x="5" y="3" width="2" height="1" fill="#808080"/>
  <rect x="4" y="4" width="4" height="1" fill="#8B4513"/>
  <rect x="5" y="5" width="2" height="1" fill="#1a1a1a"/>
  <rect x="5" y="6" width="2" height="1" fill="#f5f0dc"/>
  <rect x="5" y="7" width="2" height="1" fill="#1a1a1a"/>
  <rect x="5" y="8" width="2" height="1" fill="#f5f0dc"/>
  <rect x="4" y="9" width="4" height="1" fill="#555"/>
  <rect x="4" y="10" width="1" height="1" fill="#555"/>
  <rect x="7" y="10" width="1" height="1" fill="#555"/>
</svg>`;

/**
 * Kill intent toggle — pixel art kunai/fist icon in bottom-left of game area.
 * Click to toggle between subdue (fist) and kill (kunai) combat intent.
 */
export class KillIntentToggle {
  readonly element: HTMLElement;
  private iconEl: HTMLElement;
  private labelEl: HTMLElement;
  private _killIntent = false;
  private onChange: ((kill: boolean) => void) | null = null;

  constructor() {
    this.element = createElement('div', { className: 'kill-intent-toggle' });

    this.iconEl = createElement('div', { className: 'kill-intent-toggle__icon' });
    this.iconEl.innerHTML = FIST_SVG;
    this.element.appendChild(this.iconEl);

    this.labelEl = createElement('span', { className: 'kill-intent-toggle__label', text: 'Subdue' });
    this.element.appendChild(this.labelEl);

    this.element.addEventListener('click', () => this.toggle());
  }

  get killIntent(): boolean { return this._killIntent; }

  setChangeCallback(cb: (kill: boolean) => void): void {
    this.onChange = cb;
  }

  toggle(): void {
    this._killIntent = !this._killIntent;
    sfxMenuClick();

    if (this._killIntent) {
      this.iconEl.innerHTML = KUNAI_SVG;
      this.labelEl.textContent = 'Kill';
      this.element.classList.add('kill-intent-toggle--active');
      this.iconEl.classList.add('kill-intent-toggle__icon--flash');
      setTimeout(() => this.iconEl.classList.remove('kill-intent-toggle__icon--flash'), 300);
    } else {
      this.iconEl.innerHTML = FIST_SVG;
      this.labelEl.textContent = 'Subdue';
      this.element.classList.remove('kill-intent-toggle--active');
    }

    if (this.onChange) this.onChange(this._killIntent);
  }

  /** Sync state from world (e.g. on save load) */
  setState(kill: boolean): void {
    this._killIntent = kill;
    if (kill) {
      this.iconEl.innerHTML = KUNAI_SVG;
      this.labelEl.textContent = 'Kill';
      this.element.classList.add('kill-intent-toggle--active');
    } else {
      this.iconEl.innerHTML = FIST_SVG;
      this.labelEl.textContent = 'Subdue';
      this.element.classList.remove('kill-intent-toggle--active');
    }
  }
}
