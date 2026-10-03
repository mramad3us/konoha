/**
 * Small DOM kit shared by screens and panels: element builder, buttons, key caps, hanko seals.
 */

import { Pix } from '../art/pix.ts';
import { hex, type RGB } from '../art/color.ts';
import { hash2 } from '../core/rng.ts';
import { renderText } from '../art/font.ts';
import { keyLabel } from './keys.ts';
import { sfx } from '../audio/audio.ts';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, ...children: Array<Node | string | null | undefined | false>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export function button(label: string, onClick: () => void, cls = 'btn', key?: string): HTMLButtonElement {
  const b = h('button', cls);
  if (key) b.append(h('span', 'cap', key));
  b.append(h('span', 'btn__label', label));
  b.addEventListener('click', () => { sfx.ui('confirm'); onClick(); });
  b.addEventListener('mouseenter', () => sfx.ui('move'));
  return b;
}

export function cap(code: string): HTMLSpanElement {
  return h('span', 'cap', keyLabel(code));
}

/** A pixel-art hanko seal (red stamp) with a short label, as a canvas scaled by CSS. */
export function seal(text: string, opts: { color?: string; size?: number; tilt?: number; round?: boolean } = {}): HTMLCanvasElement {
  const txt = renderText(text, [246, 236, 214], null);
  const pad = 3;
  const w = Math.max(opts.size ?? 0, txt.w + pad * 2 + 2), hgt = Math.max(opts.size ?? 0, txt.h + pad * 2 + 2);
  const p = new Pix(w, hgt);
  const red: RGB = hex(opts.color ?? '#b3302a');
  const seed = text.length * 97 + text.charCodeAt(0);
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const edge = Math.min(x, y, w - 1 - x, hgt - 1 - y);
    if (opts.round) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - hgt / 2) / (hgt / 2);
      if (dx * dx + dy * dy > 1) continue;
    }
    const n = hash2(x + seed, y * 3 + seed) % 100;
    if (edge === 0 && n < 35) continue;            // ragged ink edge
    if (edge === 1 && n < 6) continue;
    const ink = n < 8 ? [red[0] * 0.8, red[1] * 0.8, red[2] * 0.8] as RGB : red;
    p.set(x, y, ink, edge === 0 ? 200 : 255);
  }
  // inner frame line
  for (let x = 2; x < w - 2; x++) { p.set(x, 2, [246, 236, 214], 140); p.set(x, hgt - 3, [246, 236, 214], 140); }
  for (let y = 2; y < hgt - 2; y++) { p.set(2, y, [246, 236, 214], 140); p.set(w - 3, y, [246, 236, 214], 140); }
  p.blit(txt, Math.floor((w - txt.w) / 2), Math.floor((hgt - txt.h) / 2));
  // worn spots
  for (let k = 0; k < 6; k++) {
    const hh = hash2(seed, k);
    const x = hh % w, y = (hh >> 8) % hgt;
    if (p.alpha(x, y)) p.set(x, y, red, 120);
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = hgt;
  cv.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.data), w, hgt), 0, 0);
  cv.className = 'seal';
  cv.style.setProperty('--w', String(w));
  cv.style.setProperty('--h', String(hgt));
  if (opts.tilt) cv.style.transform = `rotate(${opts.tilt}deg)`;
  return cv;
}

/** Draw an atlas frame into a canvas element at an integer scale. */
export function spriteCanvas(cv: OffscreenCanvas, sx: number, sy: number, sw: number, sh: number, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  c.getContext('2d')!.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh);
  c.style.width = `${sw * scale}px`;
  c.style.height = `${sh * scale}px`;
  c.className = 'sprite';
  return c;
}

/** Fade the whole app through ink and back while `work` runs. */
export async function inkWipe(root: HTMLElement, work: () => void | Promise<void>, ms = 420): Promise<void> {
  let veil = root.querySelector<HTMLDivElement>(':scope > .veil');
  if (!veil) { veil = h('div', 'veil'); root.appendChild(veil); }
  veil.classList.add('veil--on');
  await wait(ms);
  await work();
  await wait(60);
  veil.classList.remove('veil--on');
  await wait(ms);
}

export function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
