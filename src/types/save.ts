export interface GameSave {
  id: string;
  slotName: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  playtime: number; // in seconds
  playerName: string;
  playerGender: 'shinobi' | 'kunoichi';
  level: number;
  zone: string;
  chapter: number;
  data: Record<string, unknown>;
}

export interface GameSettings {
  devMode: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  pixelScale: number;
  showFps: boolean;
  language: string;
  gore: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  devMode: false,
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  screenShake: true,
  pixelScale: 4,
  showFps: false,
  language: 'en',
  gore: true,
};

export interface SaveExport {
  version: string;
  exportedAt: number;
  saves: GameSave[];
}
