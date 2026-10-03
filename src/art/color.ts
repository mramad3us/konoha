/**
 * Color helpers for pixel art: hex ⇄ RGB, and hue-shifted shading so shadows lean cool and
 * highlights lean warm (keeps ramps lively instead of muddy).
 */

export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/**
 * Shade a color. amount < 0 darkens (shifting hue toward blue/purple), > 0 lightens
 * (shifting toward yellow). |amount| ≈ 0.1–0.4 for typical ramps.
 */
export function shade(c: RGB | string, amount: number): RGB {
  const rgb = typeof c === 'string' ? hex(c) : c;
  const [h, s, l] = rgbToHsl(rgb);
  const target = amount < 0 ? 245 : 55; // hue to drift toward
  let dh = target - h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const nh = h + dh * Math.min(1, Math.abs(amount)) * 0.25;
  const ns = Math.max(0, Math.min(1, s * (amount < 0 ? 1 + Math.abs(amount) * 0.15 : 1 - amount * 0.2)));
  const nl = Math.max(0, Math.min(1, l + amount * (amount < 0 ? l : 1 - l)));
  return hslToRgb(nh, ns, nl);
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function rgbCss([r, g, b]: RGB, a = 1): string {
  return a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

/** A 5-step ramp from dark to light around a base color. */
export function ramp(c: string): [RGB, RGB, RGB, RGB, RGB] {
  return [shade(c, -0.55), shade(c, -0.28), hex(c), shade(c, 0.22), shade(c, 0.45)];
}

export const OUTLINE: RGB = [20, 16, 24];
