/**
 * Title: a washi banner hanging over the living village at night, the camera drifting up
 * Main Street toward the Hokage Tower.
 */

import { h, seal } from '../ui/kit.ts';
import { Renderer } from '../render/renderer.ts';
import { newGame } from '../sim/campaign.ts';
import { skipTime, primeLevel } from '../sim/turn.ts';
import { GAME_VERSION, TICKS_PER_HOUR } from '../core/config.ts';
import { sfx } from '../audio/audio.ts';
import { music } from '../audio/music.ts';

export interface TitleActions {
  continueGame: (() => void) | null;
  newGame: () => void;
  load: () => void;
  settings: () => void;
}

export function renderTitle(root: HTMLElement, actions: TitleActions): () => void {
  root.innerHTML = '';
  const screen = h('div', 'title');
  const canvas = document.createElement('canvas');
  canvas.className = 'title__world';
  screen.append(canvas);

  // A demo village at night for the backdrop.
  const g = newGame('demo', 'm', undefined, 4242);
  skipTime(g, 13 * TICKS_PER_HOUR);
  primeLevel(g, g.level);
  g.level.explored.fill(1);
  g.level.visible.fill(1);
  const r = new Renderer(canvas);
  r.bare = true;
  const lv = g.level;
  lv.c.appearance.delete(lv.playerId);
  const path = [{ x: 47, y: 92 }, { x: 47, y: 70 }, { x: 47, y: 50 }, { x: 47, y: 34 }, { x: 47, y: 24 }];

  const banner = h('div', 'title__banner');
  const items: Array<[string, () => void]> = [];
  if (actions.continueGame) items.push(['Continue', actions.continueGame]);
  items.push(['New game', actions.newGame], ['Load a save', actions.load], ['Settings', actions.settings]);
  const menu = h('nav', 'title__menu');
  let sel = 0;
  const btns = items.map(([label, fn], i) => {
    const b = h('button', 'title__item', label);
    b.addEventListener('mouseenter', () => { sel = i; paint(); sfx.ui('move'); });
    b.addEventListener('click', () => { sfx.ui('confirm'); fn(); });
    menu.append(b);
    return b;
  });
  const paint = () => btns.forEach((b, i) => b.classList.toggle('title__item--sel', i === sel));
  paint();
  banner.append(
    h('div', 'title__mark', seal('LEAF', { round: false, tilt: -3 })),
    h('h1', 'title__name', 'Konoha'),
    h('div', 'title__sub', 'Path of the Shinobi'),
    h('div', 'title__rule'),
    menu,
    h('div', 'title__foot', `Version ${GAME_VERSION}. Plays fully offline.`),
  );
  screen.append(banner);
  root.append(screen);

  const fit = () => r.resize(window.innerWidth, window.innerHeight);
  fit();
  r.setZoom(3);
  window.addEventListener('resize', fit);
  let raf = 0;
  const t0 = performance.now();
  const loop = (now: number) => {
    const t = (Math.max(0, now - t0) / 1000 / 70) % 1;
    const seg = t * (path.length - 1);
    const i = Math.floor(seg), f = seg - i;
    const a = path[i], b = path[Math.min(path.length - 1, i + 1)];
    r.focus = { x: a.x + (b.x - a.x) * f + 4, y: a.y + (b.y - a.y) * f };
    r.draw(g, now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  music.title();

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyJ' || e.code === 'Tab') { sel = (sel + 1) % btns.length; paint(); sfx.ui('move'); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyK') { sel = (sel - 1 + btns.length) % btns.length; paint(); sfx.ui('move'); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF') { e.preventDefault(); btns[sel].click(); }
  };
  window.addEventListener('keydown', onKey);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', fit);
  };
}
