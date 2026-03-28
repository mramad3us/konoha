/**
 * Isometric tile sprites — 48x24 viewBox (diamond shape).
 * Diamond vertices: (24,0) top, (48,12) right, (24,24) bottom, (0,12) left.
 * Each pixel is a 1x1 rect in the SVG coordinate system.
 */

/** Grass variant 1 — base green with subtle dirt flecks */
export const TILE_GRASS1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  <polygon points="24,0 48,12 24,24 0,12" fill="#3a7a28"/>
  <polygon points="24,1 47,12 24,23 1,12" fill="#3d8030"/>
  <rect x="10" y="8" width="1" height="1" fill="#4a9432" opacity="0.7"/>
  <rect x="30" y="6" width="1" height="1" fill="#4a9432" opacity="0.7"/>
  <rect x="20" y="14" width="1" height="1" fill="#2d5a1e" opacity="0.5"/>
  <rect x="35" y="10" width="1" height="1" fill="#4a9432" opacity="0.6"/>
  <rect x="15" y="11" width="1" height="1" fill="#2d5a1e" opacity="0.4"/>
  <rect x="28" y="15" width="1" height="1" fill="#6b5b3a" opacity="0.3"/>
</svg>`;

/** Grass variant 2 — slightly darker, more dirt */
export const TILE_GRASS2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  <polygon points="24,0 48,12 24,24 0,12" fill="#357024"/>
  <polygon points="24,1 47,12 24,23 1,12" fill="#397828"/>
  <rect x="8" y="7" width="1" height="1" fill="#6b5b3a" opacity="0.4"/>
  <rect x="22" y="5" width="1" height="1" fill="#4a9432" opacity="0.6"/>
  <rect x="36" y="11" width="1" height="1" fill="#2d5a1e" opacity="0.5"/>
  <rect x="14" y="13" width="1" height="1" fill="#6b5b3a" opacity="0.3"/>
  <rect x="32" y="8" width="1" height="1" fill="#4a9432" opacity="0.5"/>
  <rect x="18" y="10" width="2" height="1" fill="#6b5b3a" opacity="0.25"/>
  <rect x="26" y="16" width="1" height="1" fill="#2d5a1e" opacity="0.4"/>
</svg>`;

/** Grass variant 3 — lighter, more lush */
export const TILE_GRASS3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  <polygon points="24,0 48,12 24,24 0,12" fill="#408a30"/>
  <polygon points="24,1 47,12 24,23 1,12" fill="#449035"/>
  <rect x="12" y="9" width="1" height="1" fill="#4a9432" opacity="0.8"/>
  <rect x="25" y="7" width="1" height="1" fill="#56a03e" opacity="0.7"/>
  <rect x="33" y="13" width="1" height="1" fill="#3a7a28" opacity="0.5"/>
  <rect x="17" y="12" width="1" height="1" fill="#56a03e" opacity="0.6"/>
  <rect x="38" y="10" width="1" height="1" fill="#3a7a28" opacity="0.4"/>
</svg>`;

/** Dirt path */
export const TILE_DIRT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  <polygon points="24,0 48,12 24,24 0,12" fill="#8B7355"/>
  <polygon points="24,1 47,12 24,23 1,12" fill="#937B5D"/>
  <rect x="10" y="8" width="1" height="1" fill="#A0896B" opacity="0.5"/>
  <rect x="28" y="6" width="1" height="1" fill="#7A6548" opacity="0.5"/>
  <rect x="20" y="13" width="1" height="1" fill="#A0896B" opacity="0.4"/>
  <rect x="35" y="11" width="1" height="1" fill="#7A6548" opacity="0.3"/>
  <rect x="16" y="10" width="2" height="1" fill="#A0896B" opacity="0.3"/>
</svg>`;

/** Stone floor */
export const TILE_STONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  <polygon points="24,0 48,12 24,24 0,12" fill="#606870"/>
  <polygon points="24,1 47,12 24,23 1,12" fill="#687078"/>
  <rect x="12" y="7" width="1" height="1" fill="#787878" opacity="0.5"/>
  <rect x="30" y="10" width="1" height="1" fill="#585858" opacity="0.5"/>
  <rect x="22" y="14" width="1" height="1" fill="#787878" opacity="0.4"/>
  <!-- subtle grid lines -->
  <line x1="24" y1="4" x2="40" y2="12" stroke="#585858" stroke-width="0.5" opacity="0.2"/>
  <line x1="8" y1="12" x2="24" y2="20" stroke="#585858" stroke-width="0.5" opacity="0.2"/>
</svg>`;

/** Wooden fence */
export const TILE_FENCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  <polygon points="24,0 48,12 24,24 0,12" fill="#5a4a2a"/>
  <polygon points="24,1 47,12 24,23 1,12" fill="#6b5630"/>
  <!-- vertical posts -->
  <rect x="10" y="4" width="2" height="12" fill="#8B6914"/>
  <rect x="10" y="4" width="2" height="1" fill="#A0822D"/>
  <rect x="23" y="0" width="2" height="14" fill="#8B6914"/>
  <rect x="23" y="0" width="2" height="1" fill="#A0822D"/>
  <rect x="36" y="4" width="2" height="12" fill="#8B6914"/>
  <rect x="36" y="4" width="2" height="1" fill="#A0822D"/>
  <!-- horizontal rails -->
  <rect x="10" y="7" width="28" height="1" fill="#7A5B10"/>
  <rect x="10" y="12" width="28" height="1" fill="#7A5B10"/>
</svg>`;

/** Water */
export const TILE_WATER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  <polygon points="24,0 48,12 24,24 0,12" fill="#1a3a5c"/>
  <polygon points="24,1 47,12 24,23 1,12" fill="#1e4068"/>
  <!-- ripple highlights -->
  <rect x="14" y="8" width="4" height="1" fill="#2a5a8c" opacity="0.6"/>
  <rect x="28" y="11" width="3" height="1" fill="#2a5a8c" opacity="0.5"/>
  <rect x="18" y="14" width="5" height="1" fill="#2a5a8c" opacity="0.4"/>
  <rect x="32" y="7" width="2" height="1" fill="#3a6ea5" opacity="0.3"/>
  <rect x="10" y="12" width="3" height="1" fill="#3a6ea5" opacity="0.3"/>
</svg>`;

/** Gate opening */
export const TILE_GATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  <polygon points="24,0 48,12 24,24 0,12" fill="#8B7355"/>
  <polygon points="24,1 47,12 24,23 1,12" fill="#A0896B"/>
  <!-- worn stone markers on sides -->
  <rect x="6" y="8" width="3" height="4" fill="#708090" opacity="0.6"/>
  <rect x="39" y="8" width="3" height="4" fill="#708090" opacity="0.6"/>
  <rect x="22" y="10" width="4" height="2" fill="#c9a84c" opacity="0.3"/>
</svg>`;
