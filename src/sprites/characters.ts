/**
 * Player character sprites — shinobi/kunoichi in 4 cardinal directions.
 * 24x32 viewBox. Dark outfit, headband with plate, visible eyes.
 * Diagonals map to the nearest cardinal sprite.
 */

// ── SHINOBI (male) ──

/** Shinobi facing South (toward camera) */
export const CHAR_SHINOBI_S = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <!-- feet -->
  <rect x="7" y="28" width="4" height="2" fill="#1a1a2e"/>
  <rect x="13" y="28" width="4" height="2" fill="#1a1a2e"/>
  <rect x="7" y="30" width="4" height="2" fill="#2a2a3e"/>
  <rect x="13" y="30" width="4" height="2" fill="#2a2a3e"/>
  <!-- legs -->
  <rect x="8" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="13" y="22" width="3" height="6" fill="#1e1e32"/>
  <!-- body/torso -->
  <rect x="7" y="14" width="10" height="8" fill="#1a1a2e"/>
  <rect x="8" y="15" width="8" height="6" fill="#22223a"/>
  <!-- belt/sash -->
  <rect x="7" y="20" width="10" height="2" fill="#8B6914"/>
  <rect x="7" y="20" width="10" height="1" fill="#A0822D"/>
  <!-- arms -->
  <rect x="4" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="17" y="15" width="3" height="7" fill="#1a1a2e"/>
  <!-- hand wraps -->
  <rect x="4" y="20" width="3" height="2" fill="#e0d8c8"/>
  <rect x="17" y="20" width="3" height="2" fill="#e0d8c8"/>
  <!-- collar/vest front -->
  <rect x="10" y="14" width="4" height="3" fill="#2a3040"/>
  <rect x="11" y="14" width="2" height="2" fill="#303848"/>
  <!-- neck -->
  <rect x="10" y="10" width="4" height="4" fill="#d4a574"/>
  <!-- head -->
  <rect x="8" y="4" width="8" height="7" fill="#d4a574"/>
  <rect x="7" y="5" width="10" height="5" fill="#d4a574"/>
  <!-- hair -->
  <rect x="7" y="3" width="10" height="3" fill="#1a1a2e"/>
  <rect x="8" y="2" width="8" height="2" fill="#1a1a2e"/>
  <rect x="7" y="5" width="1" height="3" fill="#1a1a2e"/>
  <rect x="16" y="5" width="1" height="3" fill="#1a1a2e"/>
  <!-- headband -->
  <rect x="7" y="5" width="10" height="2" fill="#1a3a5c"/>
  <rect x="9" y="5" width="6" height="2" fill="#708090"/>
  <rect x="10" y="5" width="4" height="1" fill="#8899a9"/>
  <!-- eyes -->
  <rect x="9" y="7" width="2" height="2" fill="#ffffff"/>
  <rect x="13" y="7" width="2" height="2" fill="#ffffff"/>
  <rect x="10" y="8" width="1" height="1" fill="#1a1a2e"/>
  <rect x="13" y="8" width="1" height="1" fill="#1a1a2e"/>
</svg>`;

/** Shinobi facing North (away from camera) */
export const CHAR_SHINOBI_N = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <!-- feet -->
  <rect x="7" y="28" width="4" height="2" fill="#1a1a2e"/>
  <rect x="13" y="28" width="4" height="2" fill="#1a1a2e"/>
  <rect x="7" y="30" width="4" height="2" fill="#2a2a3e"/>
  <rect x="13" y="30" width="4" height="2" fill="#2a2a3e"/>
  <!-- legs -->
  <rect x="8" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="13" y="22" width="3" height="6" fill="#1e1e32"/>
  <!-- body -->
  <rect x="7" y="14" width="10" height="8" fill="#1a1a2e"/>
  <rect x="8" y="15" width="8" height="6" fill="#22223a"/>
  <!-- belt -->
  <rect x="7" y="20" width="10" height="2" fill="#8B6914"/>
  <!-- arms -->
  <rect x="4" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="17" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="4" y="20" width="3" height="2" fill="#e0d8c8"/>
  <rect x="17" y="20" width="3" height="2" fill="#e0d8c8"/>
  <!-- neck -->
  <rect x="10" y="10" width="4" height="4" fill="#d4a574"/>
  <!-- head (back of hair) -->
  <rect x="7" y="3" width="10" height="8" fill="#1a1a2e"/>
  <rect x="8" y="2" width="8" height="2" fill="#1a1a2e"/>
  <!-- headband ties hanging down -->
  <rect x="8" y="8" width="2" height="4" fill="#1a3a5c"/>
  <rect x="14" y="8" width="2" height="4" fill="#1a3a5c"/>
</svg>`;

/** Shinobi facing East (right) */
export const CHAR_SHINOBI_E = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <!-- feet -->
  <rect x="8" y="28" width="4" height="2" fill="#1a1a2e"/>
  <rect x="12" y="29" width="4" height="2" fill="#1a1a2e"/>
  <rect x="8" y="30" width="4" height="2" fill="#2a2a3e"/>
  <rect x="12" y="31" width="4" height="1" fill="#2a2a3e"/>
  <!-- legs -->
  <rect x="9" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="12" y="23" width="3" height="6" fill="#1e1e32"/>
  <!-- body -->
  <rect x="8" y="14" width="8" height="8" fill="#1a1a2e"/>
  <rect x="9" y="15" width="6" height="6" fill="#22223a"/>
  <!-- belt -->
  <rect x="8" y="20" width="8" height="2" fill="#8B6914"/>
  <!-- arm (front) -->
  <rect x="14" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="15" y="20" width="3" height="2" fill="#e0d8c8"/>
  <!-- arm (back, partial) -->
  <rect x="7" y="16" width="2" height="5" fill="#1a1a2e"/>
  <!-- neck -->
  <rect x="11" y="10" width="3" height="4" fill="#d4a574"/>
  <!-- head (side view) -->
  <rect x="9" y="4" width="7" height="7" fill="#d4a574"/>
  <rect x="8" y="5" width="1" height="5" fill="#d4a574"/>
  <!-- hair -->
  <rect x="8" y="3" width="7" height="3" fill="#1a1a2e"/>
  <rect x="9" y="2" width="5" height="2" fill="#1a1a2e"/>
  <rect x="8" y="5" width="1" height="4" fill="#1a1a2e"/>
  <!-- headband -->
  <rect x="8" y="5" width="8" height="2" fill="#1a3a5c"/>
  <rect x="12" y="5" width="4" height="2" fill="#708090"/>
  <!-- eye -->
  <rect x="14" y="7" width="2" height="2" fill="#ffffff"/>
  <rect x="15" y="8" width="1" height="1" fill="#1a1a2e"/>
  <!-- headband tie -->
  <rect x="7" y="6" width="2" height="3" fill="#1a3a5c"/>
</svg>`;

/** Shinobi facing West (left) */
export const CHAR_SHINOBI_W = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <!-- feet -->
  <rect x="12" y="28" width="4" height="2" fill="#1a1a2e"/>
  <rect x="8" y="29" width="4" height="2" fill="#1a1a2e"/>
  <rect x="12" y="30" width="4" height="2" fill="#2a2a3e"/>
  <rect x="8" y="31" width="4" height="1" fill="#2a2a3e"/>
  <!-- legs -->
  <rect x="12" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="9" y="23" width="3" height="6" fill="#1e1e32"/>
  <!-- body -->
  <rect x="8" y="14" width="8" height="8" fill="#1a1a2e"/>
  <rect x="9" y="15" width="6" height="6" fill="#22223a"/>
  <!-- belt -->
  <rect x="8" y="20" width="8" height="2" fill="#8B6914"/>
  <!-- arm (front) -->
  <rect x="5" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="5" y="20" width="3" height="2" fill="#e0d8c8"/>
  <!-- arm (back) -->
  <rect x="15" y="16" width="2" height="5" fill="#1a1a2e"/>
  <!-- neck -->
  <rect x="10" y="10" width="3" height="4" fill="#d4a574"/>
  <!-- head -->
  <rect x="8" y="4" width="7" height="7" fill="#d4a574"/>
  <rect x="15" y="5" width="1" height="5" fill="#d4a574"/>
  <!-- hair -->
  <rect x="9" y="3" width="7" height="3" fill="#1a1a2e"/>
  <rect x="10" y="2" width="5" height="2" fill="#1a1a2e"/>
  <rect x="15" y="5" width="1" height="4" fill="#1a1a2e"/>
  <!-- headband -->
  <rect x="8" y="5" width="8" height="2" fill="#1a3a5c"/>
  <rect x="8" y="5" width="4" height="2" fill="#708090"/>
  <!-- eye -->
  <rect x="8" y="7" width="2" height="2" fill="#ffffff"/>
  <rect x="8" y="8" width="1" height="1" fill="#1a1a2e"/>
  <!-- headband tie -->
  <rect x="15" y="6" width="2" height="3" fill="#1a3a5c"/>
</svg>`;

// ── KUNOICHI (female) — slightly different silhouette: longer hair, slimmer build ──

/** Kunoichi facing South */
export const CHAR_KUNOICHI_S = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <!-- feet -->
  <rect x="8" y="28" width="3" height="2" fill="#1a1a2e"/>
  <rect x="13" y="28" width="3" height="2" fill="#1a1a2e"/>
  <rect x="8" y="30" width="3" height="2" fill="#2a2a3e"/>
  <rect x="13" y="30" width="3" height="2" fill="#2a2a3e"/>
  <!-- legs -->
  <rect x="8" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="13" y="22" width="3" height="6" fill="#1e1e32"/>
  <!-- body -->
  <rect x="7" y="14" width="10" height="8" fill="#1a1a2e"/>
  <rect x="8" y="15" width="8" height="6" fill="#22223a"/>
  <!-- belt with ribbon -->
  <rect x="7" y="20" width="10" height="2" fill="#b22234"/>
  <rect x="7" y="20" width="10" height="1" fill="#d4364a"/>
  <!-- arms -->
  <rect x="4" y="15" width="3" height="6" fill="#1a1a2e"/>
  <rect x="17" y="15" width="3" height="6" fill="#1a1a2e"/>
  <rect x="4" y="20" width="3" height="2" fill="#e0d8c8"/>
  <rect x="17" y="20" width="3" height="2" fill="#e0d8c8"/>
  <!-- collar -->
  <rect x="10" y="14" width="4" height="2" fill="#2a3040"/>
  <!-- neck -->
  <rect x="10" y="10" width="4" height="4" fill="#d4a574"/>
  <!-- head -->
  <rect x="8" y="4" width="8" height="7" fill="#d4a574"/>
  <rect x="7" y="5" width="10" height="5" fill="#d4a574"/>
  <!-- long hair -->
  <rect x="7" y="2" width="10" height="4" fill="#2a1a3e"/>
  <rect x="6" y="4" width="12" height="3" fill="#2a1a3e"/>
  <rect x="6" y="7" width="2" height="6" fill="#2a1a3e"/>
  <rect x="16" y="7" width="2" height="6" fill="#2a1a3e"/>
  <!-- headband -->
  <rect x="7" y="5" width="10" height="2" fill="#b22234"/>
  <rect x="9" y="5" width="6" height="2" fill="#708090"/>
  <!-- eyes -->
  <rect x="9" y="7" width="2" height="2" fill="#ffffff"/>
  <rect x="13" y="7" width="2" height="2" fill="#ffffff"/>
  <rect x="10" y="8" width="1" height="1" fill="#2a1a3e"/>
  <rect x="13" y="8" width="1" height="1" fill="#2a1a3e"/>
</svg>`;

/** Kunoichi facing North */
export const CHAR_KUNOICHI_N = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <rect x="8" y="28" width="3" height="4" fill="#1a1a2e"/>
  <rect x="13" y="28" width="3" height="4" fill="#1a1a2e"/>
  <rect x="8" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="13" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="7" y="14" width="10" height="8" fill="#1a1a2e"/>
  <rect x="7" y="20" width="10" height="2" fill="#b22234"/>
  <rect x="4" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="17" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="4" y="20" width="3" height="2" fill="#e0d8c8"/>
  <rect x="17" y="20" width="3" height="2" fill="#e0d8c8"/>
  <rect x="10" y="10" width="4" height="4" fill="#d4a574"/>
  <!-- back of head with long hair -->
  <rect x="7" y="2" width="10" height="10" fill="#2a1a3e"/>
  <rect x="6" y="4" width="12" height="6" fill="#2a1a3e"/>
  <rect x="6" y="10" width="2" height="8" fill="#2a1a3e"/>
  <rect x="16" y="10" width="2" height="8" fill="#2a1a3e"/>
  <!-- headband ties -->
  <rect x="8" y="8" width="2" height="5" fill="#b22234"/>
  <rect x="14" y="8" width="2" height="5" fill="#b22234"/>
</svg>`;

/** Kunoichi facing East */
export const CHAR_KUNOICHI_E = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <rect x="8" y="28" width="4" height="4" fill="#1a1a2e"/>
  <rect x="12" y="29" width="4" height="3" fill="#1a1a2e"/>
  <rect x="9" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="12" y="23" width="3" height="6" fill="#1e1e32"/>
  <rect x="8" y="14" width="8" height="8" fill="#1a1a2e"/>
  <rect x="8" y="20" width="8" height="2" fill="#b22234"/>
  <rect x="14" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="15" y="20" width="3" height="2" fill="#e0d8c8"/>
  <rect x="7" y="16" width="2" height="5" fill="#1a1a2e"/>
  <rect x="11" y="10" width="3" height="4" fill="#d4a574"/>
  <rect x="9" y="4" width="7" height="7" fill="#d4a574"/>
  <!-- hair (side) -->
  <rect x="8" y="2" width="7" height="4" fill="#2a1a3e"/>
  <rect x="8" y="5" width="1" height="8" fill="#2a1a3e"/>
  <rect x="14" y="7" width="2" height="5" fill="#2a1a3e"/>
  <!-- headband -->
  <rect x="8" y="5" width="8" height="2" fill="#b22234"/>
  <rect x="12" y="5" width="4" height="2" fill="#708090"/>
  <!-- eye -->
  <rect x="14" y="7" width="2" height="2" fill="#ffffff"/>
  <rect x="15" y="8" width="1" height="1" fill="#2a1a3e"/>
</svg>`;

/** Kunoichi facing West */
export const CHAR_KUNOICHI_W = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <rect x="12" y="28" width="4" height="4" fill="#1a1a2e"/>
  <rect x="8" y="29" width="4" height="3" fill="#1a1a2e"/>
  <rect x="12" y="22" width="3" height="6" fill="#1e1e32"/>
  <rect x="9" y="23" width="3" height="6" fill="#1e1e32"/>
  <rect x="8" y="14" width="8" height="8" fill="#1a1a2e"/>
  <rect x="8" y="20" width="8" height="2" fill="#b22234"/>
  <rect x="5" y="15" width="3" height="7" fill="#1a1a2e"/>
  <rect x="5" y="20" width="3" height="2" fill="#e0d8c8"/>
  <rect x="15" y="16" width="2" height="5" fill="#1a1a2e"/>
  <rect x="10" y="10" width="3" height="4" fill="#d4a574"/>
  <rect x="8" y="4" width="7" height="7" fill="#d4a574"/>
  <!-- hair -->
  <rect x="9" y="2" width="7" height="4" fill="#2a1a3e"/>
  <rect x="15" y="5" width="1" height="8" fill="#2a1a3e"/>
  <rect x="8" y="7" width="2" height="5" fill="#2a1a3e"/>
  <!-- headband -->
  <rect x="8" y="5" width="8" height="2" fill="#b22234"/>
  <rect x="8" y="5" width="4" height="2" fill="#708090"/>
  <!-- eye -->
  <rect x="8" y="7" width="2" height="2" fill="#ffffff"/>
  <rect x="8" y="8" width="1" height="1" fill="#2a1a3e"/>
</svg>`;
