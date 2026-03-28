/**
 * All pixel art assets as inline SVGs rendered on pixel grids.
 * Each SVG uses a viewBox matching the pixel grid size.
 * CSS `image-rendering: pixelated` handles the crisp scaling.
 */

/** Kunai — 16x16 pixel grid */
export const KUNAI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="pixel-sprite">
  <!-- blade -->
  <rect x="7" y="1" width="2" height="1" fill="#e8e8e8"/>
  <rect x="7" y="2" width="2" height="1" fill="#d0d0d0"/>
  <rect x="6" y="3" width="4" height="1" fill="#c8c8c8"/>
  <rect x="6" y="4" width="4" height="1" fill="#b0b0b0"/>
  <rect x="5" y="5" width="6" height="1" fill="#a0a0a0"/>
  <rect x="6" y="6" width="4" height="1" fill="#909090"/>
  <rect x="7" y="7" width="2" height="1" fill="#808080"/>
  <!-- guard -->
  <rect x="5" y="8" width="6" height="1" fill="#8B4513"/>
  <rect x="6" y="9" width="4" height="1" fill="#A0522D"/>
  <!-- handle wrap -->
  <rect x="7" y="10" width="2" height="1" fill="#2c2c2c"/>
  <rect x="7" y="11" width="2" height="1" fill="#f5f0dc"/>
  <rect x="7" y="12" width="2" height="1" fill="#2c2c2c"/>
  <rect x="7" y="13" width="2" height="1" fill="#f5f0dc"/>
  <!-- ring -->
  <rect x="6" y="14" width="4" height="1" fill="#555"/>
  <rect x="6" y="15" width="1" height="1" fill="#555"/>
  <rect x="9" y="15" width="1" height="1" fill="#555"/>
</svg>`;

/** Shuriken — 16x16 pixel grid */
export const SHURIKEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="pixel-sprite">
  <!-- top blade -->
  <rect x="7" y="1" width="2" height="1" fill="#a0a0a0"/>
  <rect x="7" y="2" width="2" height="1" fill="#b0b0b0"/>
  <rect x="6" y="3" width="4" height="1" fill="#c0c0c0"/>
  <rect x="6" y="4" width="4" height="1" fill="#b0b0b0"/>
  <!-- right blade -->
  <rect x="10" y="6" width="1" height="4" fill="#b0b0b0"/>
  <rect x="11" y="6" width="1" height="4" fill="#c0c0c0"/>
  <rect x="12" y="7" width="1" height="2" fill="#b0b0b0"/>
  <rect x="13" y="7" width="1" height="2" fill="#a0a0a0"/>
  <!-- bottom blade -->
  <rect x="6" y="11" width="4" height="1" fill="#b0b0b0"/>
  <rect x="6" y="12" width="4" height="1" fill="#c0c0c0"/>
  <rect x="7" y="13" width="2" height="1" fill="#b0b0b0"/>
  <rect x="7" y="14" width="2" height="1" fill="#a0a0a0"/>
  <!-- left blade -->
  <rect x="2" y="7" width="1" height="2" fill="#a0a0a0"/>
  <rect x="3" y="7" width="1" height="2" fill="#b0b0b0"/>
  <rect x="4" y="6" width="1" height="4" fill="#c0c0c0"/>
  <rect x="5" y="6" width="1" height="4" fill="#b0b0b0"/>
  <!-- center -->
  <rect x="6" y="6" width="4" height="4" fill="#404040"/>
  <rect x="7" y="7" width="2" height="2" fill="#1a1a1a"/>
</svg>`;

/** Scroll (decorative) — 24x16 pixel grid */
export const SCROLL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16" class="pixel-sprite">
  <!-- top roll -->
  <rect x="3" y="1" width="18" height="2" fill="#d4a76a"/>
  <rect x="2" y="1" width="1" height="2" fill="#b8860b"/>
  <rect x="21" y="1" width="1" height="2" fill="#b8860b"/>
  <rect x="1" y="2" width="1" height="1" fill="#8B6914"/>
  <rect x="22" y="2" width="1" height="1" fill="#8B6914"/>
  <!-- body -->
  <rect x="3" y="3" width="18" height="10" fill="#f5e6c8"/>
  <rect x="4" y="4" width="16" height="8" fill="#faf0dc"/>
  <!-- text lines -->
  <rect x="5" y="5" width="10" height="1" fill="#c4a882"/>
  <rect x="5" y="7" width="14" height="1" fill="#c4a882"/>
  <rect x="5" y="9" width="8" height="1" fill="#c4a882"/>
  <rect x="5" y="11" width="12" height="1" fill="#c4a882"/>
  <!-- bottom roll -->
  <rect x="3" y="13" width="18" height="2" fill="#d4a76a"/>
  <rect x="2" y="13" width="1" height="2" fill="#b8860b"/>
  <rect x="21" y="13" width="1" height="2" fill="#b8860b"/>
  <rect x="1" y="14" width="1" height="1" fill="#8B6914"/>
  <rect x="22" y="14" width="1" height="1" fill="#8B6914"/>
</svg>`;

/** Leaf Village symbol — 32x32 pixel grid */
export const LEAF_SYMBOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="pixel-sprite">
  <!-- spiral center -->
  <rect x="14" y="8" width="4" height="1" fill="currentColor"/>
  <rect x="12" y="9" width="2" height="1" fill="currentColor"/>
  <rect x="18" y="9" width="2" height="1" fill="currentColor"/>
  <rect x="11" y="10" width="1" height="2" fill="currentColor"/>
  <rect x="20" y="10" width="1" height="2" fill="currentColor"/>
  <rect x="11" y="12" width="1" height="2" fill="currentColor"/>
  <rect x="20" y="12" width="1" height="1" fill="currentColor"/>
  <rect x="12" y="13" width="2" height="1" fill="currentColor"/>
  <rect x="18" y="12" width="2" height="1" fill="currentColor"/>
  <rect x="14" y="13" width="4" height="1" fill="currentColor"/>
  <!-- inner detail -->
  <rect x="14" y="10" width="4" height="1" fill="currentColor"/>
  <rect x="13" y="11" width="1" height="1" fill="currentColor"/>
  <rect x="18" y="11" width="1" height="1" fill="currentColor"/>
  <rect x="14" y="12" width="4" height="1" fill="currentColor"/>
  <!-- leaf point extending up -->
  <rect x="15" y="4" width="2" height="1" fill="currentColor"/>
  <rect x="15" y="5" width="2" height="1" fill="currentColor"/>
  <rect x="14" y="6" width="4" height="1" fill="currentColor"/>
  <rect x="14" y="7" width="4" height="1" fill="currentColor"/>
  <!-- bottom stem -->
  <rect x="15" y="14" width="2" height="1" fill="currentColor"/>
  <rect x="15" y="15" width="2" height="1" fill="currentColor"/>
  <rect x="15" y="16" width="2" height="1" fill="currentColor"/>
  <rect x="14" y="17" width="4" height="1" fill="currentColor"/>
  <rect x="13" y="18" width="2" height="1" fill="currentColor"/>
  <rect x="17" y="18" width="2" height="1" fill="currentColor"/>
  <!-- outer ring -->
  <rect x="12" y="5" width="2" height="1" fill="currentColor" opacity="0.5"/>
  <rect x="18" y="5" width="2" height="1" fill="currentColor" opacity="0.5"/>
  <rect x="10" y="7" width="1" height="1" fill="currentColor" opacity="0.5"/>
  <rect x="21" y="7" width="1" height="1" fill="currentColor" opacity="0.5"/>
  <rect x="9" y="9" width="1" height="4" fill="currentColor" opacity="0.5"/>
  <rect x="22" y="9" width="1" height="4" fill="currentColor" opacity="0.5"/>
  <rect x="10" y="14" width="1" height="1" fill="currentColor" opacity="0.5"/>
  <rect x="21" y="14" width="1" height="1" fill="currentColor" opacity="0.5"/>
  <!-- side decorations -->
  <rect x="7" y="10" width="1" height="2" fill="currentColor" opacity="0.3"/>
  <rect x="24" y="10" width="1" height="2" fill="currentColor" opacity="0.3"/>
</svg>`;

/** Smoke particle — 8x8 pixel grid */
export const SMOKE_PARTICLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" class="pixel-sprite">
  <rect x="2" y="1" width="4" height="1" fill="currentColor" opacity="0.6"/>
  <rect x="1" y="2" width="6" height="1" fill="currentColor" opacity="0.5"/>
  <rect x="0" y="3" width="8" height="2" fill="currentColor" opacity="0.4"/>
  <rect x="1" y="5" width="6" height="1" fill="currentColor" opacity="0.3"/>
  <rect x="2" y="6" width="4" height="1" fill="currentColor" opacity="0.2"/>
</svg>`;

/** Headband — 24x8 pixel grid */
export const HEADBAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 8" class="pixel-sprite">
  <!-- band -->
  <rect x="0" y="2" width="24" height="4" fill="#1a3a5c"/>
  <rect x="0" y="2" width="24" height="1" fill="#1e4470"/>
  <rect x="0" y="5" width="24" height="1" fill="#142e4a"/>
  <!-- metal plate -->
  <rect x="7" y="1" width="10" height="6" fill="#708090"/>
  <rect x="8" y="0" width="8" height="1" fill="#607080"/>
  <rect x="8" y="7" width="8" height="1" fill="#607080"/>
  <rect x="7" y="1" width="10" height="1" fill="#8899a9"/>
  <!-- screws -->
  <rect x="8" y="2" width="1" height="1" fill="#505050"/>
  <rect x="15" y="2" width="1" height="1" fill="#505050"/>
  <rect x="8" y="5" width="1" height="1" fill="#505050"/>
  <rect x="15" y="5" width="1" height="1" fill="#505050"/>
  <!-- leaf symbol on plate (simplified) -->
  <rect x="11" y="2" width="2" height="1" fill="#2a2a2a"/>
  <rect x="10" y="3" width="4" height="1" fill="#2a2a2a"/>
  <rect x="11" y="4" width="2" height="1" fill="#2a2a2a"/>
  <rect x="11" y="5" width="2" height="1" fill="#2a2a2a"/>
  <!-- band tails -->
  <rect x="0" y="3" width="2" height="2" fill="#1a3a5c"/>
  <rect x="22" y="3" width="2" height="2" fill="#1a3a5c"/>
</svg>`;

/** Separator line (decorative) — horizontal bar with kunai motif */
export const SEPARATOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 8" class="pixel-sprite">
  <rect x="0" y="3" width="26" height="2" fill="currentColor" opacity="0.3"/>
  <rect x="38" y="3" width="26" height="2" fill="currentColor" opacity="0.3"/>
  <!-- center diamond -->
  <rect x="30" y="2" width="4" height="1" fill="currentColor" opacity="0.6"/>
  <rect x="29" y="3" width="6" height="2" fill="currentColor" opacity="0.6"/>
  <rect x="30" y="5" width="4" height="1" fill="currentColor" opacity="0.6"/>
</svg>`;

/** Pixel art bordered box (for menu items) — creates the border pattern as data URI */
export function createPixelBorder(width: number, height: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="pixel-sprite">
    <!-- corners -->
    <rect x="0" y="0" width="2" height="1" fill="${color}"/>
    <rect x="0" y="0" width="1" height="2" fill="${color}"/>
    <rect x="${width - 2}" y="0" width="2" height="1" fill="${color}"/>
    <rect x="${width - 1}" y="0" width="1" height="2" fill="${color}"/>
    <rect x="0" y="${height - 1}" width="2" height="1" fill="${color}"/>
    <rect x="0" y="${height - 2}" width="1" height="2" fill="${color}"/>
    <rect x="${width - 2}" y="${height - 1}" width="2" height="1" fill="${color}"/>
    <rect x="${width - 1}" y="${height - 2}" width="1" height="2" fill="${color}"/>
    <!-- edges -->
    <rect x="2" y="0" width="${width - 4}" height="1" fill="${color}" opacity="0.6"/>
    <rect x="2" y="${height - 1}" width="${width - 4}" height="1" fill="${color}" opacity="0.6"/>
    <rect x="0" y="2" width="1" height="${height - 4}" fill="${color}" opacity="0.6"/>
    <rect x="${width - 1}" y="2" width="1" height="${height - 4}" fill="${color}" opacity="0.6"/>
  </svg>`;
}
