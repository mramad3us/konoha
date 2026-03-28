import { createElement, staggerReveal } from '../utils/dom.ts';
import { screenManager } from '../systems/screenManager.ts';
import { saveSystem } from '../systems/saveSystem.ts';
import { KUNAI_SVG, SHURIKEN_SVG } from '../assets/sprites/pixelArt.ts';
import { MENU_STAGGER_MS, GAME_VERSION } from '../core/constants.ts';
import { generateSaveId } from '../utils/id.ts';
import { createSmokePuff } from '../components/smokeEffect.ts';
import type { GameSave } from '../types/save.ts';

export async function renderNewGame(container: HTMLElement): Promise<void> {
  let playerName = '';
  let playerGender: 'shinobi' | 'kunoichi' = 'shinobi';

  // ── Back button ──
  const backBtn = createElement('button', { className: 'back-btn' });
  backBtn.innerHTML = '<span class="back-btn__arrow">&larr;</span> Back';
  backBtn.addEventListener('click', () => screenManager.goBack());
  container.appendChild(backBtn);

  // ── Title ──
  container.appendChild(createElement('h2', { className: 'section-title', text: 'New Game' }));

  const form = createElement('div', { className: 'new-game-form' });
  form.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-5);width:100%;max-width:420px;align-items:stretch;';

  const rows: HTMLElement[] = [];

  // ── Name input ──
  const nameRow = createElement('div', { className: 'setting-row' });
  nameRow.style.cssText = 'flex-direction:column;align-items:stretch;gap:var(--space-2);';
  nameRow.appendChild(createElement('label', {
    className: 'setting-row__label',
    text: 'Shinobi Name',
  }));

  const nameInput = createElement('input', {
    className: 'name-input',
    attrs: { type: 'text', placeholder: 'Enter your name...', maxlength: '24' },
  });
  nameInput.style.cssText = `
    font-family: var(--font-pixel);
    font-size: 11px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg-surface);
    border: 1px solid var(--color-ink-faint);
    color: var(--color-ink);
    transition: border-color var(--transition-fast);
    width: 100%;
  `;
  nameInput.addEventListener('focus', () => { nameInput.style.borderColor = 'var(--color-blood)'; });
  nameInput.addEventListener('blur', () => { nameInput.style.borderColor = 'var(--color-ink-faint)'; });
  nameInput.addEventListener('input', () => {
    playerName = (nameInput as HTMLInputElement).value.trim();
    startBtn.disabled = playerName.length === 0;
  });
  nameRow.appendChild(nameInput);
  form.appendChild(nameRow);
  rows.push(nameRow);

  // ── Gender selection ──
  const genderRow = createElement('div', { className: 'setting-row' });
  genderRow.style.cssText = 'flex-direction:column;align-items:stretch;gap:var(--space-3);';
  genderRow.appendChild(createElement('label', {
    className: 'setting-row__label',
    text: 'Path',
  }));

  const genderBtns = createElement('div', {});
  genderBtns.style.cssText = 'display:flex;gap:var(--space-3);';

  function createGenderBtn(label: string, value: 'shinobi' | 'kunoichi', icon: string): HTMLElement {
    const btn = createElement('button', {});
    btn.style.cssText = `
      flex:1;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:var(--space-2);
      padding:var(--space-4);
      background:var(--color-bg-elevated);
      border:2px solid ${value === playerGender ? 'var(--color-blood)' : 'var(--color-bg-hover)'};
      cursor:pointer;
      transition: border-color var(--transition-fast), background var(--transition-fast);
    `;

    const iconEl = createElement('div', {});
    iconEl.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;color:var(--color-steel);';
    iconEl.innerHTML = icon;
    btn.appendChild(iconEl);

    btn.appendChild(createElement('span', {
      className: 'text-pixel text-xs',
      text: label,
    }));

    btn.addEventListener('click', () => {
      playerGender = value;
      // Update visual state
      genderBtns.querySelectorAll('button').forEach(b => {
        (b as HTMLElement).style.borderColor = 'var(--color-bg-hover)';
      });
      btn.style.borderColor = 'var(--color-blood)';
    });

    return btn;
  }

  genderBtns.appendChild(createGenderBtn('Shinobi', 'shinobi', KUNAI_SVG));
  genderBtns.appendChild(createGenderBtn('Kunoichi', 'kunoichi', SHURIKEN_SVG));
  genderRow.appendChild(genderBtns);
  form.appendChild(genderRow);
  rows.push(genderRow);

  // ── Start button ──
  const startBtn = createElement('button', {
    className: 'menu-btn menu-btn--primary',
  });
  startBtn.style.cssText += 'justify-content:center;margin-top:var(--space-4);';
  startBtn.disabled = true;

  const startIcon = createElement('span', { className: 'menu-btn__icon' });
  startIcon.innerHTML = KUNAI_SVG;
  startBtn.appendChild(startIcon);
  startBtn.appendChild(createElement('span', { className: 'menu-btn__text', text: 'Begin Journey' }));

  startBtn.addEventListener('click', async () => {
    if (!playerName) return;

    createSmokePuff(container, container.clientWidth / 2, container.clientHeight / 2, 10);

    const newSave: GameSave = {
      id: generateSaveId(),
      slotName: `${playerName}'s Journey`,
      version: GAME_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      playtime: 0,
      playerName,
      playerGender,
      level: 1,
      zone: 'Hidden Leaf Village',
      chapter: 1,
      data: {},
    };

    await saveSystem.save(newSave);
    // For now, go back to landing. Later this will navigate to the game.
    console.log('[DEV] New game created:', newSave.id);
    screenManager.navigateTo('landing');
  });

  form.appendChild(startBtn);
  rows.push(startBtn);

  container.appendChild(form);

  setTimeout(() => staggerReveal(rows, MENU_STAGGER_MS), 100);
}
