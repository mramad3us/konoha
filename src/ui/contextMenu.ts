import { createElement } from '../utils/dom.ts';
import { sfxMenuClick } from '../systems/audioSystem.ts';

/**
 * Pixel-art styled context menu for entity interactions.
 * Appears near the target, dismissed with Escape or clicking outside.
 */

export interface ContextMenuOption {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;   // red tint for lethal actions
  accent?: boolean;   // gold tint for positive actions
}

export class ContextMenu {
  readonly element: HTMLElement;
  private backdrop: HTMLElement;
  private titleEl: HTMLElement;
  private optionsEl: HTMLElement;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private resolvePromise: ((id: string | null) => void) | null = null;
  private selectedIndex = 0;
  private options: ContextMenuOption[] = [];

  constructor() {
    this.backdrop = createElement('div', { className: 'ctx-menu-backdrop' });
    this.backdrop.addEventListener('click', () => this.close(null));

    this.element = createElement('div', { className: 'ctx-menu' });

    // Title bar with pixel kunai decoration
    this.titleEl = createElement('div', { className: 'ctx-menu__title' });
    this.element.appendChild(this.titleEl);

    // Separator — pixel art line
    const sep = createElement('div', { className: 'ctx-menu__sep' });
    this.element.appendChild(sep);

    this.optionsEl = createElement('div', { className: 'ctx-menu__options' });
    this.element.appendChild(this.optionsEl);

    // Footer hint
    const hint = createElement('div', { className: 'ctx-menu__hint', text: 'ESC close · ↑↓ select · ENTER confirm' });
    this.element.appendChild(hint);
  }

  /**
   * Show the context menu with options. Returns the selected option ID or null if cancelled.
   */
  show(title: string, options: ContextMenuOption[]): Promise<string | null> {
    this.options = options;
    this.selectedIndex = options.findIndex(o => !o.disabled);
    if (this.selectedIndex < 0) this.selectedIndex = 0;

    this.titleEl.textContent = title;
    this.renderOptions();

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.element);

    // Animate in
    requestAnimationFrame(() => {
      this.backdrop.classList.add('ctx-menu-backdrop--visible');
      this.element.classList.add('ctx-menu--visible');
    });

    // Keyboard navigation
    this.keyHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        this.close(null);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        this.moveSelection(-1);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        this.moveSelection(1);
      } else if (e.key === 'Enter') {
        const opt = this.options[this.selectedIndex];
        if (opt && !opt.disabled) {
          sfxMenuClick();
          this.close(opt.id);
        }
      }
    };
    document.addEventListener('keydown', this.keyHandler, true);

    return new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }

  private moveSelection(dir: number): void {
    let next = this.selectedIndex;
    for (let i = 0; i < this.options.length; i++) {
      next = (next + dir + this.options.length) % this.options.length;
      if (!this.options[next].disabled) break;
    }
    this.selectedIndex = next;
    this.renderOptions();
  }

  private renderOptions(): void {
    this.optionsEl.innerHTML = '';
    this.options.forEach((opt, i) => {
      const row = createElement('div', {
        className: `ctx-menu__option${opt.disabled ? ' ctx-menu__option--disabled' : ''}${opt.danger ? ' ctx-menu__option--danger' : ''}${opt.accent ? ' ctx-menu__option--accent' : ''}${i === this.selectedIndex ? ' ctx-menu__option--selected' : ''}`,
      });

      // Selection indicator (pixel arrow)
      const indicator = createElement('span', {
        className: 'ctx-menu__indicator',
        text: i === this.selectedIndex ? '▸' : ' ',
      });
      row.appendChild(indicator);

      const label = createElement('span', { className: 'ctx-menu__label', text: opt.label });
      row.appendChild(label);

      if (opt.disabled && opt.disabledReason) {
        const reason = createElement('span', { className: 'ctx-menu__reason', text: opt.disabledReason });
        row.appendChild(reason);
      }

      row.addEventListener('click', () => {
        if (!opt.disabled) {
          sfxMenuClick();
          this.close(opt.id);
        }
      });

      row.addEventListener('mouseenter', () => {
        if (!opt.disabled) {
          this.selectedIndex = i;
          this.renderOptions();
        }
      });

      this.optionsEl.appendChild(row);
    });
  }

  private close(result: string | null): void {
    this.backdrop.classList.remove('ctx-menu-backdrop--visible');
    this.element.classList.remove('ctx-menu--visible');

    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }

    setTimeout(() => {
      this.backdrop.remove();
      this.element.remove();
      if (this.resolvePromise) {
        this.resolvePromise(result);
        this.resolvePromise = null;
      }
    }, 150);
  }
}
