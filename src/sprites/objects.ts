/**
 * Object sprites — 16×16 pixel patterns rendered on top of tiles.
 * Training dummy, trees (bushy!), bushes, rocks, vegetation.
 */

import type { PixelPattern } from './pixelPatterns.ts';

// ── TRAINING DUMMY ──
const DUMMY_PAL: Record<string, [number, number, number]> = {
  w: [139, 105, 20],   // wood
  W: [160, 130, 45],   // wood highlight
  k: [107, 86, 48],    // dark wood
  s: [212, 167, 106],  // straw
  S: [185, 138, 74],   // straw dark
  r: [178, 34, 52],    // target red
  R: [212, 54, 74],    // target bright
  b: [26, 58, 92],     // headband
  m: [112, 128, 144],  // metal
};

export const OBJ_DUMMY: PixelPattern = {
  width: 16, height: 16,
  palette: DUMMY_PAL,
  pixels: [
    '................',
    '.....sSSs.......',
    '....sSbbSs......',
    '....sSmmSs......',
    '....sSSSSs......',
    '.....ssSs.......',
    '....ssssss......',
    '...wsSrRSsw.....',
    '...WsrRRrsW.....',
    '...wsSrRSsw.....',
    '....ssssss......',
    '.....wWw........',
    '.....wWw........',
    '.....wWw........',
    '....kwWwk.......',
    '....kkkk........',
  ],
};

// ── TREE PALETTES ──
const TREE_PAL: Record<string, [number, number, number]> = {
  t: [90, 60, 20],     // trunk dark
  T: [115, 82, 34],    // trunk highlight
  r: [72, 48, 16],     // root
  d: [16, 48, 33],     // deepest canopy shadow
  c: [26, 74, 51],     // canopy dark
  C: [45, 110, 79],    // canopy mid
  l: [64, 144, 94],    // leaf highlight
  L: [80, 165, 110],   // leaf bright
};

/** Small tree — bushy round canopy, short trunk */
export const OBJ_TREE_SMALL: PixelPattern = {
  width: 16, height: 16,
  palette: TREE_PAL,
  pixels: [
    '................',
    '.....cClc.......',
    '....cCLlCc......',
    '...cClCCLcCc....',
    '..cCLcClcLCCc...',
    '..cClCCLCclCc...',
    '..cCCclcCLCCc...',
    '...cCLCClcCc....',
    '....ccCcCcc.....',
    '......tTt.......',
    '......tTt.......',
    '......tTt.......',
    '.....rtTtr......',
    '................',
    '................',
    '................',
  ],
};

/** Large tree — big bushy canopy overhanging, thick trunk */
export const OBJ_TREE_LARGE: PixelPattern = {
  width: 16, height: 16,
  palette: TREE_PAL,
  pixels: [
    '....dcClcd......',
    '...dCLlCCLcd....',
    '..dClCCLcClCd...',
    '.dCLcClcCLCCCd..',
    '.dCclCCLCclCCd..',
    'dCCLcClcCLcClCd.',
    'dClCCLCCclCCLCd.',
    '.dCCclcCLCclCd..',
    '..dCCLCClCCCd...',
    '...ddcCcCcdd....',
    '.....tTTTt......',
    '.....tTTTt......',
    '......tTt.......',
    '......tTt.......',
    '....rrTTTrr.....',
    '................',
  ],
};

/** Willow-style tree — drooping branches, Konoha flavor */
export const OBJ_TREE_WILLOW: PixelPattern = {
  width: 16, height: 16,
  palette: TREE_PAL,
  pixels: [
    '......cCc.......',
    '.....cCLCc......',
    '....cClCclc.....',
    '...cCCLCCLc.....',
    '..ccClcClclcc...',
    '.c.cCLCCLc.c...',
    '.c..cclccl..c...',
    '.c...cCCc...c...',
    '..c..tTTt..c....',
    '..c..tTTt..c....',
    '...c.tTt..c.....',
    '....ctTtc.......',
    '.....tTt........',
    '.....tTt........',
    '....rtTtr.......',
    '................',
  ],
};

// ── BUSHES ──
const BUSH_PAL: Record<string, [number, number, number]> = {
  d: [22, 61, 42],     // dark
  b: [38, 95, 65],     // base
  l: [58, 130, 88],    // light
  L: [75, 155, 105],   // highlight
  f: [178, 50, 60],    // flower/berry red
  y: [200, 180, 60],   // flower yellow
};

/** Low bush */
export const OBJ_BUSH_SMALL: PixelPattern = {
  width: 16, height: 16,
  palette: BUSH_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....dblbd......',
    '....dblLlbd.....',
    '...dbLblbLbd....',
    '...dblLlbLbd....',
    '....dbbbbbd.....',
    '.....ddddd......',
    '................',
    '................',
  ],
};

/** Medium bush with berries */
export const OBJ_BUSH_BERRY: PixelPattern = {
  width: 16, height: 16,
  palette: BUSH_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......dbd.......',
    '.....dblbd......',
    '....dbLflbd.....',
    '...dblLblLbd....',
    '...dbfblbfbd....',
    '..dblLblbLlbd...',
    '..dbLbfblLbbd...',
    '...dbbbbbbbd....',
    '....ddddddd.....',
    '................',
    '................',
  ],
};

/** Tall bush / hedge */
export const OBJ_BUSH_TALL: PixelPattern = {
  width: 16, height: 16,
  palette: BUSH_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '.....dbld.......',
    '....dblLbd......',
    '...dblLblbd.....',
    '...dbLblLbd.....',
    '..dblLblbLbd....',
    '..dbLblLblbd....',
    '..dblLbLblbd....',
    '..dbLblblLbd....',
    '...dblLblbd.....',
    '...dbbbbbbd.....',
    '....ddddddd.....',
    '................',
    '................',
  ],
};

/** Flowering bush */
export const OBJ_BUSH_FLOWER: PixelPattern = {
  width: 16, height: 16,
  palette: BUSH_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....dybd.......',
    '....dblybld.....',
    '...dbylblLbd....',
    '...dblLybLbd....',
    '..dbyLblbyLbd...',
    '..dblLybLblbd...',
    '...dbbbbbbbd....',
    '....ddddddd.....',
    '................',
    '................',
  ],
};

// ── TALL GRASS / VEGETATION ──
const GRASS_OBJ_PAL: Record<string, [number, number, number]> = {
  d: [34, 82, 48],     // dark blade
  b: [48, 110, 65],    // base blade
  l: [68, 145, 85],    // light blade
  L: [85, 168, 100],   // tip highlight
};

/** Tall grass patch */
export const OBJ_TALL_GRASS: PixelPattern = {
  width: 16, height: 16,
  palette: GRASS_OBJ_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....L..L.......',
    '....lb.lbl......',
    '...lbl.lbL......',
    '...bLb.bbl......',
    '..lbl.lbLbl.....',
    '..bbb.bbbbb.....',
    '..ddd.ddddd.....',
    '................',
  ],
};

/** Reeds (near water) */
export const OBJ_REEDS: PixelPattern = {
  width: 16, height: 16,
  palette: GRASS_OBJ_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '......L.L.......',
    '.....Lb.bL......',
    '.....lb.bl......',
    '....lb..bl......',
    '....lb..bl......',
    '....b...bb......',
    '...lb..lbl......',
    '...bb..bbb......',
    '...bb..bbb......',
    '...db..ddb......',
    '...dd..ddd......',
    '................',
    '................',
  ],
};

// ── ROCKS / BOULDERS ──
const ROCK_PAL: Record<string, [number, number, number]> = {
  s: [56, 56, 58],     // shadow
  d: [76, 76, 80],     // dark
  b: [96, 96, 100],    // base
  l: [120, 120, 124],  // light
  h: [144, 144, 148],  // highlight
};

/** Small rock */
export const OBJ_ROCK_SMALL: PixelPattern = {
  width: 16, height: 16,
  palette: ROCK_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......hlb......',
    '......hllbd.....',
    '......lbbds.....',
    '.......sss......',
    '................',
    '................',
  ],
};

/** Medium rock */
export const OBJ_ROCK_MEDIUM: PixelPattern = {
  width: 16, height: 16,
  palette: ROCK_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......hlb.......',
    '.....hllbb......',
    '....hllbbbd.....',
    '...hlllbbbd.....',
    '...hllbbbds.....',
    '....bbbbds......',
    '.....ssss.......',
    '................',
    '................',
  ],
};

/** Large boulder */
export const OBJ_ROCK_LARGE: PixelPattern = {
  width: 16, height: 16,
  palette: ROCK_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '......hhlb......',
    '.....hhllbb.....',
    '....hhlllbbb....',
    '...hhllllbbbd...',
    '...hllllbbbbd...',
    '..hhlllbbbbds...',
    '..hllllbbbds....',
    '..hlllbbbbds....',
    '...hbbbbbbds....',
    '...dbbbbdds.....',
    '....ssssss......',
    '................',
    '................',
  ],
};

/** Mossy boulder */
export const OBJ_ROCK_MOSSY: PixelPattern = {
  width: 16, height: 16,
  palette: {
    ...ROCK_PAL,
    m: [45, 90, 60],    // moss
    M: [58, 110, 75],   // moss highlight
  },
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '.....Mhlb.......',
    '....Mhllbb......',
    '...mhllbbbd.....',
    '...Mhlllbbd.....',
    '..mhllbbbds.....',
    '..Mhlbbbbds.....',
    '...hbbbbds......',
    '....bbbds.......',
    '.....ssss.......',
    '................',
    '................',
    '................',
  ],
};

// ── SLEEPING BAG ──
const SLEEPBAG_PAL: Record<string, [number, number, number]> = {
  b: [40, 60, 90],     // bag blue
  B: [50, 75, 110],    // bag highlight
  d: [30, 45, 70],     // bag dark
  p: [70, 55, 40],     // pillow
  P: [85, 70, 55],     // pillow highlight
};

export const OBJ_SLEEPING_BAG: PixelPattern = {
  width: 16, height: 16,
  palette: SLEEPBAG_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....pPPp........',
    '...dbbBBbd......',
    '...dbbbBbd......',
    '...dbbBBbd......',
    '....dddddd......',
    '................',
    '................',
  ],
};

// ── TORCH PILLAR ──
const TORCH_PAL: Record<string, [number, number, number]> = {
  s: [80, 80, 84],     // stone base
  S: [96, 96, 100],    // stone highlight
  d: [64, 64, 68],     // stone dark
  w: [122, 90, 32],    // wood shaft
  W: [140, 108, 44],   // wood highlight
  f: [240, 180, 50],   // flame
  F: [255, 220, 100],  // flame bright
  r: [220, 100, 30],   // flame red
};

export const OBJ_TORCH_PILLAR: PixelPattern = {
  width: 16, height: 16,
  palette: TORCH_PAL,
  pixels: [
    '................',
    '.......F........',
    '......fFf.......',
    '......rfr.......',
    '.......w........',
    '.......w........',
    '.......w........',
    '.......W........',
    '.......w........',
    '.......w........',
    '.......W........',
    '.......w........',
    '......dSd.......',
    '.....dSSSd......',
    '.....dsssd......',
    '......ddd.......',
  ],
};

// ── DOOR (closed) ──
const DOOR_CLOSED_PAL: Record<string, [number, number, number]> = {
  w: [90, 65, 35],     // wood
  W: [110, 82, 48],    // wood highlight
  d: [70, 50, 28],     // frame
  h: [140, 110, 60],   // handle
  k: [50, 42, 30],     // dark
};

export const OBJ_DOOR_CLOSED: PixelPattern = {
  width: 16, height: 16,
  palette: DOOR_CLOSED_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '.....dddddd.....',
    '.....dwwwwd.....',
    '.....dwWwwd.....',
    '.....dwwhwd.....',
    '.....dwWwwd.....',
    '.....dwwwwd.....',
    '.....dwWwwd.....',
    '.....dwwwwd.....',
    '.....dddddd.....',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ── DOOR (open) ──
export const OBJ_DOOR_OPEN: PixelPattern = {
  width: 16, height: 16,
  palette: DOOR_CLOSED_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '.....d....d.....',
    '.....d....d.....',
    '.....d....d.....',
    '.....d....d.....',
    '.....d....d.....',
    '.....d....d.....',
    '.....d....d.....',
    '.....d....d.....',
    '.....d....d.....',
    '................',
    '................',
    '................',
    '................',
  ],
};
