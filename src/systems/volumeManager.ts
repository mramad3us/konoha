/**
 * Central volume manager — reads settings and controls Web Audio gain nodes.
 * All audio systems check this for their volume levels.
 */

import { saveSystem } from './saveSystem.ts';
import type { GameSettings } from '../types/save.ts';
import { DEFAULT_SETTINGS } from '../types/save.ts';

let currentSettings: GameSettings = { ...DEFAULT_SETTINGS };
let loaded = false;

/** Load settings from DB and cache them */
export async function loadVolumeSettings(): Promise<void> {
  try {
    const saved = await saveSystem.loadSettings();
    // Guard against corrupted/zero values — if all volumes are 0, reset to defaults
    if (saved.masterVolume === 0 && saved.musicVolume === 0 && saved.sfxVolume === 0) {
      currentSettings = { ...DEFAULT_SETTINGS };
    } else {
      currentSettings = saved;
    }
  } catch {
    currentSettings = { ...DEFAULT_SETTINGS };
  }
  loaded = true;
}

/** Get effective master volume (0-1) */
export function getMasterVolume(): number {
  return currentSettings.masterVolume;
}

/** Get effective music volume (0-1, scaled by master) */
export function getMusicVolume(): number {
  if (!loaded) return DEFAULT_SETTINGS.musicVolume * DEFAULT_SETTINGS.masterVolume;
  return currentSettings.musicVolume * currentSettings.masterVolume;
}

/** Get effective SFX volume (0-1, scaled by master) */
export function getSfxVolume(): number {
  if (!loaded) return DEFAULT_SETTINGS.sfxVolume * DEFAULT_SETTINGS.masterVolume;
  return currentSettings.sfxVolume * currentSettings.masterVolume;
}

/** Update cached settings (called when settings screen saves) */
export function updateVolumeSettings(settings: GameSettings): void {
  currentSettings = settings;
}
