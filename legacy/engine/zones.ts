/**
 * Zone detection — determines which named area the player is in.
 * Zones are checked in order — first match wins (more specific first).
 */

import { TG_OFFSET_X, TG_OFFSET_Y, TRAINING_GROUNDS_WIDTH, TRAINING_GROUNDS_HEIGHT } from '../core/constants.ts';

interface Zone {
  name: string;
  x1: number; y1: number;
  x2: number; y2: number;
}

const ZONES: Zone[] = [
  // Specific buildings first
  { name: 'Hokage Tower', x1: 58, y1: 72, x2: 74, y2: 80 },
  { name: 'Mission Desk', x1: 60, y1: 85, x2: 72, y2: 90 },
  { name: 'Academy', x1: 58, y1: 12, x2: 74, y2: 20 },
  { name: 'Academy Yard', x1: 58, y1: 21, x2: 76, y2: 29 },
  { name: 'Library', x1: 78, y1: 12, x2: 86, y2: 18 },
  { name: 'Hospital', x1: 18, y1: 82, x2: 32, y2: 100 },
  { name: 'Konoha Kitchen', x1: 62, y1: 97, x2: 70, y2: 103 },
  { name: 'Forge', x1: 128, y1: 72, x2: 136, y2: 78 },

  // Districts
  { name: 'Training Grounds', x1: TG_OFFSET_X, y1: TG_OFFSET_Y, x2: TG_OFFSET_X + TRAINING_GROUNDS_WIDTH, y2: TG_OFFSET_Y + TRAINING_GROUNDS_HEIGHT },
  { name: 'Memorial Stone', x1: 48, y1: 56, x2: 56, y2: 63 },
  { name: 'Hyuga Compound', x1: 10, y1: 8, x2: 30, y2: 18 },
  { name: 'Uchiha Compound', x1: 110, y1: 8, x2: 132, y2: 18 },
  { name: 'Government Quarter', x1: 55, y1: 72, x2: 78, y2: 96 },
  { name: 'Commercial District', x1: 55, y1: 96, x2: 90, y2: 120 },
  { name: 'Market Plaza', x1: 95, y1: 72, x2: 140, y2: 95 },
  { name: 'Residential District', x1: 10, y1: 100, x2: 52, y2: 140 },
  { name: 'Residential District', x1: 95, y1: 100, x2: 145, y2: 140 },
  { name: 'Main Gate', x1: 65, y1: 143, x2: 95, y2: 156 },
  { name: 'River Crossing', x1: 4, y1: 62, x2: 156, y2: 70 },
  { name: 'Main Avenue', x1: 74, y1: 35, x2: 79, y2: 143 },
];

export function getZoneName(x: number, y: number): string {
  for (const zone of ZONES) {
    if (x >= zone.x1 && x < zone.x2 && y >= zone.y1 && y < zone.y2) {
      return zone.name;
    }
  }
  return 'Konoha Village';
}
