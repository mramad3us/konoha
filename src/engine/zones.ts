/**
 * Zone detection — determines which named area the player is in.
 */

import { TG_OFFSET_X, TG_OFFSET_Y, TRAINING_GROUNDS_WIDTH, TRAINING_GROUNDS_HEIGHT } from '../core/constants.ts';

interface Zone {
  name: string;
  x1: number; y1: number;
  x2: number; y2: number;
}

const ZONES: Zone[] = [
  { name: 'Training Grounds', x1: TG_OFFSET_X, y1: TG_OFFSET_Y, x2: TG_OFFSET_X + TRAINING_GROUNDS_WIDTH, y2: TG_OFFSET_Y + TRAINING_GROUNDS_HEIGHT },
  { name: 'Hokage Tower', x1: 68, y1: 80, x2: 88, y2: 96 },
  { name: 'Mission Desk', x1: 70, y1: 96, x2: 84, y2: 102 },
  { name: 'Academy', x1: 56, y1: 8, x2: 76, y2: 22 },
  { name: 'Academy Yard', x1: 56, y1: 22, x2: 76, y2: 30 },
  { name: 'Hospital', x1: 30, y1: 80, x2: 46, y2: 94 },
  { name: 'Market District', x1: 100, y1: 80, x2: 142, y2: 102 },
  { name: 'Konoha Kitchen', x1: 90, y1: 104, x2: 102, y2: 114 },
  { name: 'Hyuga Compound', x1: 10, y1: 4, x2: 32, y2: 16 },
  { name: 'Uchiha Compound', x1: 103, y1: 4, x2: 127, y2: 16 },
  { name: 'Residential District', x1: 18, y1: 105, x2: 55, y2: 135 },
  { name: 'Main Gate', x1: 70, y1: 143, x2: 92, y2: 157 },
  { name: 'Memorial Stone', x1: 48, y1: 30, x2: 58, y2: 38 },
  { name: 'River Crossing', x1: 4, y1: 66, x2: 156, y2: 76 },
];

/** Get the zone name for a position */
export function getZoneName(x: number, y: number): string {
  for (const zone of ZONES) {
    if (x >= zone.x1 && x < zone.x2 && y >= zone.y1 && y < zone.y2) {
      return zone.name;
    }
  }
  return 'Konoha Village';
}
