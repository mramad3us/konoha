/**
 * Isometric tile sprites — 48x24 viewBox (diamond shape).
 * Retro 8-bit STYLED but rendered with modern quality:
 * - Flat base colors with subtle gradient shading
 * - Clean chunky shapes with smooth edges
 * - Deliberate limited palette per tile
 * - Just enough detail for visual interest without noise
 */

const CLIP = `<clipPath id="iso"><polygon points="24,0 48,12 24,24 0,12"/></clipPath>`;
const G = (inner: string) => `<g clip-path="url(#iso)">${inner}</g>`;

/** Grass 1 — medium green with subtle shading and a few detail touches */
export const TILE_GRASS1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#3b7d26"/>
  <!-- light side (top-left facet) -->
  <polygon points="24,0 0,12 24,12" fill="#429030" opacity="0.4"/>
  <!-- shadow side (bottom-right facet) -->
  <polygon points="24,12 48,12 24,24" fill="#2a5e18" opacity="0.3"/>
  <!-- chunky darker patches (retro-style) -->
  <rect x="8" y="5" width="3" height="2" fill="#306c1e" opacity="0.6"/>
  <rect x="30" y="8" width="3" height="2" fill="#306c1e" opacity="0.5"/>
  <rect x="18" y="13" width="3" height="2" fill="#306c1e" opacity="0.5"/>
  <!-- small highlight flecks -->
  <rect x="14" y="7" width="2" height="1" fill="#4a9e38" opacity="0.5"/>
  <rect x="34" y="11" width="2" height="1" fill="#4a9e38" opacity="0.4"/>
  <rect x="22" y="5" width="2" height="1" fill="#4a9e38" opacity="0.4"/>
  <!-- single dirt pixel -->
  <rect x="26" y="10" width="2" height="1" fill="#6b5b3a" opacity="0.3"/>
  `)}
</svg>`;

/** Grass 2 — cooler darker green */
export const TILE_GRASS2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#336e20"/>
  <polygon points="24,0 0,12 24,12" fill="#3c8028" opacity="0.35"/>
  <polygon points="24,12 48,12 24,24" fill="#265816" opacity="0.3"/>
  <rect x="12" y="4" width="3" height="2" fill="#2a5e18" opacity="0.6"/>
  <rect x="32" y="9" width="3" height="2" fill="#2a5e18" opacity="0.5"/>
  <rect x="20" y="14" width="3" height="2" fill="#2a5e18" opacity="0.5"/>
  <rect x="10" y="9" width="2" height="1" fill="#438c2e" opacity="0.5"/>
  <rect x="36" y="6" width="2" height="1" fill="#438c2e" opacity="0.4"/>
  <rect x="16" y="11" width="2" height="1" fill="#5a4a2a" opacity="0.35"/>
  <rect x="28" y="6" width="2" height="1" fill="#5a4a2a" opacity="0.3"/>
  `)}
</svg>`;

/** Grass 3 — warm bright green */
export const TILE_GRASS3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#428a2c"/>
  <polygon points="24,0 0,12 24,12" fill="#4c9a36" opacity="0.35"/>
  <polygon points="24,12 48,12 24,24" fill="#347822" opacity="0.3"/>
  <rect x="10" y="6" width="3" height="2" fill="#367822" opacity="0.5"/>
  <rect x="30" y="4" width="3" height="2" fill="#367822" opacity="0.5"/>
  <rect x="22" y="12" width="3" height="2" fill="#367822" opacity="0.4"/>
  <rect x="16" y="9" width="2" height="1" fill="#56a83e" opacity="0.5"/>
  <rect x="38" y="11" width="2" height="1" fill="#56a83e" opacity="0.4"/>
  `)}
</svg>`;

/** Dirt path — warm brown with facet shading and pebble hints */
export const TILE_DIRT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#8b7355"/>
  <polygon points="24,0 0,12 24,12" fill="#9a8365" opacity="0.35"/>
  <polygon points="24,12 48,12 24,24" fill="#7a6345" opacity="0.3"/>
  <rect x="10" y="5" width="3" height="2" fill="#7a6345" opacity="0.5"/>
  <rect x="30" y="10" width="3" height="2" fill="#7a6345" opacity="0.4"/>
  <rect x="22" y="14" width="3" height="2" fill="#7a6345" opacity="0.4"/>
  <rect x="14" y="8" width="2" height="1" fill="#9a8365" opacity="0.5"/>
  <rect x="36" y="12" width="2" height="1" fill="#a08c6a" opacity="0.4"/>
  <!-- pebbles -->
  <rect x="18" y="7" width="2" height="1" fill="#908070" opacity="0.4"/>
  <rect x="32" y="15" width="2" height="1" fill="#908070" opacity="0.3"/>
  <!-- edge grass bleed -->
  <rect x="6" y="8" width="2" height="1" fill="#3b7d26" opacity="0.2"/>
  <rect x="40" y="11" width="2" height="1" fill="#3b7d26" opacity="0.15"/>
  `)}
</svg>`;

/** Stone floor — cool grey with slab joints and faceted shading */
export const TILE_STONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#686e76"/>
  <polygon points="24,0 0,12 24,12" fill="#737a82" opacity="0.35"/>
  <polygon points="24,12 48,12 24,24" fill="#5a6068" opacity="0.3"/>
  <!-- slab joints -->
  <rect x="16" y="1" width="1" height="22" fill="#545c64" opacity="0.4"/>
  <rect x="32" y="1" width="1" height="22" fill="#545c64" opacity="0.35"/>
  <rect x="1" y="8" width="46" height="1" fill="#545c64" opacity="0.35"/>
  <rect x="1" y="16" width="46" height="1" fill="#545c64" opacity="0.3"/>
  <!-- subtle highlights -->
  <rect x="8" y="4" width="2" height="1" fill="#7e868e" opacity="0.5"/>
  <rect x="36" y="12" width="2" height="1" fill="#7e868e" opacity="0.4"/>
  <!-- moss hint -->
  <rect x="22" y="10" width="2" height="1" fill="#4a6640" opacity="0.2"/>
  `)}
</svg>`;

/** Wooden fence — chunky posts with rail highlight, dark ground */
export const TILE_FENCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#3a2e18"/>
  <!-- shadow gradient on ground -->
  <polygon points="24,0 0,12 24,12" fill="#44361e" opacity="0.4"/>
  <!-- horizontal rails -->
  <rect x="2" y="5" width="44" height="3" fill="#7a5a20"/>
  <rect x="2" y="5" width="44" height="1" fill="#8c6c2e"/>
  <rect x="2" y="12" width="44" height="3" fill="#7a5a20"/>
  <rect x="2" y="12" width="44" height="1" fill="#8c6c2e"/>
  <!-- posts -->
  <rect x="10" y="2" width="3" height="16" fill="#8B6914"/>
  <rect x="10" y="2" width="1" height="16" fill="#9c7c28"/>
  <rect x="23" y="0" width="3" height="20" fill="#8B6914"/>
  <rect x="23" y="0" width="1" height="20" fill="#9c7c28"/>
  <rect x="36" y="2" width="3" height="16" fill="#8B6914"/>
  <rect x="36" y="2" width="1" height="16" fill="#9c7c28"/>
  `)}
</svg>`;

/** Water — deep blue with clean ripple lines and specular highlight */
export const TILE_WATER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#1a3a5c"/>
  <polygon points="24,0 0,12 24,12" fill="#1e4268" opacity="0.4"/>
  <polygon points="24,12 48,12 24,24" fill="#143050" opacity="0.3"/>
  <!-- ripples -->
  <rect x="10" y="5" width="8" height="1" fill="#2a5a8c" opacity="0.5"/>
  <rect x="26" y="9" width="6" height="1" fill="#2a5a8c" opacity="0.45"/>
  <rect x="14" y="13" width="10" height="1" fill="#2a5a8c" opacity="0.4"/>
  <rect x="30" y="17" width="6" height="1" fill="#2a5a8c" opacity="0.3"/>
  <!-- specular -->
  <rect x="16" y="5" width="2" height="1" fill="#4090c0" opacity="0.4"/>
  <rect x="30" y="13" width="2" height="1" fill="#4090c0" opacity="0.3"/>
  `)}
</svg>`;

/** Gate — warm stone with gold markers and subtle slab lines */
export const TILE_GATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#8a7858"/>
  <polygon points="24,0 0,12 24,12" fill="#96866a" opacity="0.35"/>
  <polygon points="24,12 48,12 24,24" fill="#7a6a4a" opacity="0.3"/>
  <!-- slab lines -->
  <rect x="12" y="2" width="1" height="20" fill="#706048" opacity="0.25"/>
  <rect x="24" y="1" width="1" height="22" fill="#706048" opacity="0.25"/>
  <rect x="36" y="2" width="1" height="20" fill="#706048" opacity="0.25"/>
  <!-- side pillars -->
  <rect x="2" y="4" width="4" height="8" fill="#606870"/>
  <rect x="2" y="4" width="4" height="1" fill="#727a82"/>
  <rect x="42" y="8" width="4" height="8" fill="#606870"/>
  <rect x="42" y="8" width="4" height="1" fill="#727a82"/>
  <!-- gold accents -->
  <rect x="3" y="6" width="2" height="2" fill="#c9a84c" opacity="0.7"/>
  <rect x="43" y="10" width="2" height="2" fill="#c9a84c" opacity="0.7"/>
  `)}
</svg>`;
