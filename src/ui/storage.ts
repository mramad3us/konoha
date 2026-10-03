/**
 * Save slots in IndexedDB, settings in localStorage, JSON export/import.
 */

import type { SaveData, SaveMeta } from '../sim/save.ts';

const DB = 'konoha-remaster';
const STORE = 'saves';
export const AUTOSAVE = 'autosave';

export interface SlotInfo { id: string; meta: SaveMeta; version: number }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function writeSave(id: string, data: SaveData): Promise<void> {
  await tx('readwrite', s => s.put(data, id));
  try { localStorage.setItem('konoha.last', id); } catch { /* storage may be unavailable */ }
}

export async function readSave(id: string): Promise<SaveData | null> {
  return (await tx<SaveData | undefined>('readonly', s => s.get(id))) ?? null;
}

export async function deleteSave(id: string): Promise<void> {
  await tx('readwrite', s => s.delete(id));
}

export async function listSaves(): Promise<SlotInfo[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const out: SlotInfo[] = [];
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) { resolve(out.sort((a, b) => b.meta.savedAt - a.meta.savedAt)); return; }
      const v = c.value as SaveData;
      if (v?.meta) out.push({ id: String(c.key), meta: v.meta, version: v.version });
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export function lastSaveId(): string | null {
  try { return localStorage.getItem('konoha.last'); } catch { return null; }
}

export function newSlotId(): string {
  return `slot-${Date.now().toString(36)}`;
}

export function exportSave(data: SaveData): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const safe = data.meta.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  a.download = `konoha-${safe}-day${data.meta.day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function importSave(): Promise<SaveData | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) { resolve(null); return; }
      try {
        const data = JSON.parse(await f.text()) as SaveData;
        resolve(data?.meta && data.levels ? data : null);
      } catch { resolve(null); }
    };
    input.click();
  });
}

// ── Settings ──

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  zoom: number;
  cones: 'sneak' | 'always' | 'never';
}

const DEFAULTS: Settings = { master: 0.8, music: 0.5, sfx: 0.8, zoom: 3, cones: 'sneak' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('konoha.settings');
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem('konoha.settings', JSON.stringify(s)); } catch { /* ignore */ }
}
