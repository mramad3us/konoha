/**
 * The Land of Fire as the remaster knows it: Konohagakure and the places missions send you.
 * Map coordinates are in overmap units (0–320 × 0–200). Distances in km by road.
 */

import type { Biome } from '../world/gen/mission.ts';

export interface Place {
  id: string;
  name: string;
  kind: 'village' | 'town' | 'woods' | 'outpost' | 'ruin' | 'pass' | 'shrine' | 'ford';
  x: number;
  y: number;
  km: number;
  biome: Biome;
  /** Typical mission ranks found here. */
  ranks: ReadonlyArray<'C' | 'B' | 'A'>;
  blurb: string;
}

export const PLACES: Place[] = [
  { id: 'konoha', name: 'Konohagakure', kind: 'village', x: 160, y: 100, km: 0, biome: 'forest', ranks: [], blurb: 'The Village Hidden in the Leaves.' },
  { id: 'kusagaya', name: 'Kusagaya Woods', kind: 'woods', x: 128, y: 78, km: 16, biome: 'forest', ranks: ['C'], blurb: 'Old-growth forest along the north road. Bandits like the cover.' },
  { id: 'hinoki', name: 'Hinoki Crossing', kind: 'ford', x: 196, y: 84, km: 18, biome: 'riverside', ranks: ['C'], blurb: 'A ferry town where the trade road meets the Hinoki river.' },
  { id: 'mizuhara', name: 'Mizuhara Paddies', kind: 'town', x: 182, y: 130, km: 24, biome: 'plains', ranks: ['C'], blurb: 'Rice terraces and farming hamlets, rich and poorly guarded.' },
  { id: 'akatsuchi', name: 'Akatsuchi Quarry', kind: 'outpost', x: 112, y: 122, km: 28, biome: 'rocky', ranks: ['C', 'B'], blurb: 'A red-clay quarry. Half the crews are honest.' },
  { id: 'shiragawa', name: 'Shiragawa Ford', kind: 'ford', x: 226, y: 112, km: 34, biome: 'riverside', ranks: ['C', 'B'], blurb: 'Shallow white-water ford on the eastern trade route.' },
  { id: 'kiriyama', name: 'Kiriyama Shrine', kind: 'shrine', x: 94, y: 52, km: 38, biome: 'forest', ranks: ['B'], blurb: 'A mountain shrine, abandoned since the last war.' },
  { id: 'hayate', name: 'Hayate Plains', kind: 'town', x: 238, y: 60, km: 44, biome: 'plains', ranks: ['B'], blurb: 'Windswept grassland and horse ranches.' },
  { id: 'tsurugi', name: 'Tsurugi Pass', kind: 'pass', x: 64, y: 94, km: 52, biome: 'rocky', ranks: ['B', 'A'], blurb: 'The western mountain pass toward the border.' },
  { id: 'kurogane', name: 'Kurogane Mines', kind: 'outpost', x: 92, y: 158, km: 58, biome: 'rocky', ranks: ['B', 'A'], blurb: 'Iron mines dug deep into the southern hills.' },
  { id: 'watchtower', name: 'Old Northern Watchtower', kind: 'ruin', x: 168, y: 26, km: 62, biome: 'forest', ranks: ['A'], blurb: 'A burned watchtower on the northern border.' },
  { id: 'kawabe', name: 'Kawabe Delta', kind: 'town', x: 268, y: 152, km: 70, biome: 'riverside', ranks: ['A'], blurb: 'Marsh villages at the river mouth, far from any help.' },
];

export function place(id: string): Place {
  const p = PLACES.find(q => q.id === id);
  if (!p) throw new Error(`Unknown place ${id}`);
  return p;
}

/** Shinobi travel speed (tree-running), km per hour. */
export const TRAVEL_KMH = 12;
