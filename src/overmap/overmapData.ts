/**
 * Static overmap data — nodes (towns/villages), edges (roads), terrain regions.
 * Based on the Naruto world map. Coordinates are in overmap pixel space (800×600).
 *
 * The overmap is low-detail pixel art — mostly flavor showing travel progress.
 * Distances are rough estimates for travel time calculation.
 */

import type { OvermapNode, OvermapEdge, OvermapRegion } from '../types/overmap.ts';

// ── TERRAIN REGIONS (colored fills for the world map) ──

export const OVERMAP_REGIONS: OvermapRegion[] = [
  // Major nations
  {
    id: 'fire', name: 'Land of Fire', color: '#8B3A3A',
    points: [
      { x: 420, y: 180 }, { x: 520, y: 140 }, { x: 600, y: 180 },
      { x: 620, y: 280 }, { x: 580, y: 360 }, { x: 480, y: 380 },
      { x: 400, y: 340 }, { x: 380, y: 240 },
    ],
    labelX: 490, labelY: 260,
  },
  {
    id: 'wind', name: 'Land of Wind', color: '#C4A55A',
    points: [
      { x: 200, y: 220 }, { x: 340, y: 200 }, { x: 380, y: 240 },
      { x: 400, y: 340 }, { x: 340, y: 400 }, { x: 220, y: 380 },
      { x: 160, y: 300 },
    ],
    labelX: 280, labelY: 300,
  },
  {
    id: 'earth', name: 'Land of Earth', color: '#8B7355',
    points: [
      { x: 240, y: 60 }, { x: 400, y: 40 }, { x: 480, y: 80 },
      { x: 460, y: 160 }, { x: 340, y: 200 }, { x: 240, y: 160 },
      { x: 200, y: 100 },
    ],
    labelX: 350, labelY: 110,
  },
  {
    id: 'lightning', name: 'Land of Lightning', color: '#F0E68C',
    points: [
      { x: 560, y: 40 }, { x: 680, y: 20 }, { x: 720, y: 80 },
      { x: 700, y: 160 }, { x: 620, y: 140 }, { x: 560, y: 100 },
    ],
    labelX: 640, labelY: 90,
  },
  {
    id: 'water', name: 'Land of Water', color: '#5B8C8C',
    points: [
      { x: 680, y: 200 }, { x: 740, y: 180 }, { x: 780, y: 220 },
      { x: 760, y: 280 }, { x: 700, y: 260 },
    ],
    labelX: 720, labelY: 230,
  },
  {
    id: 'rain', name: 'Land of Rain', color: '#6A6A8A',
    points: [
      { x: 380, y: 160 }, { x: 420, y: 150 }, { x: 440, y: 180 },
      { x: 420, y: 200 }, { x: 380, y: 190 },
    ],
    labelX: 405, labelY: 175,
  },
  {
    id: 'grass', name: 'Land of Grass', color: '#5A8A5A',
    points: [
      { x: 360, y: 130 }, { x: 400, y: 120 }, { x: 420, y: 150 },
      { x: 380, y: 160 }, { x: 350, y: 150 },
    ],
    labelX: 385, labelY: 142,
  },
  {
    id: 'sound', name: 'Land of Sound', color: '#6B5A8A',
    points: [
      { x: 470, y: 160 }, { x: 520, y: 140 }, { x: 540, y: 170 },
      { x: 520, y: 200 }, { x: 480, y: 190 },
    ],
    labelX: 500, labelY: 175,
  },
  {
    id: 'tea', name: 'Land of Tea', color: '#7A9A6A',
    points: [
      { x: 580, y: 360 }, { x: 640, y: 340 }, { x: 660, y: 400 },
      { x: 620, y: 420 }, { x: 570, y: 390 },
    ],
    labelX: 610, labelY: 375,
  },
  {
    id: 'rivers', name: 'Land of Rivers', color: '#4A7A9A',
    points: [
      { x: 400, y: 340 }, { x: 440, y: 320 }, { x: 460, y: 360 },
      { x: 440, y: 390 }, { x: 400, y: 370 },
    ],
    labelX: 425, labelY: 355,
  },
];

// ── NODES (towns, villages, outposts) ──

export const OVERMAP_NODES: OvermapNode[] = [
  // Hidden Villages
  { id: 'konoha', name: 'Konohagakure', x: 490, y: 240, type: 'hidden_village', nation: 'fire', distanceFromKonoha: 0, biome: 'forest' },
  { id: 'suna', name: 'Sunagakure', x: 260, y: 290, type: 'hidden_village', nation: 'wind', distanceFromKonoha: 500, biome: 'desert' },
  { id: 'iwa', name: 'Iwagakure', x: 330, y: 95, type: 'hidden_village', nation: 'earth', distanceFromKonoha: 400, biome: 'rocky' },
  { id: 'kumo', name: 'Kumogakure', x: 650, y: 70, type: 'hidden_village', nation: 'lightning', distanceFromKonoha: 600, biome: 'plains' },
  { id: 'kiri', name: 'Kirigakure', x: 730, y: 230, type: 'hidden_village', nation: 'water', distanceFromKonoha: 450, biome: 'riverside' },

  // Land of Fire towns (mission destinations)
  { id: 'tanzaku', name: 'Tanzaku Town', x: 460, y: 200, type: 'town', nation: 'fire', distanceFromKonoha: 40, biome: 'forest' },
  { id: 'otafuku', name: 'Otafuku Town', x: 520, y: 220, type: 'town', nation: 'fire', distanceFromKonoha: 35, biome: 'forest' },
  { id: 'shukuba', name: 'Shukuba Town', x: 470, y: 280, type: 'town', nation: 'fire', distanceFromKonoha: 50, biome: 'forest' },
  { id: 'kaede', name: 'Kaede Village', x: 440, y: 230, type: 'town', nation: 'fire', distanceFromKonoha: 25, biome: 'forest' },
  { id: 'nami', name: 'Nami Village', x: 560, y: 200, type: 'town', nation: 'fire', distanceFromKonoha: 60, biome: 'forest' },
  { id: 'katabami', name: 'Katabami Mine', x: 530, y: 300, type: 'outpost', nation: 'fire', distanceFromKonoha: 70, biome: 'forest' },
  { id: 'hoshi', name: 'Hoshi Outpost', x: 500, y: 320, type: 'outpost', nation: 'fire', distanceFromKonoha: 80, biome: 'forest' },
  { id: 'takumi', name: 'Takumi Village', x: 430, y: 300, type: 'town', nation: 'fire', distanceFromKonoha: 55, biome: 'forest' },
  { id: 'sora', name: 'Sora-ku District', x: 510, y: 180, type: 'town', nation: 'fire', distanceFromKonoha: 45, biome: 'forest' },

  // Border posts (Land of Fire edges)
  { id: 'fire_west_border', name: 'West Border Post', x: 400, y: 260, type: 'border_post', nation: 'fire', distanceFromKonoha: 65, biome: 'forest' },
  { id: 'fire_north_border', name: 'North Border Post', x: 470, y: 170, type: 'border_post', nation: 'fire', distanceFromKonoha: 50, biome: 'forest' },
  { id: 'fire_south_border', name: 'South Border Post', x: 500, y: 350, type: 'border_post', nation: 'fire', distanceFromKonoha: 90, biome: 'forest' },

  // Near-border towns (Land of Rivers, Grass, etc.)
  { id: 'tani', name: 'Tani Village', x: 420, y: 350, type: 'town', nation: 'rivers', distanceFromKonoha: 100, biome: 'riverside' },
  { id: 'kusa_town', name: 'Kusa Town', x: 385, y: 140, type: 'town', nation: 'grass', distanceFromKonoha: 120, biome: 'plains' },
];

/** Get node by ID */
export function getOvermapNode(id: string): OvermapNode | undefined {
  return OVERMAP_NODES.find(n => n.id === id);
}

/** Nation-to-biome fallback mapping (used when node has no explicit biome) */
const NATION_BIOME_FALLBACK: Record<string, string> = {
  fire: 'forest',
  wind: 'desert',
  earth: 'rocky',
  water: 'riverside',
  lightning: 'plains',
  grass: 'plains',
  rivers: 'riverside',
  rain: 'forest',
  sound: 'forest',
  tea: 'forest',
};

/** Get the terrain/biome type for a given node ID. Falls back to nation-based default, then 'forest'. */
export function getNodeBiome(nodeId: string): string {
  const node = getOvermapNode(nodeId);
  if (!node) return 'forest';
  if (node.biome) return node.biome;
  return NATION_BIOME_FALLBACK[node.nation] ?? 'forest';
}

/** Get all nodes within a nation */
export function getNodesByNation(nation: string): OvermapNode[] {
  return OVERMAP_NODES.filter(n => n.nation === nation);
}

/** Get nodes suitable as C-rank mission destinations (towns/outposts in Land of Fire) */
export function getCRankDestinations(): OvermapNode[] {
  return OVERMAP_NODES.filter(n =>
    n.nation === 'fire' &&
    n.type !== 'hidden_village' &&
    n.id !== 'konoha' &&
    n.distanceFromKonoha >= 20 && n.distanceFromKonoha <= 100,
  );
}

/** Get nodes suitable as B-rank mission destinations (further out, includes border posts) */
export function getBRankDestinations(): OvermapNode[] {
  return OVERMAP_NODES.filter(n =>
    n.nation === 'fire' &&
    n.type !== 'hidden_village' &&
    n.id !== 'konoha' &&
    n.distanceFromKonoha >= 40,
  );
}

/** Get nodes suitable as A-rank mission destinations (border posts + near-border towns) */
export function getARankDestinations(): OvermapNode[] {
  return OVERMAP_NODES.filter(n =>
    n.id !== 'konoha' &&
    n.distanceFromKonoha >= 50,
  );
}

// ── EDGES (roads connecting nodes) ──

export const OVERMAP_EDGES: OvermapEdge[] = [
  // Konoha hub — main roads out
  { from: 'konoha', to: 'tanzaku', distanceKm: 40, waypoints: [{ x: 475, y: 220 }] },
  { from: 'konoha', to: 'otafuku', distanceKm: 35, waypoints: [{ x: 505, y: 228 }] },
  { from: 'konoha', to: 'kaede', distanceKm: 25, waypoints: [{ x: 465, y: 235 }] },
  { from: 'konoha', to: 'shukuba', distanceKm: 50, waypoints: [{ x: 480, y: 260 }] },
  { from: 'konoha', to: 'sora', distanceKm: 45, waypoints: [{ x: 500, y: 210 }] },

  // Inner Fire Country network
  { from: 'tanzaku', to: 'kaede', distanceKm: 20, waypoints: [] },
  { from: 'tanzaku', to: 'sora', distanceKm: 30, waypoints: [{ x: 485, y: 190 }] },
  { from: 'otafuku', to: 'nami', distanceKm: 40, waypoints: [{ x: 540, y: 210 }] },
  { from: 'otafuku', to: 'sora', distanceKm: 25, waypoints: [{ x: 515, y: 200 }] },
  { from: 'shukuba', to: 'takumi', distanceKm: 35, waypoints: [{ x: 450, y: 290 }] },
  { from: 'shukuba', to: 'katabami', distanceKm: 45, waypoints: [{ x: 500, y: 290 }] },
  { from: 'shukuba', to: 'hoshi', distanceKm: 40, waypoints: [{ x: 485, y: 300 }] },
  { from: 'katabami', to: 'hoshi', distanceKm: 25, waypoints: [] },
  { from: 'takumi', to: 'fire_west_border', distanceKm: 30, waypoints: [{ x: 415, y: 280 }] },

  // To border posts
  { from: 'kaede', to: 'fire_west_border', distanceKm: 40, waypoints: [{ x: 420, y: 245 }] },
  { from: 'sora', to: 'fire_north_border', distanceKm: 30, waypoints: [{ x: 490, y: 175 }] },
  { from: 'hoshi', to: 'fire_south_border', distanceKm: 35, waypoints: [] },

  // Beyond borders (for future expansion)
  { from: 'fire_west_border', to: 'tani', distanceKm: 40, waypoints: [{ x: 410, y: 310 }] },
  { from: 'fire_north_border', to: 'kusa_town', distanceKm: 50, waypoints: [{ x: 430, y: 155 }] },
];

/**
 * Find shortest path between two nodes using Dijkstra's algorithm.
 * Returns ordered array of node IDs, or null if no path exists.
 */
export function findOvermapPath(fromId: string, toId: string): { path: string[]; totalKm: number } | null {
  // Build adjacency map
  const adj = new Map<string, Array<{ nodeId: string; distanceKm: number }>>();
  for (const node of OVERMAP_NODES) {
    adj.set(node.id, []);
  }
  for (const edge of OVERMAP_EDGES) {
    adj.get(edge.from)?.push({ nodeId: edge.to, distanceKm: edge.distanceKm });
    adj.get(edge.to)?.push({ nodeId: edge.from, distanceKm: edge.distanceKm });
  }

  // Dijkstra
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();

  for (const node of OVERMAP_NODES) {
    dist.set(node.id, Infinity);
  }
  dist.set(fromId, 0);

  while (true) {
    // Find unvisited node with smallest distance
    let minDist = Infinity;
    let minNode: string | null = null;
    for (const [nodeId, d] of dist) {
      if (!visited.has(nodeId) && d < minDist) {
        minDist = d;
        minNode = nodeId;
      }
    }
    if (minNode === null || minNode === toId) break;

    visited.add(minNode);
    const neighbors = adj.get(minNode) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) continue;
      const newDist = minDist + neighbor.distanceKm;
      if (newDist < (dist.get(neighbor.nodeId) ?? Infinity)) {
        dist.set(neighbor.nodeId, newDist);
        prev.set(neighbor.nodeId, minNode);
      }
    }
  }

  // Reconstruct path
  if (!prev.has(toId) && fromId !== toId) return null;

  const path: string[] = [];
  let current: string | undefined = toId;
  while (current !== undefined) {
    path.unshift(current);
    current = prev.get(current);
  }

  return { path, totalKm: dist.get(toId) ?? 0 };
}

/**
 * Get the edge connecting two adjacent nodes (for road waypoint rendering).
 */
export function getEdge(fromId: string, toId: string): OvermapEdge | undefined {
  return OVERMAP_EDGES.find(e =>
    (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId),
  );
}
