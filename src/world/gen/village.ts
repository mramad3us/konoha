/**
 * Konohagakure — a compact, hand-planned village (96×96) built procedurally from a district plan.
 * Doors only on the two visible faces (south 'sw', east 'se'), so the street plan puts every
 * entrance where the camera can see it.
 */

import { Level } from '../../ecs/level.ts';
import type { EntityId } from '../../ecs/components.ts';
import type { Vec } from '../../core/geometry.ts';
import { Rng } from '../../core/rng.ts';
import { T, P } from '../tiles.ts';
import { fbm } from './noise.ts';
import { BUILDING_STYLES } from '../../art/buildings.ts';
import { spawnDummy } from '../../sim/spawn.ts';

export const VILLAGE_SIZE = 96;

export interface Spots {
  gate: Vec;
  start: Vec;
  plaza: Vec;
  market: Vec;
  training: Vec;
  arena: Vec;
  pond: Vec;
  river: Vec;
  hospitalDoor: Vec;
  homeDoor: Vec;
  /** Front doors of residential houses (for villager homes). */
  houses: Vec[];
  /** Named work spots. */
  work: Record<string, Vec>;
}

export interface VillageResult { level: Level; spots: Spots; facilities: Record<string, EntityId> }

interface BuildingSpec {
  style: string;
  x: number; y: number; w: number; d: number;
  facility?: string;
  label?: string;
}

export function generateVillage(seed: number): VillageResult {
  const rng = new Rng(seed);
  const N = VILLAGE_SIZE;
  const lv = new Level('village', 'village', N, N, { name: 'Konohagakure' });

  // ── Ground ──
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = fbm(x, y, 12, seed, 3);
    lv.tiles[y * N + x] = n > 0.6 ? T.grass_lush : T.grass;
    const edge = Math.min(x, y, N - 1 - x, N - 1 - y);
    if (edge < 3) lv.tiles[y * N + x] = T.forest_floor;
  }

  const rect = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lv.inBounds(x, y)) lv.setTile(x, y, t);
  };
  const clearProps = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lv.inBounds(x, y)) lv.setProp(x, y, P.none);
  };

  // ── River (west → east, north of the plaza) ──
  const riverY: number[] = [];
  let ry = 34;
  for (let x = 0; x < N; x++) {
    ry += Math.round((fbm(x, 0, 10, seed + 5) - 0.5) * 1.2);
    ry = Math.max(31, Math.min(37, ry));
    riverY.push(ry);
    for (let d = -3; d <= 3; d++) {
      const a = Math.abs(d);
      lv.setTile(x, ry + d, a <= 1 ? T.deep : a === 2 ? T.shallow : T.sand);
    }
  }

  // ── Roads ──
  rect(46, 22, 48, 94, T.road);          // Main Street (gate → tower)
  rect(8, 70, 88, 71, T.road);           // Market Avenue
  rect(38, 43, 57, 55, T.plaza);         // Central plaza
  rect(16, 40, 17, 70, T.road);          // Training road
  rect(65, 40, 66, 90, T.road);          // East lane
  rect(79, 40, 80, 90, T.road);          // Far east lane
  rect(48, 57, 90, 57, T.road);          // Residential cross street
  rect(48, 83, 90, 83, T.road);
  // Bridges over the river
  for (const bx of [[46, 48], [16, 17], [65, 66], [79, 80]]) {
    for (let x = bx[0]; x <= bx[1]; x++) for (let d = -3; d <= 3; d++) lv.setTile(x, riverY[x] + d, T.planks);
  }

  // ── Palisade with the great gate in the south ──
  const W0 = 3, W1 = N - 4;
  for (let i = W0; i <= W1; i++) {
    for (const [x, y] of [[i, W0], [i, W1], [W0, i], [W1, i]] as const) {
      if (lv.isWater(x, y)) continue;
      if (y === W1 && x >= 44 && x <= 50) continue;  // gate gap
      lv.setProp(x, y, P.palisade);
    }
  }
  rect(44, W1, 50, N - 1, T.road);
  // Outside the walls: forest.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const outside = x < W0 || y < W0 || x > W1 || y > W1;
    if (!outside || lv.isWater(x, y) || lv.tile(x, y) === T.road) continue;
    if (rng.chance(0.55)) lv.setProp(x, y, rng.chance(0.5) ? P.tree_pine : P.tree_broad);
  }

  // ── Hokage monument cliff ──
  for (let y = 4; y <= 9; y++) for (let x = 30; x <= 64; x++) {
    if (y === 9 && (x < 34 || x > 60)) continue;
    lv.setProp(x, y, P.cliff);
  }
  rect(40, 10, 54, 13, T.plaza);

  // ── Training grounds (west) ──
  rect(6, 40, 30, 66, T.dirt);
  for (let y = 40; y <= 66; y++) for (let x = 6; x <= 30; x++) if (fbm(x, y, 5, seed + 2) > 0.62) lv.setTile(x, y, T.grass);
  const arena: Vec = { x: 23, y: 55 };
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    const x = Math.round(arena.x + Math.cos(t) * 5), y = Math.round(arena.y + Math.sin(t) * 5);
    if (!(y > arena.y + 3 && Math.abs(x - arena.x) <= 1)) lv.setProp(x, y, P.fence);
  }
  const pond: Vec = { x: 10, y: 45 };
  for (let y = pond.y - 3; y <= pond.y + 3; y++) for (let x = pond.x - 3; x <= pond.x + 3; x++) {
    const d = Math.hypot(x - pond.x, y - pond.y);
    if (d <= 2) lv.setTile(x, y, T.deep);
    else if (d <= 3) lv.setTile(x, y, T.shallow);
  }
  lv.setProp(pond.x + 4, pond.y - 1, P.lantern);
  lv.setProp(pond.x + 3, pond.y + 3, P.rock_large);
  for (const [x, y] of [[20, 44], [22, 44], [24, 44], [26, 44]]) lv.setProp(x, y, P.post);
  for (const [x, y] of [[10, 58], [10, 61], [10, 64]]) lv.setProp(x, y, P.target);
  const dummies: EntityId[] = [];
  for (const [x, y] of [[20, 48], [23, 48], [26, 48]]) dummies.push(spawnDummy(lv, x, y));
  lv.setProp(18, 42, P.sign);

  // ── Fields (south-west) ──
  rect(8, 75, 36, 90, T.field);
  for (let x = 7; x <= 37; x++) { lv.setProp(x, 74, P.fence); lv.setProp(x, 91, P.fence); }
  for (let y = 75; y <= 90; y++) { lv.setProp(7, y, P.fence); lv.setProp(37, y, P.fence); }
  lv.setProp(37, 82, P.none);

  // ── Buildings ──
  const buildings: BuildingSpec[] = [
    { style: 'tower', x: 44, y: 15, w: 7, d: 6, facility: 'desk', label: 'Hokage Tower' },
    { style: 'hospital', x: 30, y: 44, w: 6, d: 5, facility: 'hospital', label: 'Konoha Hospital' },
    { style: 'academy', x: 51, y: 39, w: 6, d: 3, facility: 'academy', label: 'Ninja Academy' },
    { style: 'shop', x: 41, y: 59, w: 4, d: 3, facility: 'shop', label: 'Kurogane Arms' },
    { style: 'ramen', x: 51, y: 60, w: 3, d: 3, facility: 'ramen', label: 'Ichigo Ramen' },
    { style: 'house_red', x: 41, y: 64, w: 4, d: 3 },
    { style: 'house', x: 51, y: 65, w: 3, d: 3 },
    { style: 'gatehouse', x: 41, y: 89, w: 3, d: 3, label: 'Gatehouse' },
    { style: 'gatehouse', x: 51, y: 89, w: 3, d: 3, label: 'Gatehouse' },
    { style: 'shed', x: 19, y: 41, w: 2, d: 1, facility: 'training', label: 'Training Shed' },
    { style: 'home', x: 69, y: 72, w: 3, d: 2, facility: 'home', label: 'Your Home' },
  ];
  // Residential blocks between the lanes.
  const houses: Vec[] = [];
  const styles = ['house', 'house_red', 'house_green', 'house'];
  for (const bx of [58, 68, 82]) {
    for (let by = 44; by <= 86; by += 6) {
      if (bx === 68 && by === 74) continue; // our home plot
      if (by >= 54 && by <= 59) continue;    // cross street
      if (by >= 80 && by <= 85) continue;
      if (bx === 58 && by >= 62 && by <= 68) continue;
      const w = 3 + (rng.chance(0.3) ? 1 : 0), d = 2 + (rng.chance(0.3) ? 1 : 0);
      if (bx + w >= 79 && bx < 79) continue;
      buildings.push({ style: rng.pick(styles), x: bx + (bx === 82 ? 1 : 0), y: by, w: Math.min(w, bx === 82 ? 4 : w), d });
    }
  }
  // Market stalls along the avenue.
  for (const x of [22, 26, 30, 34, 56, 60, 72, 76, 86]) lv.setProp(x, 68, P.stall);
  for (const x of [24, 28, 32, 58, 62, 74, 84]) lv.setProp(x, 73, P.stall);

  const facilities: Record<string, EntityId> = {};
  let homeDoor: Vec = { x: 70, y: 74 };
  let hospitalDoor: Vec = { x: 35, y: 46 };
  for (const b of buildings) {
    const st = BUILDING_STYLES[b.style];
    clearProps(b.x - 1, b.y - 1, b.x + b.w, b.y + b.d);
    const id = lv.create();
    lv.add(id, 'pos', { x: b.x, y: b.y, facing: 's' });
    lv.add(id, 'structure', { w: b.w, d: b.d, style: b.style, label: b.label });
    if (b.label) lv.add(id, 'name', { name: b.label });
    for (let y = b.y; y < b.y + b.d; y++) for (let x = b.x; x < b.x + b.w; x++) lv.structs[lv.idx(x, y)] = 1;
    // Door: a cell on the footprint edge; the cell in front becomes a doorstep path.
    if (st.door) {
      const door: Vec = st.door.face === 'sw' ? { x: b.x + Math.min(st.door.at, b.w - 1), y: b.y + b.d - 1 } : { x: b.x + b.w - 1, y: b.y + Math.min(st.door.at, b.d - 1) };
      const step: Vec = st.door.face === 'sw' ? { x: door.x, y: door.y + 1 } : { x: door.x + 1, y: door.y };
      const e = lv.create();
      lv.add(e, 'pos', { x: door.x, y: door.y, facing: 's' });
      lv.add(e, 'name', { name: b.label ?? 'a house' });
      if (b.facility) {
        lv.add(e, 'interact', { kind: 'facility', label: `Enter ${b.label}`, facility: b.facility });
        facilities[b.facility] = e;
      } else {
        lv.add(e, 'interact', { kind: 'examine', label: 'Knock' });
        houses.push(step);
      }
      if (lv.tile(step.x, step.y) !== T.road && lv.tile(step.x, step.y) !== T.plaza) lv.setTile(step.x, step.y, T.dirt);
      lv.setProp(step.x, step.y, P.none);
      if (b.facility === 'home') homeDoor = step;
      if (b.facility === 'hospital') hospitalDoor = step;
    }
  }

  // Doorstep paths to the nearest road for houses east of lanes.
  for (const h of houses) {
    let x = h.x;
    while (x > 0 && lv.tile(x, h.y) !== T.road && x > h.x - 6) { if (!lv.structs[lv.idx(x, h.y)]) { lv.setTile(x, h.y, T.dirt); lv.setProp(x, h.y, P.none); } x--; }
  }

  // ── Dressing: lanterns, trees, planters, plaza ──
  for (let y = 26; y <= 92; y += 6) for (const x of [45, 49]) if (!lv.isWater(x, y) && !lv.structs[lv.idx(x, y)] && lv.tile(x, y) !== T.planks) lv.setProp(x, y, P.lantern);
  for (const [x, y] of [[40, 45], [55, 45], [40, 53], [55, 53]]) lv.setProp(x, y, P.tree_sakura);
  lv.setProp(47, 49, P.well);
  for (const [x, y] of [[42, 49], [52, 49]]) lv.setProp(x, y, P.bench);
  for (const [x, y] of [[44, 44], [50, 44], [44, 54], [50, 54]]) lv.setProp(x, y, P.planter);
  // Sakura along the river banks.
  for (let x = 4; x < N - 4; x += 3) {
    for (const side of [-4, 4]) {
      const y = riverY[x] + side;
      if (lv.inBounds(x, y) && lv.tile(x, y) !== T.road && lv.tile(x, y) !== T.planks && !lv.structs[lv.idx(x, y)] && !lv.prop(x, y) && rng.chance(0.55)) {
        lv.setProp(x, y, rng.chance(0.6) ? P.tree_sakura : P.tree_broad);
      }
    }
  }
  // Scatter greenery on free grass.
  for (let y = 4; y < N - 4; y++) for (let x = 4; x < N - 4; x++) {
    const i = lv.idx(x, y);
    if (lv.props[i] || lv.structs[i]) continue;
    const t = lv.tiles[i];
    if (t !== T.grass && t !== T.grass_lush) continue;
    if (rng.chance(0.02)) lv.setProp(x, y, rng.pick([P.tree_broad, P.tree_broad, P.tree_pine, P.tree_sakura]));
    else if (rng.chance(0.03)) lv.setProp(x, y, P.flowers);
    else if (rng.chance(0.012)) lv.setProp(x, y, P.bush);
  }
  // Keep roads and doorsteps clear of anything solid.
  for (let i = 0; i < lv.props.length; i++) {
    const t = lv.tiles[i];
    if ((t === T.road || t === T.plaza || t === T.planks) && lv.props[i] !== P.lantern && lv.props[i] !== P.well && lv.props[i] !== P.bench && lv.props[i] !== P.planter && lv.props[i] !== P.tree_sakura && lv.props[i] !== P.palisade) {
      lv.props[i] = P.none;
    }
  }

  lv.meta.exitZone = { x0: 44, y0: N - 2, x1: 50, y1: N - 1 };
  const spots: Spots = {
    gate: { x: 47, y: 90 },
    start: { x: 47, y: 86 },
    plaza: { x: 47, y: 51 },
    market: { x: 30, y: 71 },
    training: { x: 18, y: 50 },
    arena: { x: 23, y: 55 },
    pond: { x: 14, y: 45 },
    river: { x: 30, y: riverY[30] + 4 },
    hospitalDoor,
    homeDoor,
    houses,
    work: {
      shop: { x: 45, y: 60 }, ramen: { x: 52, y: 63 }, hospital: hospitalDoor, academy: { x: 54, y: 43 },
      tower: { x: 47, y: 22 }, fields: { x: 22, y: 82 }, market: { x: 30, y: 71 }, plaza: { x: 47, y: 51 },
      river: { x: 30, y: riverY[30] + 4 }, training: { x: 18, y: 50 }, gate: { x: 47, y: 90 },
    },
  };
  void dummies;
  return { level: lv, spots, facilities };
}
