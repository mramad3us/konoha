import { createElement } from '../utils/dom.ts';
import type { GameLogEntry } from '../types/actions.ts';
import { VISIBLE_LOG_ENTRIES } from '../core/constants.ts';

export class GameLog {
  readonly element: HTMLElement;
  private entriesEl: HTMLElement;
  private lastRenderedCount = 0;

  constructor() {
    this.element = createElement('div', { className: 'game-log' });

    this.element.appendChild(
      createElement('div', { className: 'game-log__header', text: '// Log' })
    );

    this.entriesEl = createElement('div', { className: 'game-log__entries' });
    this.element.appendChild(this.entriesEl);
  }

  /** Render new entries only (newest on top) */
  update(entries: GameLogEntry[]): void {
    const newCount = entries.length;
    if (newCount === this.lastRenderedCount) return;

    // Add only new entries at the top
    const toAdd = newCount - this.lastRenderedCount;
    for (let i = toAdd - 1; i >= 0; i--) {
      const entry = entries[i];
      const el = createElement('div', {
        className: `game-log__entry game-log__entry--${entry.category}`,
      });

      const tick = createElement('span', {
        className: 'game-log__tick',
        text: `[${entry.tick}]`,
      });
      el.appendChild(tick);
      el.appendChild(document.createTextNode(` ${entry.text}`));

      this.entriesEl.insertBefore(el, this.entriesEl.firstChild);
    }

    // Trim old entries from DOM if too many
    while (this.entriesEl.children.length > VISIBLE_LOG_ENTRIES * 2) {
      this.entriesEl.removeChild(this.entriesEl.lastChild!);
    }

    this.lastRenderedCount = newCount;
  }

  /** Clear and re-render from scratch (for save loads) */
  fullRender(entries: GameLogEntry[]): void {
    this.entriesEl.innerHTML = '';
    this.lastRenderedCount = 0;
    this.update(entries);
  }
}
