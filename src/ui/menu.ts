/**
 * Keyboard-first popup menu. Numbers pick directly; arrows/vi-keys move; Enter/F confirms.
 */

import { sfx } from '../audio/audio.ts';

export interface MenuOption {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
}

export class Menu {
  private el: HTMLDivElement;
  private resolve: ((v: string | null) => void) | null = null;
  private opts: MenuOption[] = [];
  private idx = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'menu';
    this.el.hidden = true;
    root.appendChild(this.el);
  }

  get open(): boolean {
    return this.resolve !== null;
  }

  show(title: string, options: MenuOption[], subtitle?: string): Promise<string | null> {
    this.close(null);
    this.opts = options;
    this.idx = Math.max(0, options.findIndex(o => !o.disabled));
    this.el.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'menu__title';
    h.textContent = title;
    this.el.appendChild(h);
    if (subtitle) {
      const s = document.createElement('div');
      s.className = 'menu__sub';
      s.textContent = subtitle;
      this.el.appendChild(s);
    }
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'menu__opt' + (o.danger ? ' menu__opt--danger' : '') + (o.disabled ? ' menu__opt--off' : '');
      b.innerHTML = `<span class="menu__key">${i < 9 ? i + 1 : ''}</span><span class="menu__label"></span>${o.hint ? '<span class="menu__hint"></span>' : ''}`;
      (b.querySelector('.menu__label') as HTMLElement).textContent = o.label;
      if (o.hint) (b.querySelector('.menu__hint') as HTMLElement).textContent = o.hint;
      b.disabled = !!o.disabled;
      b.addEventListener('mouseenter', () => { this.idx = i; this.paint(); });
      b.addEventListener('click', () => this.pick(i));
      this.el.appendChild(b);
    });
    this.el.hidden = false;
    this.paint();
    return new Promise(r => { this.resolve = r; });
  }

  close(v: string | null): void {
    const r = this.resolve;
    this.resolve = null;
    this.el.hidden = true;
    if (r) r(v);
  }

  key(e: KeyboardEvent): void {
    e.preventDefault();
    const c = e.code;
    if (c === 'Escape') { sfx.ui('back'); this.close(null); return; }
    if (/^Digit[1-9]$/.test(c) || /^Numpad[1-9]$/.test(c)) {
      const i = Number(c.slice(-1)) - 1;
      if (i < this.opts.length) this.pick(i);
      return;
    }
    if (c === 'ArrowDown' || c === 'KeyJ' || c === 'Tab') this.step(1);
    else if (c === 'ArrowUp' || c === 'KeyK') this.step(-1);
    else if (c === 'Enter' || c === 'KeyF' || c === 'Space' || c === 'NumpadEnter') this.pick(this.idx);
  }

  private step(d: number): void {
    for (let k = 0; k < this.opts.length; k++) {
      this.idx = (this.idx + d + this.opts.length) % this.opts.length;
      if (!this.opts[this.idx].disabled) break;
    }
    sfx.ui('move');
    this.paint();
  }

  private pick(i: number): void {
    const o = this.opts[i];
    if (!o || o.disabled) { sfx.ui('error'); return; }
    sfx.ui('confirm');
    this.close(o.id);
  }

  private paint(): void {
    this.el.querySelectorAll('.menu__opt').forEach((b, i) => b.classList.toggle('menu__opt--sel', i === this.idx));
  }
}
