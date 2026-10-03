/**
 * Modal sheet over the game: a surface (washi paper, wood board, counter) with keyboard
 * handling. Esc closes; registered hotkeys trigger actions.
 */

import { h } from './kit.ts';
import { sfx } from '../audio/audio.ts';

export type Surface = 'washi' | 'wood' | 'counter' | 'ink';

export class Sheet {
  readonly el: HTMLDivElement;
  readonly panel: HTMLDivElement;
  readonly body: HTMLDivElement;
  private done: (() => void) | null = null;
  private keys = new Map<string, () => void>();
  private readonly onKey = (e: KeyboardEvent) => this.key(e);
  onKeyExtra: ((e: KeyboardEvent) => boolean) | null = null;

  constructor(root: HTMLElement, title: string, surface: Surface, subtitle?: string) {
    this.el = h('div', 'sheet');
    this.panel = h('div', `sheet__panel sheet__panel--${surface}`);
    const head = h('div', 'sheet__head', h('h2', 'sheet__title', title));
    if (subtitle) head.append(h('div', 'sheet__sub', subtitle));
    head.append(h('button', 'sheet__close', 'Esc'));
    head.querySelector('.sheet__close')!.addEventListener('click', () => this.close());
    this.body = h('div', 'sheet__body');
    this.panel.append(head, this.body);
    this.el.appendChild(this.panel);
    this.el.addEventListener('mousedown', e => { if (e.target === this.el) this.close(); });
    root.appendChild(this.el);
    window.addEventListener('keydown', this.onKey, true);
    requestAnimationFrame(() => this.el.classList.add('sheet--in'));
  }

  /** Bind a key code to an action while this sheet is open. */
  bind(code: string, fn: () => void): void {
    this.keys.set(code, fn);
  }

  clearKeys(): void {
    this.keys.clear();
  }

  wait(): Promise<void> {
    return new Promise(r => { this.done = r; });
  }

  close(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
    sfx.ui('back');
    const d = this.done;
    this.done = null;
    d?.();
  }

  private key(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.target instanceof HTMLInputElement) { if (e.code === 'Escape') { e.preventDefault(); this.close(); } return; }
    e.preventDefault();
    if (e.code === 'Escape') { this.close(); return; }
    if (this.onKeyExtra?.(e)) return;
    const fn = this.keys.get(e.code);
    if (fn) fn();
  }
}
