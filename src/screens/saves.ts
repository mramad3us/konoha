/**
 * Save list: continue, export, delete; import a .json save.
 */

import { h, button } from '../ui/kit.ts';
import { listSaves, deleteSave, readSave, exportSave, importSave, writeSave, newSlotId, type SlotInfo } from '../ui/storage.ts';
import { SAVE_VERSION } from '../core/config.ts';

function ago(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hours ago`;
  return new Date(t).toLocaleDateString();
}

function playtime(sec: number): string {
  const hrs = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return hrs ? `${hrs}h ${m}m played` : `${m}m played`;
}

export function renderSaves(root: HTMLElement, onLoad: (id: string) => void, onBack: () => void): () => void {
  root.innerHTML = '';
  const screen = h('div', 'saves');
  const panel = h('div', 'saves__panel');
  const list = h('div', 'saves__list');
  const status = h('div', 'saves__status');
  panel.append(h('h2', 'saves__title', 'Saved journeys'), list, status, h('div', 'saves__actions',
    button('Back', onBack, 'btn btn--ghost'),
    button('Import a save file', async () => {
      const data = await importSave();
      if (!data) { status.textContent = 'That file isn\'t a Konoha save.'; return; }
      await writeSave(newSlotId(), data);
      status.textContent = `Imported ${data.meta.name}.`;
      void draw();
    }, 'btn'),
  ));
  screen.append(panel);
  root.append(screen);

  const row = (s: SlotInfo) => {
    const ok = s.version === SAVE_VERSION;
    const r = h('div', `save${ok ? '' : ' save--old'}`,
      h('div', 'save__name', s.meta.name),
      h('div', 'save__meta', `${s.meta.rank[0].toUpperCase()}${s.meta.rank.slice(1)}, day ${s.meta.day}, ${s.meta.location}`),
      h('div', 'save__meta save__meta--dim', `${s.meta.ryo} ryo, ${playtime(s.meta.playSeconds)}, saved ${ago(s.meta.savedAt)}`),
    );
    const acts = h('div', 'save__acts');
    if (ok) acts.append(button('Continue', () => onLoad(s.id), 'btn btn--small btn--seal'));
    else acts.append(h('span', 'save__warn', 'Made by an older version of the game.'));
    acts.append(button('Export', async () => { const d = await readSave(s.id); if (d) exportSave(d); }, 'btn btn--small'));
    acts.append(button('Delete', async () => {
      if (r.dataset.confirm !== '1') { r.dataset.confirm = '1'; (acts.lastChild as HTMLElement).querySelector('.btn__label')!.textContent = 'Delete for good?'; return; }
      await deleteSave(s.id);
      void draw();
    }, 'btn btn--small btn--ghost'));
    r.append(acts);
    return r;
  };

  const draw = async () => {
    list.innerHTML = '';
    const saves = await listSaves();
    if (!saves.length) list.append(h('p', 'saves__empty', 'No saved journeys yet. Start a new game from the title screen.'));
    for (const s of saves) list.append(row(s));
  };
  void draw();
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); onBack(); } };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
