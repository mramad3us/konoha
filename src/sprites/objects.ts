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

// ── FUTON / BED ──
const SLEEPBAG_PAL: Record<string, [number, number, number]> = {
  b: [55, 75, 110],    // blanket blue
  B: [70, 90, 130],    // blanket highlight
  d: [40, 55, 80],     // blanket dark
  p: [180, 170, 150],  // pillow cream
  P: [200, 190, 170],  // pillow highlight
  m: [120, 100, 70],   // mat/frame
  M: [140, 120, 85],   // mat highlight
};

export const OBJ_SLEEPING_BAG: PixelPattern = {
  width: 16, height: 16,
  palette: SLEEPBAG_PAL,
  pixels: [
    '................',
    '................',
    '.......pP.......',
    '......pPPPp.....',
    '.....MpPPPpM....',
    '....MdbbBbdM....',
    '...MdbBBBbdM....',
    '..MdbbBBbbdM....',
    '..MdbBBBBbdM....',
    '...MdbbBbdM.....',
    '....MdddM.......',
    '.....MmM........',
    '......M.........',
    '................',
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

// ── DOOR (closed) — solid wood panel with frame and handle ──
const DOOR_CLOSED_PAL: Record<string, [number, number, number]> = {
  w: [100, 72, 40],    // wood planks
  W: [120, 90, 52],    // wood highlight
  d: [60, 45, 25],     // frame dark
  D: [75, 56, 32],     // frame mid
  h: [160, 130, 60],   // handle (brass)
  k: [45, 35, 20],     // shadow
  p: [85, 62, 35],     // panel mid
};

export const OBJ_DOOR_CLOSED: PixelPattern = {
  width: 16, height: 16,
  palette: DOOR_CLOSED_PAL,
  pixels: [
    '................',
    '................',
    '....ddDDDDdd....',
    '....dwwWWwwd....',
    '....dwwWWwwd....',
    '....dpppppDd....',
    '....dwwWhwwd....',
    '....dwwWWwwd....',
    '....dpppppDd....',
    '....dwwWWwwd....',
    '....dwwWWwwd....',
    '....dkkkkkdd....',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ── DOOR (open) — hinged to left side, showing frame ──
export const OBJ_DOOR_OPEN: PixelPattern = {
  width: 16, height: 16,
  palette: DOOR_CLOSED_PAL,
  pixels: [
    '................',
    '................',
    '....dd....dd....',
    '....dw....Dd....',
    '....dW.....d....',
    '....dp.....d....',
    '....dw.....d....',
    '....dW.....d....',
    '....dp.....d....',
    '....dw.....d....',
    '....dW.....d....',
    '....dk....kd....',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ── DESK (wooden, with items on top) ──
const DESK_PAL: Record<string, [number, number, number]> = {
  w: [110, 80, 45],     // wood
  W: [130, 98, 58],     // highlight
  d: [85, 60, 32],      // dark
  t: [70, 50, 28],      // legs
  s: [180, 170, 150],   // scroll/paper on top
  i: [60, 55, 50],      // ink pot
};

export const OBJ_DESK: PixelPattern = {
  width: 16, height: 16,
  palette: DESK_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '.......si.......',
    '......sWWs......',
    '.....dWWWWd.....',
    '....dWwWwWWd....',
    '...dWwwwwwWd....',
    '...dwwwwwwwd....',
    '....ddddddd.....',
    '....t.....t.....',
    '....t.....t.....',
    '....t.....t.....',
    '................',
    '................',
    '................',
  ],
};

// ── SHELF / BOOKSHELF (tall, with scrolls) ──
const SHELF_PAL: Record<string, [number, number, number]> = {
  w: [100, 72, 40],     // wood frame
  W: [120, 90, 52],     // wood highlight
  d: [75, 55, 30],      // dark
  s: [180, 165, 130],   // scroll tan
  S: [160, 140, 100],   // scroll dark
  b: [60, 80, 120],     // blue scroll
  r: [140, 50, 45],     // red scroll
};

export const OBJ_SHELF: PixelPattern = {
  width: 16, height: 16,
  palette: SHELF_PAL,
  pixels: [
    '................',
    '................',
    '.....dWWWWd.....',
    '.....wsSbsw.....',
    '.....wrssSw.....',
    '.....dWWWWd.....',
    '.....wSsbsw.....',
    '.....wsrsSw.....',
    '.....dWWWWd.....',
    '.....wsSrsw.....',
    '.....wsbsSw.....',
    '.....dWWWWd.....',
    '.....dddddd.....',
    '................',
    '................',
    '................',
  ],
};

// ── COUNTER (shop counter, wide) ──
const COUNTER_PAL: Record<string, [number, number, number]> = {
  w: [105, 78, 45],
  W: [125, 95, 55],
  d: [80, 58, 32],
  t: [65, 48, 28],     // front face
  T: [78, 58, 35],     // front highlight
};

export const OBJ_COUNTER: PixelPattern = {
  width: 16, height: 16,
  palette: COUNTER_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '....dWWWWWWd....',
    '...dWwwwwwWWd...',
    '..dWwwwwwwwWd...',
    '..dwwwwwwwwwd...',
    '..tTtTtTtTtTt...',
    '..tTtTtTtTtTt...',
    '..tTtTtTtTtTt...',
    '..tttttttttttt..',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ── WEAPONS RACK ──
const WRACK_PAL: Record<string, [number, number, number]> = {
  w: [90, 65, 35],      // wood
  W: [110, 82, 48],     // highlight
  d: [70, 50, 28],      // dark
  s: [180, 180, 190],   // steel blade
  S: [140, 140, 150],   // steel dark
  h: [100, 70, 30],     // handle
};

export const OBJ_WEAPONS_RACK: PixelPattern = {
  width: 16, height: 16,
  palette: WRACK_PAL,
  pixels: [
    '................',
    '................',
    '.....dWWWWd.....',
    '.....wsShsw.....',
    '.....w.ss.w.....',
    '.....dWWWWd.....',
    '.....whsSsw.....',
    '.....w.ss.w.....',
    '.....dWWWWd.....',
    '.....wsSshw.....',
    '.....w.ss.w.....',
    '.....dWWWWd.....',
    '.....dddddd.....',
    '................',
    '................',
    '................',
  ],
};

// ── MEDICINE CABINET ──
const MEDCAB_PAL: Record<string, [number, number, number]> = {
  w: [200, 195, 185],   // white cabinet
  W: [215, 210, 200],   // highlight
  d: [170, 165, 155],   // shadow
  r: [160, 40, 40],     // red cross
  b: [100, 140, 120],   // green bottle
  B: [80, 120, 100],    // bottle dark
};

export const OBJ_MEDICINE_CABINET: PixelPattern = {
  width: 16, height: 16,
  palette: MEDCAB_PAL,
  pixels: [
    '................',
    '................',
    '.....dWWWWd.....',
    '.....w.r..w.....',
    '.....wrrr.w.....',
    '.....w.r..w.....',
    '.....dWWWWd.....',
    '.....wbBbBw.....',
    '.....wBbBbw.....',
    '.....wbBbBw.....',
    '.....dWWWWd.....',
    '.....dddddd.....',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ── WELL (stone circle with wooden frame + rope) ──
const WELL_PAL: Record<string, [number, number, number]> = {
  s: [90, 88, 85],      // stone
  S: [110, 108, 104],   // stone highlight
  d: [70, 68, 65],      // stone dark
  w: [100, 72, 38],     // wood beam
  W: [120, 90, 50],     // wood highlight
  r: [80, 65, 50],      // rope
  b: [30, 50, 80],      // water inside
};

export const OBJ_WELL: PixelPattern = {
  width: 16, height: 16,
  palette: WELL_PAL,
  pixels: [
    '................',
    '................',
    '.......Wr.......',
    '.......Wr.......',
    '.......Wr.......',
    '......WwwW......',
    '.....dSSSSd.....',
    '....dSbbbbSd....',
    '...dSbbbbbbSd...',
    '...dSbbbbbbSd...',
    '....dSbbbbSd....',
    '.....dSSSSd.....',
    '......dddd......',
    '................',
    '................',
    '................',
  ],
};

// ── WATER BARREL (wooden barrel with metal bands) ──
const BARREL_PAL: Record<string, [number, number, number]> = {
  w: [100, 70, 35],     // wood stave
  W: [120, 88, 48],     // highlight
  d: [78, 55, 28],      // dark
  m: [80, 82, 85],      // metal band
  M: [100, 102, 105],   // metal highlight
  b: [30, 50, 80],      // water top
};

export const OBJ_BARREL: PixelPattern = {
  width: 16, height: 16,
  palette: BARREL_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '......bbbb......',
    '.....dwWWwd.....',
    '.....mMMMMm.....',
    '.....dwWWwd.....',
    '.....dwwwwd.....',
    '.....mMMMMm.....',
    '.....dwWWwd.....',
    '.....dwwwwd.....',
    '.....mMMMMm.....',
    '......dddd......',
    '................',
    '................',
    '................',
  ],
};

// ── SCARECROW (straw figure on a wooden cross) ──
const SCARECROW_PAL: Record<string, [number, number, number]> = {
  w: [90, 65, 30],      // wood pole
  W: [110, 82, 42],     // pole highlight
  s: [190, 165, 100],   // straw body
  S: [170, 145, 85],    // straw dark
  h: [160, 140, 80],    // straw hat
  H: [180, 160, 95],    // hat highlight
  c: [40, 55, 80],      // cloth scraps
};

export const OBJ_SCARECROW: PixelPattern = {
  width: 16, height: 16,
  palette: SCARECROW_PAL,
  pixels: [
    '................',
    '................',
    '.......HH.......',
    '......hHHh......',
    '......sSSs......',
    '.....csSSSc.....',
    '....cssSSSsc....',
    '......sSSs......',
    '.......Ws.......',
    '.......Ww.......',
    '.......Ww.......',
    '.......Ww.......',
    '.......Ww.......',
    '......wwww......',
    '................',
    '................',
  ],
};

// ── BENCH (wooden, simple) ──
const BENCH_PAL: Record<string, [number, number, number]> = {
  w: [105, 78, 42],     // wood seat
  W: [125, 95, 55],     // highlight
  d: [82, 60, 32],      // dark
  l: [70, 52, 28],      // legs
};

export const OBJ_BENCH: PixelPattern = {
  width: 16, height: 16,
  palette: BENCH_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....dWWWWWWd....',
    '...dWwwwwwWWd...',
    '...dwwwwwwwwd...',
    '....ddddddddd..',
    '....l......l....',
    '....l......l....',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ── TORII GATE (red gate post) ──
const TORII_PAL: Record<string, [number, number, number]> = {
  r: [178, 34, 52],    // red paint
  R: [210, 52, 68],    // red highlight
  d: [140, 24, 38],    // red dark
  w: [90, 70, 40],     // wood base
  k: [60, 45, 25],     // dark wood
};

export const OBJ_TORII: PixelPattern = {
  width: 16, height: 16,
  palette: TORII_PAL,
  pixels: [
    '................',
    '..dRRRRRRRRRd..',
    '..dddddddddddd.',
    '...rR......Rr..',
    '...rR......Rr..',
    '..dRRRRRRRRRd..',
    '...rR......Rr..',
    '...rR......Rr..',
    '...rR......Rr..',
    '...rR......Rr..',
    '...rR......Rr..',
    '...rR......Rr..',
    '...rR......Rr..',
    '..kwk......kwk.',
    '..kkk......kkk.',
    '................',
  ],
};

// ── ALTAR / OFFERING STONE ──
const ALTAR_PAL: Record<string, [number, number, number]> = {
  s: [140, 140, 145],  // stone
  S: [160, 160, 168],  // stone highlight
  d: [100, 100, 108],  // stone dark
  c: [180, 160, 120],  // candle/offering
  f: [240, 180, 60],   // flame
};

export const OBJ_ALTAR: PixelPattern = {
  width: 16, height: 16,
  palette: ALTAR_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '.......f........',
    '......fc........',
    '...dSSSSSSSd....',
    '...dSssssSsd....',
    '...dSssssSsd....',
    '...dddddddddd..',
    '....dSSSSSSd....',
    '....dsssssd.....',
    '....dsssssd.....',
    '....ddddddd.....',
    '................',
    '................',
    '................',
  ],
};

// ── MEMORIAL STONE (polished monument) ──
const MEMORIAL_PAL: Record<string, [number, number, number]> = {
  s: [120, 120, 130],  // polished stone
  S: [150, 150, 160],  // stone highlight
  d: [80, 80, 90],     // stone dark
  g: [60, 90, 40],     // moss/grass at base
  i: [180, 170, 140],  // inscription
};

export const OBJ_MEMORIAL: PixelPattern = {
  width: 16, height: 16,
  palette: MEMORIAL_PAL,
  pixels: [
    '................',
    '.....dSSd.......',
    '....dSSSSd......',
    '....dSiiSd......',
    '....dSiiSd......',
    '....dSiiSd......',
    '....dSiiSd......',
    '....dSiiSd......',
    '....dSsSsd......',
    '...ddssssdd.....',
    '...ddssssddd....',
    '..gddddddddg...',
    '..gg..gg..ggg...',
    '................',
    '................',
    '................',
  ],
};

// ── SUPPLY CRATE (wooden crate) ──
const CRATE_PAL: Record<string, [number, number, number]> = {
  w: [130, 100, 55],   // wood
  W: [155, 120, 68],   // wood highlight
  d: [90, 68, 35],     // wood dark
  m: [100, 90, 70],    // metal band
  M: [130, 118, 95],   // metal highlight
};

export const OBJ_CRATE: PixelPattern = {
  width: 16, height: 16,
  palette: CRATE_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '....dWWWWWd.....',
    '....mMMMMMm.....',
    '....dWwwWWd.....',
    '....dWwwwWd.....',
    '....mMMMMMm.....',
    '....dWwwWWd.....',
    '....dWwwwWd.....',
    '....mMMMMMm.....',
    '....ddddddd.....',
    '................',
    '................',
    '................',
  ],
};

// ── SCROLL CASE (small cylindrical case) ──
const SCROLL_PAL: Record<string, [number, number, number]> = {
  p: [180, 160, 130],  // parchment
  P: [200, 185, 155],  // parchment highlight
  d: [130, 110, 80],   // parchment dark
  r: [140, 50, 50],    // red seal/cap
  R: [170, 65, 65],    // red highlight
};

export const OBJ_SCROLL_CASE: PixelPattern = {
  width: 16, height: 16,
  palette: SCROLL_PAL,
  pixels: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....rPPPPr.....',
    '.....RPppPR.....',
    '.....rddddr.....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};
