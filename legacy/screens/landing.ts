import { GAME_TITLE, GAME_SUBTITLE, GAME_VERSION, MENU_STAGGER_MS } from '../core/constants.ts';
import { LEAF_SYMBOL_SVG, KUNAI_SVG, SEPARATOR_SVG, HEADBAND_SVG } from '../assets/sprites/pixelArt.ts';
import { screenManager } from '../systems/screenManager.ts';
import { saveSystem } from '../systems/saveSystem.ts';
import { createElement, staggerReveal } from '../utils/dom.ts';
import { createSmokePuff } from '../components/smokeEffect.ts';
import { setActiveSaveId } from '../engine/session.ts';
import { sfxMenuClick } from '../systems/audioSystem.ts';

export async function renderLanding(container: HTMLElement): Promise<void> {
  // Check for continue save
  const hasContinue = await saveSystem.hasContinueSave();

  // ── Ambient particles ──
  const particles = createElement('div', { className: 'landing__particles' });
  for (let i = 0; i < 12; i++) {
    const p = createElement('div', { className: 'landing__particle' });
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDuration = `${6 + Math.random() * 8}s`;
    p.style.animationDelay = `${Math.random() * 6}s`;
    p.style.width = `${2 + Math.random() * 4}px`;
    p.style.height = p.style.width;
    particles.appendChild(p);
  }
  container.appendChild(particles);

  // ── Headband decoration ──
  const headband = createElement('div', { className: 'landing__headband' });
  headband.innerHTML = HEADBAND_SVG;
  container.appendChild(headband);

  // ── Decorative kunai ──
  const decoLeft = createElement('div', { className: 'landing__deco-left' });
  decoLeft.innerHTML = KUNAI_SVG;
  container.appendChild(decoLeft);

  const decoRight = createElement('div', { className: 'landing__deco-right' });
  decoRight.innerHTML = KUNAI_SVG;
  container.appendChild(decoRight);

  // ── Logo Area ──
  const logoArea = createElement('div', { className: 'landing__logo-area' });

  const symbol = createElement('div', { className: 'landing__symbol' });
  symbol.innerHTML = LEAF_SYMBOL_SVG;
  logoArea.appendChild(symbol);

  logoArea.appendChild(
    createElement('h1', { className: 'landing__title', text: GAME_TITLE })
  );

  logoArea.appendChild(
    createElement('div', { className: 'landing__subtitle', text: GAME_SUBTITLE })
  );

  container.appendChild(logoArea);

  // ── Separator ──
  const separator = createElement('div', { className: 'landing__separator' });
  separator.innerHTML = SEPARATOR_SVG;
  container.appendChild(separator);

  // ── Menu ──
  const menu = createElement('nav', { className: 'landing__menu' });

  const menuItems: Array<{
    label: string;
    icon: string;
    action: () => void;
    primary?: boolean;
    disabled?: boolean;
    hint?: string;
  }> = [];

  if (hasContinue) {
    menuItems.push({
      label: 'Continue',
      icon: KUNAI_SVG,
      hint: 'Last save',
      primary: true,
      action: async () => {
        const lastSave = await saveSystem.getLastSave();
        if (lastSave) {
          setActiveSaveId(lastSave.id);
          screenManager.navigateTo('game');
        }
      },
    });
  }

  menuItems.push({
    label: 'New Game',
    icon: KUNAI_SVG,
    primary: !hasContinue,
    action: () => {
      const btn = menu.querySelector('.menu-btn--new-game');
      if (btn) createSmokePuff(container, btn.getBoundingClientRect().x + 160, btn.getBoundingClientRect().y + 12);
      screenManager.navigateTo('newGame');
    },
  });

  menuItems.push({
    label: 'Load Game',
    icon: KUNAI_SVG,
    action: () => screenManager.navigateTo('loadGame'),
  });

  menuItems.push({
    label: 'Settings',
    icon: KUNAI_SVG,
    action: () => screenManager.navigateTo('settings'),
  });

  const buttons: HTMLElement[] = [];

  menuItems.forEach((item, _idx) => {
    const btn = createElement('button', {
      className: `menu-btn ${item.primary ? 'menu-btn--primary' : ''} menu-btn--${item.label.toLowerCase().replace(/\s/g, '-')}`,
    });
    if (item.disabled) btn.disabled = true;

    const icon = createElement('span', { className: 'menu-btn__icon' });
    icon.innerHTML = item.icon;
    btn.appendChild(icon);

    btn.appendChild(createElement('span', { className: 'menu-btn__text', text: item.label }));

    if (item.hint) {
      btn.appendChild(createElement('span', { className: 'menu-btn__hint', text: item.hint }));
    }

    btn.addEventListener('click', () => { sfxMenuClick(); item.action(); });
    menu.appendChild(btn);
    buttons.push(btn);
  });

  container.appendChild(menu);

  // Stagger animate menu items
  const staggerStart = 1400; // after logo animations
  setTimeout(() => {
    staggerReveal(buttons, MENU_STAGGER_MS);
  }, staggerStart);

  // ── Blood line ──
  container.appendChild(createElement('div', { className: 'landing__blood-line' }));

  // ── Version stamp ──
  container.appendChild(
    createElement('div', { className: 'version-stamp', text: `v${GAME_VERSION}` })
  );
}
