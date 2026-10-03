/**
 * Character paper doll. A character is drawn from parts (head, hair, torso, arms, legs) placed
 * by per-pose geometry, then outlined. Everything derives from the serializable Appearance, so
 * any NPC can be regenerated pixel-identical after loading a save.
 *
 * Views: 'front' faces screen-down-left, 'back' faces screen-up-left; the renderer mirrors
 * them for rightward facings.
 */

import type { Appearance } from '../ecs/components.ts';
import { hex, shade, OUTLINE, type RGB } from './color.ts';
import { sprite, groundShadow, type ArtSprite } from './draw.ts';
import { SKIN_TONES } from '../content/looks.ts';

export type Pose = 'idle' | 'walkA' | 'walkB' | 'strike' | 'break' | 'guard' | 'sign' | 'sneak' | 'hurt' | 'throw' | 'prone';
export const POSES: readonly Pose[] = ['idle', 'walkA', 'walkB', 'strike', 'break', 'guard', 'sign', 'sneak', 'hurt', 'throw', 'prone'];

export const CHAR_W = 22;
export const CHAR_H = 30;
export const CHAR_AX = 11;
export const CHAR_AY = 27;

interface Pal {
  o: RGB;
  skin: RGB; skinS: RGB; skinH: RGB;
  hair: RGB; hairS: RGB; hairH: RGB;
  eye: RGB; white: RGB;
  top: RGB; topS: RGB; topH: RGB;
  vest: RGB; vestS: RGB; vestH: RGB;
  bot: RGB; botS: RGB;
  acc: RGB; accS: RGB;
  band: RGB; bandS: RGB; metal: RGB; metalH: RGB;
  feet: RGB;
}

function palette(a: Appearance): Pal {
  const skin = hex(SKIN_TONES[a.skin] ?? SKIN_TONES[0]);
  const hair = hex(a.hairColor);
  const top = hex(a.top);
  const vest = a.vest === 'chunin' ? hex('#4f6b3a') : top;
  const bot = hex(a.bottom);
  const acc = hex(a.accent);
  const band = hex(a.headbandColor);
  return {
    o: OUTLINE,
    skin, skinS: shade(skin, -0.22), skinH: shade(skin, 0.15),
    hair, hairS: shade(hair, -0.3), hairH: shade(hair, 0.25),
    eye: hex(a.eyes), white: [236, 232, 224],
    top, topS: shade(top, -0.3), topH: shade(top, 0.18),
    vest, vestS: shade(vest, -0.3), vestH: shade(vest, 0.2),
    bot, botS: shade(bot, -0.3),
    acc, accS: shade(acc, -0.3),
    band, bandS: shade(band, -0.3), metal: [150, 160, 172], metalH: [205, 212, 220],
    feet: [44, 40, 48],
  };
}

interface Geo {
  head: [number, number];        // head top-left
  torso: [number, number];       // torso top-left (8×6)
  legs: 'stand' | 'walkA' | 'walkB' | 'crouch' | 'wide';
  near: [number, number, number, number]; // shoulder → hand (screen-left arm)
  far: [number, number, number, number];  // shoulder → hand (screen-right arm)
  farBehind?: boolean;
}

const BASE_HEAD: [number, number] = [7, 6];
const BASE_TORSO: [number, number] = [7, 14];

const GEO: Record<Exclude<Pose, 'prone'>, Geo> = {
  idle:   { head: BASE_HEAD, torso: BASE_TORSO, legs: 'stand', near: [7, 15, 6, 19], far: [14, 15, 15, 19] },
  walkA:  { head: [7, 5], torso: [7, 13], legs: 'walkA', near: [7, 14, 5, 18], far: [14, 14, 15, 19] },
  walkB:  { head: [7, 5], torso: [7, 13], legs: 'walkB', near: [7, 14, 7, 19], far: [14, 14, 16, 18] },
  strike: { head: [6, 6], torso: [6, 14], legs: 'wide', near: [6, 15, 1, 15], far: [13, 15, 12, 18] },
  break:  { head: [5, 7], torso: [6, 15], legs: 'wide', near: [6, 16, 2, 18], far: [13, 16, 4, 19], farBehind: false },
  guard:  { head: [7, 6], torso: [7, 14], legs: 'stand', near: [7, 15, 7, 11], far: [14, 15, 10, 11] },
  sign:   { head: [7, 6], torso: [7, 14], legs: 'stand', near: [7, 15, 10, 16], far: [14, 15, 11, 16] },
  sneak:  { head: [6, 10], torso: [7, 17], legs: 'crouch', near: [7, 18, 4, 22], far: [14, 18, 13, 22] },
  hurt:   { head: [8, 6], torso: [8, 14], legs: 'stand', near: [8, 15, 6, 12], far: [15, 15, 17, 13] },
  throw:  { head: [7, 6], torso: [7, 14], legs: 'wide', near: [7, 15, 3, 10], far: [14, 15, 15, 19] },
};

function put(s: ArtSprite, x: number, y: number, c: RGB): void {
  s.pix.set(x, y, c);
}

function headFront(s: ArtSprite, a: Appearance, p: Pal, hx: number, hy: number): void {
  const rows = [
    '.HHHHHH.',
    'HHHHHHHH',
    'BBMMBBBB',
    'HSSSSSSh',
    'SeSSeSSs',
    'SSSSSSss',
    '.SSSSss.',
    '..ssss..',
  ];
  drawRows(s, rows, hx, hy, p, a, false);
}

function headBack(s: ArtSprite, a: Appearance, p: Pal, hx: number, hy: number): void {
  const rows = [
    '.HHHHHH.',
    'HHHHHHHH',
    'BBBBBBBB',
    'HHHHHHHh',
    'HHHHHHhh',
    'HHHHHhhh',
    '.hHHHhh.',
    '..ssss..',
  ];
  drawRows(s, rows, hx, hy, p, a, true);
}

/** Resolve a head/torso pattern char to a color given appearance options. */
function drawRows(s: ArtSprite, rows: string[], x0: number, y0: number, p: Pal, a: Appearance, back: boolean): void {
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.') continue;
      let c: RGB | null = null;
      switch (ch) {
        case 'H': c = i < 3 && !back ? p.hairH : p.hair; break;
        case 'h': c = p.hairS; break;
        case 'S': c = i < 2 ? p.skinH : p.skin; break;
        case 's': c = p.skinS; break;
        case 'e': c = p.eye; break;
        case 'B': c = a.headband === 'none' ? p.hair : (i > 5 ? p.bandS : p.band); break;
        case 'M': c = a.headband === 'leaf' || a.headband === 'slashed' ? p.metal : a.headband === 'none' ? p.hair : p.band; break;
      }
      if (!c) continue;
      // Masks cover the face.
      if (!back && a.mask === 'anbu' && j >= 3 && j <= 7 && (ch === 'S' || ch === 's' || ch === 'e')) {
        c = ch === 'e' ? [20, 18, 24] : (i === 1 && j === 5) || (i === 6 && j === 5) ? [170, 40, 40] : ch === 's' ? [205, 200, 192] : [236, 232, 224];
      }
      if (!back && a.mask === 'cloth' && j >= 5 && j <= 7 && (ch === 'S' || ch === 's')) {
        c = ch === 's' ? shade(p.acc, -0.45) : shade(p.acc, -0.25);
      }
      put(s, x0 + i, y0 + j, c);
    }
  }
  // Slash through a missing-nin plate.
  if (a.headband === 'slashed' && !back) put(s, x0 + 3, y0 + 2, [60, 30, 30]);
}

function hairOverlay(s: ArtSprite, a: Appearance, p: Pal, hx: number, hy: number, back: boolean): void {
  const H = p.hair, h = p.hairS, L = p.hairH;
  const at = (x: number, y: number, c: RGB) => put(s, hx + x, hy + y, c);
  switch (a.hair) {
    case 'spiky':
      for (const x of [1, 3, 5, 7]) { at(x, -1, H); at(x - 1, -2 + (x % 4 === 1 ? 0 : 1), L); }
      at(0, -1, H); at(7, 0, h);
      break;
    case 'messy':
      at(1, -1, H); at(4, -1, H); at(5, -1, L); at(7, 1, h); at(-1, 2, H);
      break;
    case 'tied':
      at(3, -1, H); at(4, -1, H); at(3, -2, h); at(4, -2, H);
      break;
    case 'buns':
      for (const bx of [0, 6]) { at(bx, -1, H); at(bx + 1, -1, L); at(bx, -2, h); at(bx + 1, -2, H); }
      break;
    case 'bob':
      for (let y = 2; y <= 7; y++) { at(-1 + (y > 5 ? 1 : 0), y, H); at(8 - (y > 5 ? 1 : 0), y, h); }
      if (back) for (let y = 6; y <= 7; y++) for (let x = 1; x <= 6; x++) at(x, y, x > 4 ? h : H);
      break;
    case 'long':
      for (let y = 2; y <= 11; y++) { at(-1, y, y > 8 ? h : H); at(8, y, h); }
      if (back) for (let y = 6; y <= 11; y++) for (let x = 0; x <= 7; x++) at(x, y, x > 5 ? h : H);
      break;
    case 'ponytail':
      if (back) for (let y = 3; y <= 11; y++) { at(3, y, H); at(4, y, y > 8 ? h : H); }
      else for (let y = 2; y <= 7; y++) at(8, y, y > 5 ? h : H);
      at(4, -1, H);
      break;
    case 'buzz':
      at(0, 0, h); at(7, 0, h);
      break;
    default:
      break;
  }
  if (a.hat === 'straw') {
    for (let x = -2; x <= 9; x++) at(x, 1, [190, 160, 90]);
    for (let x = 0; x <= 7; x++) at(x, 0, [210, 180, 110]);
    for (let x = 2; x <= 5; x++) at(x, -1, [210, 180, 110]);
  }
}

function torso(s: ArtSprite, a: Appearance, p: Pal, tx: number, ty: number, back: boolean): void {
  const vest = a.vest === 'chunin';
  for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) {
    let c: RGB;
    if (j === 4) c = i > 5 ? p.accS : p.acc;                      // belt / sash
    else if (j === 5) c = i > 5 ? p.botS : p.bot;                 // hips
    else if (vest && (back || (i >= 1 && i <= 6))) {
      c = i === 0 ? p.vestH : i >= 6 ? p.vestS : p.vest;
      if (!back && j === 2 && (i === 2 || i === 5)) c = p.vestH;  // pockets
      if (!back && j === 0 && (i === 3 || i === 4)) c = p.top;    // collar gap
    } else {
      c = i === 0 ? p.topH : i >= 6 ? p.topS : p.top;
      if (!back && !vest && j === 0 && (i === 3 || i === 4)) c = p.skinS;  // neckline
    }
    put(s, tx + i, ty + j, c);
  }
  if (a.frame === 'f') { put(s, tx, ty + 3, p.o); put(s, tx + 7, ty + 3, p.o); }
}

function legs(s: ArtSprite, p: Pal, kind: Geo['legs'], baseY: number): void {
  // Two legs, 3px wide, from the hips (baseY) to the feet (CHAR_AY).
  const draw = (x: number, top: number, bottom: number, shadeSide: boolean) => {
    for (let y = top; y <= bottom; y++) {
      for (let i = 0; i < 3; i++) put(s, x + i, y, i === 2 || shadeSide ? p.botS : p.bot);
    }
    for (let i = 0; i < 3; i++) put(s, x + i, bottom + 1, p.feet);
  };
  const foot = CHAR_AY - 1;
  switch (kind) {
    case 'stand': draw(7, baseY, foot, false); draw(11, baseY, foot, true); break;
    case 'walkA': draw(6, baseY, foot, false); draw(12, baseY, foot - 2, true); break;
    case 'walkB': draw(8, baseY, foot - 2, false); draw(11, baseY, foot, true); break;
    case 'wide': draw(6, baseY, foot, false); draw(12, baseY, foot, true); break;
    case 'crouch':
      draw(6, baseY, foot, false); draw(12, baseY, foot, true);
      for (let x = 8; x <= 12; x++) put(s, x, baseY, p.botS);
      break;
  }
}

function arm(s: ArtSprite, p: Pal, x0: number, y0: number, x1: number, y1: number, near: boolean): void {
  const sleeve = near ? p.top : p.topS;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
    const hand = k === n;
    put(s, x, y, hand ? (near ? p.skin : p.skinS) : sleeve);
    if (!hand) put(s, x + (Math.abs(y1 - y0) >= Math.abs(x1 - x0) ? 1 : 0), y + (Math.abs(y1 - y0) < Math.abs(x1 - x0) ? 1 : 0), near ? p.topS : shade(p.topS, -0.1));
  }
}

export function drawCharacter(a: Appearance, pose: Pose, back: boolean): ArtSprite {
  const s = sprite(CHAR_W, CHAR_H, CHAR_AX, CHAR_AY);
  const p = palette(a);
  if (pose === 'prone') return drawProne(a, p);
  groundShadow(s, 6, 2, 90, 0, 0);
  const g = GEO[pose];
  const shadowLayer = s.pix.data.slice();
  // Clear so the outline pass only wraps the figure, then restore the shadow underneath.
  s.pix.data.fill(0);
  const [hx, hy] = g.head;
  const [tx, ty] = g.torso;

  const farArm = () => arm(s, p, g.far[0], g.far[1], g.far[2], g.far[3], false);
  const nearArm = () => arm(s, p, g.near[0], g.near[1], g.near[2], g.near[3], true);

  if (back) {
    nearArm();
  } else if (g.farBehind !== false) {
    farArm();
  }
  legs(s, p, g.legs, ty + 6);
  torso(s, a, p, tx, ty, back);
  if (back) headBack(s, a, p, hx, hy); else headFront(s, a, p, hx, hy);
  hairOverlay(s, a, p, hx, hy, back);
  if (back) farArm();
  else {
    if (g.farBehind === false) farArm();
    nearArm();
  }
  s.pix.outline(p.o);
  // Composite figure over its shadow.
  const fig = s.pix.data.slice();
  s.pix.data.set(shadowLayer);
  for (let i = 0; i < fig.length; i += 4) {
    if (fig[i + 3]) { s.pix.data[i] = fig[i]; s.pix.data[i + 1] = fig[i + 1]; s.pix.data[i + 2] = fig[i + 2]; s.pix.data[i + 3] = 255; }
  }
  return s;
}

function drawProne(a: Appearance, p: Pal): ArtSprite {
  // Lying on the ground, head to the left, seen from above-ish.
  const s = sprite(30, 14, 15, 9);
  s.pix.ellipse(s.ax + 1, s.ay, 12, 3, () => [10, 12, 20], 80);
  const fig = sprite(30, 14, 15, 9);
  const y = 4;
  // legs
  for (let x = 17; x <= 25; x++) { put(fig, x, y + 2, p.bot); put(fig, x, y + 3, p.botS); put(fig, x, y + 4, p.bot); }
  put(fig, 26, y + 2, p.feet); put(fig, 26, y + 4, p.feet);
  // torso
  for (let x = 10; x <= 16; x++) for (let k = 1; k <= 5; k++) {
    let c = k === 1 ? p.topH : k === 5 ? p.topS : p.top;
    if (a.vest === 'chunin' && k >= 2 && k <= 4) c = k === 4 ? p.vestS : p.vest;
    if (x === 16) c = p.acc;
    put(fig, x, y + k, c);
  }
  // arms
  for (let x = 11; x <= 15; x++) { put(fig, x, y, p.topS); put(fig, x, y + 6, p.topS); }
  put(fig, 16, y, p.skin); put(fig, 16, y + 6, p.skin);
  // head (top-down: hair circle with face side)
  fig.pix.ellipse(6.5, y + 3.5, 3.6, 3, (nx) => (nx > 0.3 ? p.skin : p.hair));
  if (a.headband !== 'none') for (let k = 1; k <= 5; k++) put(fig, 7, y + k, a.headband === 'leaf' ? p.metal : p.band);
  if (a.mask === 'anbu') for (let k = 2; k <= 5; k++) put(fig, 9, y + k, [236, 232, 224]);
  fig.pix.outline(p.o);
  s.pix.blit(fig.pix, 0, 0);
  return s;
}

/** Stable cache key for an appearance. */
export function appearanceKey(a: Appearance): string {
  return [a.frame, a.skin, a.hair, a.hairColor, a.eyes, a.top, a.bottom, a.accent, a.headband, a.headbandColor, a.vest ?? '', a.mask ?? '', a.hat ?? ''].join('|');
}
