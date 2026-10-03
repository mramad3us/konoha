import { createElement } from '../utils/dom.ts';
import type { GameLogEntry } from '../types/actions.ts';
import { formatGameTime } from '../engine/gameTime.ts';

const MAX_DOM_ENTRIES = 80; // max entries in DOM before pruning from bottom

export class GameLog {
  readonly element: HTMLElement;
  private entriesEl: HTMLElement;
  private lastTopText = '';     // track by content, not count
  private lastTopTick = -1;

  constructor() {
    this.element = createElement('div', { className: 'game-log' });
    this.element.appendChild(
      createElement('div', { className: 'game-log__header', text: '// Chronicle' })
    );
    this.entriesEl = createElement('div', { className: 'game-log__entries' });
    this.element.appendChild(this.entriesEl);
  }

  /** Render new entries only (newest on top). Uses content tracking, not count. */
  update(entries: GameLogEntry[], gameTimeSeconds?: number): void {
    if (entries.length === 0) return;

    // Find how many new entries at the top of the array
    let newCount = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].text === this.lastTopText && entries[i].tick === this.lastTopTick) break;
      newCount++;
    }

    if (newCount === 0) return;

    // Render new entries
    for (let i = newCount - 1; i >= 0; i--) {
      const entry = entries[i];
      const el = createElement('div', {
        className: `game-log__entry game-log__entry--${entry.category}`,
      });

      // Timestamp instead of tick number
      const timestamp = createElement('span', {
        className: 'game-log__tick',
        text: gameTimeSeconds !== undefined
          ? `[${formatGameTime(gameTimeSeconds)}]`
          : '',
      });
      if (timestamp.textContent) el.appendChild(timestamp);
      el.appendChild(document.createTextNode(` ${entry.text}`));

      this.entriesEl.insertBefore(el, this.entriesEl.firstChild);
    }

    // Track the newest entry for next comparison
    this.lastTopText = entries[0].text;
    this.lastTopTick = entries[0].tick;

    // Prune old DOM entries from bottom
    while (this.entriesEl.children.length > MAX_DOM_ENTRIES) {
      this.entriesEl.removeChild(this.entriesEl.lastChild!);
    }
  }

  /** Clear and re-render from scratch */
  fullRender(entries: GameLogEntry[], gameTimeSeconds?: number): void {
    this.entriesEl.innerHTML = '';
    this.lastTopText = '';
    this.lastTopTick = -1;
    this.update(entries, gameTimeSeconds);
  }
}
