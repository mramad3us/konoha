/**
 * Object sprites — rendered on top of tiles.
 * Heights vary; offsetY in RenderableComponent anchors them.
 */

/** Training dummy — wooden post with straw body and target circle */
export const OBJ_DUMMY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36">
  <!-- base post -->
  <rect x="10" y="20" width="4" height="16" fill="#8B6914"/>
  <rect x="10" y="20" width="4" height="1" fill="#A0822D"/>
  <rect x="9" y="34" width="6" height="2" fill="#6b5630"/>
  <!-- crossbar (arms) -->
  <rect x="3" y="14" width="18" height="3" fill="#8B6914"/>
  <rect x="3" y="14" width="18" height="1" fill="#A0822D"/>
  <!-- straw wrapping on body -->
  <rect x="8" y="8" width="8" height="12" fill="#d4a76a"/>
  <rect x="9" y="9" width="6" height="10" fill="#c99a5a"/>
  <!-- straw texture -->
  <rect x="9" y="10" width="1" height="1" fill="#b88a4a" opacity="0.6"/>
  <rect x="13" y="12" width="1" height="1" fill="#b88a4a" opacity="0.6"/>
  <rect x="11" y="15" width="1" height="1" fill="#b88a4a" opacity="0.6"/>
  <!-- target circle -->
  <rect x="10" y="11" width="4" height="1" fill="#b22234"/>
  <rect x="9" y="12" width="6" height="2" fill="#b22234"/>
  <rect x="10" y="14" width="4" height="1" fill="#b22234"/>
  <rect x="11" y="12" width="2" height="2" fill="#d4364a"/>
  <!-- head (round straw) -->
  <rect x="9" y="3" width="6" height="1" fill="#d4a76a"/>
  <rect x="8" y="4" width="8" height="4" fill="#d4a76a"/>
  <rect x="9" y="5" width="6" height="2" fill="#c99a5a"/>
  <rect x="9" y="8" width="6" height="1" fill="#d4a76a"/>
  <!-- headband -->
  <rect x="8" y="4" width="8" height="1" fill="#1a3a5c"/>
  <rect x="10" y="3" width="4" height="2" fill="#708090"/>
</svg>`;

/** Small tree */
export const OBJ_TREE_SMALL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <!-- trunk -->
  <rect x="10" y="20" width="4" height="12" fill="#6b4c1e"/>
  <rect x="10" y="20" width="1" height="12" fill="#7a5a2a"/>
  <!-- canopy layers -->
  <rect x="6" y="12" width="12" height="2" fill="#1a4a33"/>
  <rect x="4" y="8" width="16" height="5" fill="#2d6e4f"/>
  <rect x="5" y="9" width="14" height="3" fill="#358058"/>
  <rect x="6" y="4" width="12" height="5" fill="#2d6e4f"/>
  <rect x="8" y="2" width="8" height="3" fill="#1a4a33"/>
  <rect x="10" y="1" width="4" height="2" fill="#1a4a33"/>
  <!-- leaf highlights -->
  <rect x="7" y="6" width="2" height="1" fill="#40905e" opacity="0.7"/>
  <rect x="13" y="9" width="2" height="1" fill="#40905e" opacity="0.6"/>
  <rect x="9" y="10" width="1" height="1" fill="#40905e" opacity="0.5"/>
</svg>`;

/** Large tree */
export const OBJ_TREE_LARGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48">
  <!-- trunk -->
  <rect x="13" y="30" width="6" height="18" fill="#5a3c14"/>
  <rect x="13" y="30" width="2" height="18" fill="#6b4c1e"/>
  <!-- roots -->
  <rect x="10" y="44" width="12" height="2" fill="#5a3c14"/>
  <rect x="11" y="43" width="2" height="2" fill="#5a3c14"/>
  <rect x="19" y="43" width="2" height="2" fill="#5a3c14"/>
  <!-- canopy -->
  <rect x="4" y="18" width="24" height="3" fill="#1a4a33"/>
  <rect x="2" y="12" width="28" height="7" fill="#2d6e4f"/>
  <rect x="3" y="13" width="26" height="5" fill="#358058"/>
  <rect x="4" y="6" width="24" height="7" fill="#2d6e4f"/>
  <rect x="6" y="3" width="20" height="4" fill="#1a4a33"/>
  <rect x="10" y="1" width="12" height="3" fill="#1a4a33"/>
  <rect x="13" y="0" width="6" height="2" fill="#163d2a"/>
  <!-- leaf highlights -->
  <rect x="8" y="8" width="3" height="1" fill="#40905e" opacity="0.7"/>
  <rect x="20" y="10" width="2" height="1" fill="#40905e" opacity="0.6"/>
  <rect x="14" y="14" width="2" height="1" fill="#40905e" opacity="0.5"/>
  <rect x="6" y="15" width="2" height="1" fill="#40905e" opacity="0.5"/>
  <rect x="22" y="7" width="2" height="1" fill="#40905e" opacity="0.4"/>
</svg>`;

/** Rock */
export const OBJ_ROCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14">
  <!-- base shape -->
  <rect x="2" y="8" width="16" height="4" fill="#505050"/>
  <rect x="1" y="6" width="18" height="3" fill="#606060"/>
  <rect x="3" y="4" width="14" height="3" fill="#707070"/>
  <rect x="5" y="3" width="10" height="2" fill="#686868"/>
  <rect x="7" y="2" width="6" height="2" fill="#606060"/>
  <!-- highlights -->
  <rect x="6" y="4" width="3" height="1" fill="#808080" opacity="0.7"/>
  <rect x="12" y="5" width="2" height="1" fill="#808080" opacity="0.5"/>
  <!-- shadow edge -->
  <rect x="2" y="11" width="16" height="1" fill="#404040"/>
  <rect x="4" y="12" width="12" height="1" fill="#353535"/>
</svg>`;
