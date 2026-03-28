import { DB_NAME, DB_VERSION, DB_STORE_NAME, DB_SETTINGS_STORE, LOCAL_STORAGE_KEYS, GAME_VERSION } from '../core/constants.ts';
import type { GameSave, GameSettings, SaveExport } from '../types/save.ts';
import { DEFAULT_SETTINGS } from '../types/save.ts';

class SaveSystem {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Initialize the IndexedDB connection */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
          const store = db.createObjectStore(DB_STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('slotName', 'slotName', { unique: false });
        }
        if (!db.objectStoreNames.contains(DB_SETTINGS_STORE)) {
          db.createObjectStore(DB_SETTINGS_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
    });

    return this.initPromise;
  }

  private getDb(): IDBDatabase {
    if (!this.db) throw new Error('SaveSystem not initialized. Call init() first.');
    return this.db;
  }

  /** Save a game state */
  async save(save: GameSave): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DB_STORE_NAME);
      save.updatedAt = Date.now();
      save.version = GAME_VERSION;
      store.put(save);
      tx.oncomplete = () => {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_SAVE_ID, save.id);
        resolve();
      };
      tx.onerror = () => reject(new Error(`Save failed: ${tx.error?.message}`));
    });
  }

  /** Load a specific save by ID */
  async load(id: string): Promise<GameSave | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_NAME, 'readonly');
      const store = tx.objectStore(DB_STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(new Error(`Load failed: ${request.error?.message}`));
    });
  }

  /** Get all saves sorted by most recently updated */
  async getAllSaves(): Promise<GameSave[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_NAME, 'readonly');
      const store = tx.objectStore(DB_STORE_NAME);
      const index = store.index('updatedAt');
      const request = index.openCursor(null, 'prev');
      const saves: GameSave[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          saves.push(cursor.value as GameSave);
          cursor.continue();
        } else {
          resolve(saves);
        }
      };
      request.onerror = () => reject(new Error(`GetAll failed: ${request.error?.message}`));
    });
  }

  /** Delete a save by ID */
  async deleteSave(id: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DB_STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => {
        const lastId = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_SAVE_ID);
        if (lastId === id) {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_SAVE_ID);
        }
        resolve();
      };
      tx.onerror = () => reject(new Error(`Delete failed: ${tx.error?.message}`));
    });
  }

  /** Get the ID of the last save */
  getLastSaveId(): string | null {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_SAVE_ID);
  }

  /** Get the most recent save */
  async getLastSave(): Promise<GameSave | null> {
    const id = this.getLastSaveId();
    if (!id) return null;
    return this.load(id);
  }

  /** Check if a continue save exists */
  async hasContinueSave(): Promise<boolean> {
    const save = await this.getLastSave();
    return save !== null;
  }

  /** Export all saves as JSON */
  async exportSaves(): Promise<string> {
    const saves = await this.getAllSaves();
    const exportData: SaveExport = {
      version: GAME_VERSION,
      exportedAt: Date.now(),
      saves,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /** Import saves from JSON string. Returns count of imported saves. */
  async importSaves(jsonString: string): Promise<number> {
    let data: SaveExport;
    try {
      data = JSON.parse(jsonString) as SaveExport;
    } catch {
      throw new Error('Invalid JSON format');
    }

    if (!data.saves || !Array.isArray(data.saves)) {
      throw new Error('Invalid save file: missing saves array');
    }

    if (!data.version) {
      throw new Error('Invalid save file: missing version');
    }

    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DB_STORE_NAME);
      let count = 0;

      for (const save of data.saves) {
        if (save.id && save.playerName) {
          store.put(save);
          count++;
        }
      }

      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(new Error(`Import failed: ${tx.error?.message}`));
    });
  }

  /** Load settings */
  async loadSettings(): Promise<GameSettings> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(DB_SETTINGS_STORE);
      const request = store.get('settings');
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? { ...DEFAULT_SETTINGS, ...result.value } : { ...DEFAULT_SETTINGS });
      };
      request.onerror = () => reject(new Error(`Settings load failed: ${request.error?.message}`));
    });
  }

  /** Save settings */
  async saveSettings(settings: GameSettings): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_SETTINGS_STORE, 'readwrite');
      const store = tx.objectStore(DB_SETTINGS_STORE);
      store.put({ key: 'settings', value: settings });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`Settings save failed: ${tx.error?.message}`));
    });
  }
}

/** Singleton save system instance */
export const saveSystem = new SaveSystem();
