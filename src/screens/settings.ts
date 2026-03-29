import { createElement, staggerReveal } from '../utils/dom.ts';
import { screenManager } from '../systems/screenManager.ts';
import { saveSystem } from '../systems/saveSystem.ts';
import { updateVolumeSettings } from '../systems/volumeManager.ts';
import { sfxMenuClick } from '../systems/audioSystem.ts';
import { MENU_STAGGER_MS } from '../core/constants.ts';
import type { GameSettings } from '../types/save.ts';
import { DEFAULT_SETTINGS } from '../types/save.ts';

export async function renderSettings(container: HTMLElement): Promise<void> {
  let settings: GameSettings;
  try {
    settings = await saveSystem.loadSettings();
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  // ── Back button ──
  const backBtn = createElement('button', { className: 'back-btn' });
  backBtn.innerHTML = '<span class="back-btn__arrow">&larr;</span> Back';
  backBtn.addEventListener('click', async () => {
    sfxMenuClick();
    await saveSystem.saveSettings(settings);
    updateVolumeSettings(settings);
    screenManager.goBack();
  });
  container.appendChild(backBtn);

  // ── Title ──
  container.appendChild(createElement('h2', { className: 'section-title', text: 'Settings' }));

  // ── Settings container ──
  const settingsWrap = createElement('div', {
    className: 'settings-wrap',
  });
  settingsWrap.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-2);width:100%;max-width:480px;align-items:stretch;';

  const rows: HTMLElement[] = [];

  // Helper: create a toggle row
  function addToggle(label: string, key: keyof GameSettings): HTMLElement {
    const row = createElement('div', { className: 'setting-row' });
    row.appendChild(createElement('span', { className: 'setting-row__label', text: label }));

    const toggle = createElement('button', {
      className: `toggle ${settings[key] ? 'toggle--active' : ''}`,
    });
    const knob = createElement('div', { className: 'toggle__knob' });
    toggle.appendChild(knob);

    toggle.addEventListener('click', () => {
      (settings[key] as boolean) = !(settings[key] as boolean);
      toggle.classList.toggle('toggle--active');
    });

    row.appendChild(toggle);
    settingsWrap.appendChild(row);
    rows.push(row);
    return row;
  }

  // Helper: create a slider row
  function addSlider(label: string, key: keyof GameSettings, min: number, max: number, step: number): HTMLElement {
    const row = createElement('div', { className: 'setting-row' });

    const sliderRow = createElement('div', { className: 'slider-row' });
    sliderRow.appendChild(createElement('span', { className: 'slider-row__label', text: label }));

    const input = createElement('input', {
      className: 'slider-row__input',
      attrs: {
        type: 'range',
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(settings[key]),
      },
    });

    const valueDisplay = createElement('span', {
      className: 'slider-row__value',
      text: `${Math.round((settings[key] as number) * 100)}%`,
    });

    input.addEventListener('input', () => {
      const val = parseFloat((input as HTMLInputElement).value);
      (settings[key] as number) = val;
      valueDisplay.textContent = `${Math.round(val * 100)}%`;
    });

    sliderRow.appendChild(input);
    sliderRow.appendChild(valueDisplay);
    row.appendChild(sliderRow);
    settingsWrap.appendChild(row);
    rows.push(row);
    return row;
  }

  // ── Audio ──
  const audioHeader = createElement('div', {
    className: 'setting-row__label',
  });
  audioHeader.style.cssText = 'padding:var(--space-4) 0 var(--space-2);color:var(--color-gold);font-family:var(--font-pixel);font-size:9px;text-transform:uppercase;letter-spacing:0.12em;width:100%;max-width:480px;';
  audioHeader.textContent = '// Audio';
  settingsWrap.appendChild(audioHeader);
  rows.push(audioHeader);

  addSlider('Master Volume', 'masterVolume', 0, 1, 0.05);
  addSlider('Music', 'musicVolume', 0, 1, 0.05);
  addSlider('SFX', 'sfxVolume', 0, 1, 0.05);

  // ── Gameplay ──
  const gameplayHeader = createElement('div', {});
  gameplayHeader.style.cssText = 'padding:var(--space-4) 0 var(--space-2);color:var(--color-gold);font-family:var(--font-pixel);font-size:9px;text-transform:uppercase;letter-spacing:0.12em;width:100%;max-width:480px;';
  gameplayHeader.textContent = '// Gameplay';
  settingsWrap.appendChild(gameplayHeader);
  rows.push(gameplayHeader);

  addToggle('Screen Shake', 'screenShake');

  // ── Developer ──
  const devHeader = createElement('div', {});
  devHeader.style.cssText = 'padding:var(--space-4) 0 var(--space-2);color:var(--color-gold);font-family:var(--font-pixel);font-size:9px;text-transform:uppercase;letter-spacing:0.12em;width:100%;max-width:480px;';
  devHeader.textContent = '// Developer';
  settingsWrap.appendChild(devHeader);
  rows.push(devHeader);

  addToggle('Dev Mode', 'devMode');
  addToggle('Show FPS', 'showFps');

  container.appendChild(settingsWrap);

  // Stagger reveal
  setTimeout(() => staggerReveal(rows, MENU_STAGGER_MS), 100);
}
