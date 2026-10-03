import { createElement, staggerReveal } from '../utils/dom.ts';
import { screenManager } from '../systems/screenManager.ts';
import { saveSystem } from '../systems/saveSystem.ts';
import { SCROLL_SVG } from '../assets/sprites/pixelArt.ts';
import { MENU_STAGGER_MS } from '../core/constants.ts';
import { formatPlaytime, formatDate } from '../utils/time.ts';
import { setActiveSaveId } from '../engine/session.ts';
import { sfxMenuClick } from '../systems/audioSystem.ts';
import { showConfirm } from '../components/confirmDialog.ts';
import type { GameSave } from '../types/save.ts';

export async function renderLoadGame(container: HTMLElement): Promise<void> {
  // ── Back button ──
  const backBtn = createElement('button', { className: 'back-btn' });
  backBtn.innerHTML = '<span class="back-btn__arrow">&larr;</span> Back';
  backBtn.addEventListener('click', () => { sfxMenuClick(); screenManager.goBack(); });
  container.appendChild(backBtn);

  // ── Title ──
  container.appendChild(createElement('h2', { className: 'section-title', text: 'Load Game' }));

  // ── Actions bar (import/export) ──
  const actionsBar = createElement('div', {});
  actionsBar.style.cssText = 'display:flex;gap:var(--space-3);margin-bottom:var(--space-5);';

  const exportBtn = createElement('button', { className: 'save-card__action', text: 'Export All' });
  exportBtn.addEventListener('click', async () => {
    try {
      const json = await saveSystem.exportSaves();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `konoha-saves-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  });
  actionsBar.appendChild(exportBtn);

  const importBtn = createElement('button', { className: 'save-card__action', text: 'Import' });
  const fileInput = createElement('input', {
    className: 'file-input-hidden',
    attrs: { type: 'file', accept: '.json' },
  });

  fileInput.addEventListener('change', async () => {
    const files = (fileInput as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const text = await file.text();
      const count = await saveSystem.importSaves(text);
      // Re-render the screen to show new saves
      if (count > 0) {
        container.innerHTML = '';
        await renderLoadGame(container);
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
  });

  importBtn.addEventListener('click', () => (fileInput as HTMLInputElement).click());
  actionsBar.appendChild(importBtn);
  actionsBar.appendChild(fileInput);
  container.appendChild(actionsBar);

  // ── Save list ──
  const saves = await saveSystem.getAllSaves();

  if (saves.length === 0) {
    const emptyState = createElement('div', { className: 'empty-state' });
    const emptyIcon = createElement('div', { className: 'empty-state__icon' });
    emptyIcon.innerHTML = SCROLL_SVG;
    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(createElement('div', { className: 'empty-state__text', text: 'No saved games found' }));
    emptyState.appendChild(createElement('div', {
      className: 'empty-state__text',
      text: 'Begin a new journey to create your first save',
    }));
    emptyState.style.opacity = '0';
    container.appendChild(emptyState);
    setTimeout(() => {
      emptyState.style.transition = 'opacity 0.5s';
      emptyState.style.opacity = '1';
    }, 200);
    return;
  }

  const savesList = createElement('div', {});
  savesList.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-3);width:100%;max-width:520px;max-height:60vh;overflow-y:auto;padding-right:var(--space-2);';

  const cards: HTMLElement[] = [];

  function renderSaveCard(save: GameSave): HTMLElement {
    const card = createElement('div', { className: 'save-card' });

    const icon = createElement('div', {});
    icon.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;color:var(--color-scroll-dark);flex-shrink:0;';
    icon.innerHTML = SCROLL_SVG;
    card.appendChild(icon);

    const info = createElement('div', { className: 'save-card__info' });
    info.appendChild(createElement('div', { className: 'save-card__name', text: save.slotName }));

    const details = createElement('div', { className: 'save-card__details' });
    details.appendChild(createElement('span', { text: `Lv.${save.level}` }));
    details.appendChild(createElement('span', { text: save.zone }));
    details.appendChild(createElement('span', { text: formatPlaytime(save.playtime) }));
    details.appendChild(createElement('span', { text: formatDate(save.updatedAt) }));
    info.appendChild(details);
    card.appendChild(info);

    const actions = createElement('div', { className: 'save-card__actions' });

    const loadBtn = createElement('button', { className: 'save-card__action', text: 'Load' });
    loadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setActiveSaveId(save.id);
      screenManager.navigateTo('game');
    });

    const deleteBtn = createElement('button', {
      className: 'save-card__action save-card__action--delete',
      text: 'Delete',
    });
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await showConfirm({
        title: 'Delete Save',
        message: `Permanently delete "${save.slotName}"? This cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
      });
      if (confirmed) {
        await saveSystem.deleteSave(save.id);
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => card.remove(), 300);
      }
    });

    actions.appendChild(loadBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    card.addEventListener('click', () => {
      setActiveSaveId(save.id);
      screenManager.navigateTo('game');
    });

    return card;
  }

  for (const save of saves) {
    const card = renderSaveCard(save);
    savesList.appendChild(card);
    cards.push(card);
  }

  container.appendChild(savesList);

  setTimeout(() => staggerReveal(cards, MENU_STAGGER_MS), 100);
}
