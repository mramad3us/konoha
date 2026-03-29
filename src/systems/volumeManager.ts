/**
 * Central volume manager — reads settings and controls Web Audio gain nodes.
 * All audio systems check this for their volume levels.
 */

import { saveSystem } from './saveSystem.ts';
import type { GameSettings } from '../types/save.ts';
import { DEFAULT_SETTINGS } from '../types/save.ts';

let currentSettings: GameSettings = { ...DEFAULT_SETTINGS };

/** Load settings from DB and cache them */
export async function loadVolumeSettings(): Promise<void> {
  try {
    currentSettings = await saveSystem.loadSettings();
  } catch {
    currentSettings = { ...DEFAULT_SETTINGS };
  }
}

/** Get effective master volume (0-1) */
export function getMasterVolume(): number {
  return currentSettings.masterVolume;
}

/** Get effective music volume (0-1, scaled by master) */
export function getMusicVolume(): number {
  return currentSettings.musicVolume * currentSettings.masterVolume;
}

/** Get effective SFX volume (0-1, scaled by master) */
export function getSfxVolume(): number {
  return currentSettings.sfxVolume * currentSettings.masterVolume;
}

/** Update cached settings (called when settings screen saves) */
export function updateVolumeSettings(settings: GameSettings): void {
  currentSettings = settings;
}
