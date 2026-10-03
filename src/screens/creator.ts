/**
 * Character creator: a washi form beside a live sprite on a lantern-lit stage.
 */

import { h, button } from '../ui/kit.ts';
import type { Appearance } from '../ecs/components.ts';
import { HAIR_STYLES_M, HAIR_STYLES_F, HAIR_COLORS, SKIN_TONES, EYE_COLORS, LEAF } from '../content/looks.ts';
import { atlas } from '../render/atlas.ts';
import type { Pose } from '../art/characters.ts';
import { sfx } from '../audio/audio.ts';

export interface CreatorResult { name: string; frame: 'm' | 'f'; appearance: Appearance }

const HAIR_NAMES: Record<string, string> = {
  short: 'Short', spiky: 'Spiky', tied: 'Topknot', messy: 'Messy', buzz: 'Cropped', long: 'Long', bob: 'Bob', ponytail: 'Ponytail', buns: 'Buns',
};

export function renderCreator(root: HTMLElement, onDone: (r: CreatorResult) => void, onBack: () => void): () => void {
  root.innerHTML = '';
  let frame: 'm' | 'f' = 'm';
  let name = 'Hasuke';
  const a: Appearance = {
    frame: 'm', skin: 1, hair: 'spiky', hairColor: HAIR_COLORS[0], eyes: EYE_COLORS[0],
    top: LEAF.top, bottom: LEAF.bottom, accent: LEAF.accent, headband: 'leaf', headbandColor: LEAF.band, vest: null,
  };
  const screen = h('div', 'creator');
  const form = h('div', 'creator__form');
  const stage = h('div', 'creator__stage');
  const preview = document.createElement('canvas');
  preview.className = 'creator__doll';
  preview.width = 22 * 2 + 8; preview.height = 30;
  const caption = h('div', 'creator__caption');
  stage.append(preview, caption);

  const input = h('input', 'creator__name');
  input.value = name;
  input.maxLength = 16;
  input.spellcheck = false;
  input.addEventListener('input', () => { name = input.value; paintCaption(); });

  const row = (label: string, ...kids: HTMLElement[]) => h('div', 'creator__row', h('div', 'creator__label', label), h('div', 'creator__opts', ...kids));
  const pathRow = h('div', 'creator__opts');
  const hairRow = h('div', 'creator__opts');
  const swatches = (list: readonly string[], get: () => string, set: (v: string) => void) => {
    const box = h('div', 'creator__opts creator__opts--swatches');
    const draw = () => {
      box.innerHTML = '';
      for (const c of list) {
        const s = h('button', `swatch${get() === c ? ' swatch--on' : ''}`);
        s.style.background = c;
        s.title = c;
        s.addEventListener('click', () => { set(c); sfx.ui('move'); draw(); paint(); });
        box.append(s);
      }
    };
    draw();
    return box;
  };
  const drawPath = () => {
    pathRow.innerHTML = '';
    for (const [v, label] of [['m', 'Shinobi'], ['f', 'Kunoichi']] as const) {
      pathRow.append(button(label, () => {
        frame = v; a.frame = v;
        const styles = v === 'm' ? HAIR_STYLES_M : HAIR_STYLES_F;
        if (!(styles as readonly string[]).includes(a.hair)) a.hair = styles[0];
        if (name === 'Hasuke' && v === 'f') { name = 'Kasura'; input.value = name; }
        else if (name === 'Kasura' && v === 'm') { name = 'Hasuke'; input.value = name; }
        drawPath(); drawHair(); paint();
      }, `btn btn--small${frame === v ? ' btn--on' : ''}`));
    }
  };
  const drawHair = () => {
    hairRow.innerHTML = '';
    for (const st of frame === 'm' ? HAIR_STYLES_M : HAIR_STYLES_F) {
      hairRow.append(button(HAIR_NAMES[st] ?? st, () => { a.hair = st; drawHair(); paint(); }, `btn btn--small${a.hair === st ? ' btn--on' : ''}`));
    }
  };
  drawPath();
  drawHair();
  const skinRow = h('div', 'creator__opts creator__opts--swatches');
  const drawSkin = () => {
    skinRow.innerHTML = '';
    SKIN_TONES.forEach((c, i) => {
      const s = h('button', `swatch${a.skin === i ? ' swatch--on' : ''}`);
      s.style.background = c;
      s.addEventListener('click', () => { a.skin = i; sfx.ui('move'); drawSkin(); paint(); });
      skinRow.append(s);
    });
  };
  drawSkin();

  form.append(
    h('h2', 'creator__title', 'Who are you?'),
    h('p', 'creator__intro', 'A new genin of the Hidden Leaf, forehead protector still unscratched.'),
    row('Name', input),
    h('div', 'creator__row', h('div', 'creator__label', 'Path'), pathRow),
    h('div', 'creator__row', h('div', 'creator__label', 'Hair'), hairRow),
    row('Hair colour', swatches(HAIR_COLORS, () => a.hairColor, v => { a.hairColor = v; })),
    h('div', 'creator__row', h('div', 'creator__label', 'Skin'), skinRow),
    row('Eyes', swatches(EYE_COLORS, () => a.eyes, v => { a.eyes = v; })),
    row('Headband cloth', swatches(['#2a3e66', '#2a2a30', '#6a2a2a', '#3a5a3a', '#5a4a6a'], () => a.headbandColor, v => { a.headbandColor = v; })),
  );
  const begin = () => {
    const n = name.trim() || (frame === 'm' ? 'Hasuke' : 'Kasura');
    onDone({ name: n.slice(0, 16), frame, appearance: { ...a } });
  };
  form.append(h('div', 'creator__actions', button('Back', onBack, 'btn btn--ghost'), button('Begin', begin, 'btn btn--seal', 'Enter')));
  screen.append(form, stage);
  root.append(screen);

  const paintCaption = () => { caption.textContent = `${name || '…'}, genin`; };
  const poses: Array<[Pose, boolean, boolean]> = [['idle', false, false], ['walkA', false, false], ['idle', false, false], ['walkB', false, false], ['guard', false, false], ['idle', true, true], ['strike', false, true], ['idle', false, true]];
  let pi = 0;
  const paint = () => {
    const ctx = preview.getContext('2d')!;
    ctx.clearRect(0, 0, preview.width, preview.height);
    const [pose, back, mirror] = poses[pi % poses.length];
    const f = atlas.character({ ...a }, pose, back, mirror);
    ctx.drawImage(f.cv, Math.round(preview.width / 2 - f.ax), preview.height - f.h);
  };
  paint();
  paintCaption();
  const timer = window.setInterval(() => { pi++; paint(); }, 650);
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Enter') { e.preventDefault(); begin(); }
    if (e.code === 'Escape') { e.preventDefault(); onBack(); }
  };
  window.addEventListener('keydown', onKey);
  setTimeout(() => input.focus(), 50);
  return () => { clearInterval(timer); window.removeEventListener('keydown', onKey); };
}
