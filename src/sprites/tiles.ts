/**
 * Isometric tile sprites — 48x24 viewBox (diamond shape).
 * 8-bit retro style: flat fills, minimal detail, chunky pixels.
 */

const CLIP = `<clipPath id="iso"><polygon points="24,0 48,12 24,24 0,12"/></clipPath>`;
const G = (inner: string) => `<g clip-path="url(#iso)">${inner}</g>`;

/** Grass 1 — base green, a few darker chunks */
export const TILE_GRASS1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#3b7d26"/>
  <rect x="8" y="5" width="2" height="2" fill="#2f6a1e"/>
  <rect x="28" y="4" width="2" height="2" fill="#2f6a1e"/>
  <rect x="18" y="12" width="2" height="2" fill="#2f6a1e"/>
  <rect x="36" y="10" width="2" height="2" fill="#2f6a1e"/>
  <rect x="14" y="8" width="1" height="1" fill="#4a9432"/>
  <rect x="32" y="14" width="1" height="1" fill="#4a9432"/>
  <rect x="22" y="6" width="1" height="1" fill="#6b5b3a" opacity="0.4"/>
  `)}
</svg>`;

/** Grass 2 — darker tone */
export const TILE_GRASS2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#336e20"/>
  <rect x="12" y="4" width="2" height="2" fill="#2a5e18"/>
  <rect x="32" y="8" width="2" height="2" fill="#2a5e18"/>
  <rect x="20" y="14" width="2" height="2" fill="#2a5e18"/>
  <rect x="10" y="10" width="1" height="1" fill="#438c2e"/>
  <rect x="38" y="12" width="1" height="1" fill="#438c2e"/>
  <rect x="26" y="6" width="2" height="1" fill="#5a4a2a" opacity="0.4"/>
  <rect x="16" y="16" width="1" height="1" fill="#5a4a2a" opacity="0.3"/>
  `)}
</svg>`;

/** Grass 3 — brighter tone */
export const TILE_GRASS3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#428a2c"/>
  <rect x="10" y="6" width="2" height="2" fill="#367822"/>
  <rect x="30" y="4" width="2" height="2" fill="#367822"/>
  <rect x="22" y="12" width="2" height="2" fill="#367822"/>
  <rect x="16" y="9" width="1" height="1" fill="#52a03a"/>
  <rect x="36" y="11" width="1" height="1" fill="#52a03a"/>
  `)}
</svg>`;

/** Dirt path — flat brown with a couple pebbles */
export const TILE_DIRT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#8b7355"/>
  <rect x="10" y="5" width="2" height="2" fill="#7a6345"/>
  <rect x="30" y="10" width="2" height="2" fill="#7a6345"/>
  <rect x="20" y="14" width="2" height="2" fill="#7a6345"/>
  <rect x="14" y="8" width="1" height="1" fill="#9a8365"/>
  <rect x="36" y="12" width="1" height="1" fill="#9a8365"/>
  <rect x="26" y="7" width="1" height="1" fill="#6a5535"/>
  `)}
</svg>`;

/** Stone floor — flat grey with grid lines */
export const TILE_STONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#686e76"/>
  <rect x="16" y="1" width="1" height="22" fill="#58626a" opacity="0.5"/>
  <rect x="32" y="1" width="1" height="22" fill="#58626a" opacity="0.5"/>
  <rect x="1" y="8" width="46" height="1" fill="#58626a" opacity="0.4"/>
  <rect x="1" y="16" width="46" height="1" fill="#58626a" opacity="0.4"/>
  <rect x="10" y="5" width="1" height="1" fill="#7a8088"/>
  <rect x="36" y="12" width="1" height="1" fill="#7a8088"/>
  `)}
</svg>`;

/** Wooden fence — simple posts and rails */
export const TILE_FENCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#4a3a20"/>
  <rect x="2" y="5" width="44" height="3" fill="#7a5a20"/>
  <rect x="2" y="5" width="44" height="1" fill="#8a6a30"/>
  <rect x="2" y="12" width="44" height="3" fill="#7a5a20"/>
  <rect x="2" y="12" width="44" height="1" fill="#8a6a30"/>
  <rect x="10" y="2" width="3" height="16" fill="#8B6914"/>
  <rect x="10" y="2" width="1" height="16" fill="#9a7824"/>
  <rect x="23" y="1" width="3" height="18" fill="#8B6914"/>
  <rect x="23" y="1" width="1" height="18" fill="#9a7824"/>
  <rect x="36" y="2" width="3" height="16" fill="#8B6914"/>
  <rect x="36" y="2" width="1" height="16" fill="#9a7824"/>
  `)}
</svg>`;

/** Water — flat dark blue with chunky ripple lines */
export const TILE_WATER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#1a3a5c"/>
  <rect x="10" y="5" width="6" height="1" fill="#2a5a8c" opacity="0.6"/>
  <rect x="28" y="9" width="5" height="1" fill="#2a5a8c" opacity="0.5"/>
  <rect x="14" y="13" width="8" height="1" fill="#2a5a8c" opacity="0.5"/>
  <rect x="32" y="16" width="4" height="1" fill="#2a5a8c" opacity="0.4"/>
  <rect x="18" y="18" width="6" height="1" fill="#2a5a8c" opacity="0.3"/>
  <rect x="14" y="5" width="1" height="1" fill="#3a6ea5" opacity="0.5"/>
  <rect x="30" y="13" width="1" height="1" fill="#3a6ea5" opacity="0.4"/>
  `)}
</svg>`;

/** Gate — flat stone threshold with side markers */
export const TILE_GATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24">
  ${CLIP}${G(`
  <rect width="48" height="24" fill="#8a7858"/>
  <rect x="3" y="5" width="4" height="6" fill="#606870"/>
  <rect x="41" y="9" width="4" height="6" fill="#606870"/>
  <rect x="4" y="6" width="2" height="2" fill="#c9a84c" opacity="0.6"/>
  <rect x="42" y="10" width="2" height="2" fill="#c9a84c" opacity="0.6"/>
  <rect x="12" y="4" width="1" height="16" fill="#7a6848" opacity="0.3"/>
  <rect x="24" y="2" width="1" height="20" fill="#7a6848" opacity="0.3"/>
  <rect x="36" y="4" width="1" height="16" fill="#7a6848" opacity="0.3"/>
  `)}
</svg>`;
