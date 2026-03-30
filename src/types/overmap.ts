/**
 * Overmap types — world map nodes, edges, travel state.
 * The overmap is a non-playable visual representation of travel between locations.
 */

export interface OvermapNode {
  id: string;
  name: string;
  x: number;                  // pixel position on overmap canvas (0-800)
  y: number;
  type: 'hidden_village' | 'town' | 'outpost' | 'landmark' | 'border_post';
  nation: string;             // 'fire' | 'wind' | 'earth' | 'lightning' | 'water' | etc.
  /** Approximate km from Konoha (for travel time) */
  distanceFromKonoha: number;
  /** Biome/terrain type for mission map generation at this location */
  biome?: string;
}

export interface OvermapEdge {
  from: string;               // node ID
  to: string;                 // node ID
  /** Waypoints for curved road rendering (pixel coords on overmap) */
  waypoints: Array<{ x: number; y: number }>;
  /** Distance in km — determines travel time */
  distanceKm: number;
}

export interface OvermapTravelState {
  origin: string;             // node ID
  destination: string;        // node ID
  /** Full path of node IDs from origin to destination */
  path: string[];
  /** Current edge being traversed (index into path, 0 = first edge) */
  currentEdgeIndex: number;
  /** Progress along current edge (0.0 to 1.0) */
  progressOnEdge: number;
  /** Game time when travel started */
  gameTimeAtDeparture: number;
  /** Travel speed in km/h (default 5 for walking) */
  travelSpeedKmPerHour: number;
  /** Whether party is camped for the night */
  isCamped: boolean;
  /** Game time when camp was made */
  campStartTime: number;
  /** Total distance of this journey in km */
  totalDistanceKm: number;
  /** Distance already covered in km */
  distanceCoveredKm: number;
}

/** Terrain region for overmap rendering (colored polygon fill) */
export interface OvermapRegion {
  id: string;
  name: string;
  color: string;              // hex color for fill
  /** Polygon points (pixel coords) */
  points: Array<{ x: number; y: number }>;
  labelX: number;
  labelY: number;
}
