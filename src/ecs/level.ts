/**
 * Level: one map and everything on it — terrain, props, entities, its scheduler and outbox.
 */

import { Scheduler } from '../core/scheduler.ts';
import type { Dir8, Vec } from '../core/geometry.ts';
import { TILES, PROPS, T } from '../world/tiles.ts';
import type { SimEvent } from './events.ts';
import { COMPONENT_KEYS, type Components, type ComponentKey, type EntityId, type Stores } from './components.ts';
import { CHUNK } from '../core/config.ts';

export type LevelKind = 'village' | 'mission' | 'encounter';

export interface LevelMeta {
  name: string;
  /** Tiles where the player can leave the map (away levels). */
  exitZone?: { x0: number; y0: number; x1: number; y1: number };
  [key: string]: unknown;
}

export class Level {
  readonly id: string;
  readonly kind: LevelKind;
  readonly width: number;
  readonly height: number;

  tiles: Uint8Array;
  props: Uint16Array;
  /** Building footprints: 1 = solid and opaque. */
  structs: Uint8Array;
  visible: Uint8Array;
  explored: Uint8Array;

  readonly c: Stores;
  readonly entities = new Set<EntityId>();
  nextId = 1;
  playerId: EntityId = 0;

  scheduler = new Scheduler();
  outbox: SimEvent[] = [];
  meta: LevelMeta;

  /** Chunks whose terrain/props changed since the renderer last looked. */
  dirtyChunks = new Set<number>();
  /** Bumped whenever anything that affects sight changes (doors, props). */
  sightVersion = 0;

  private cells: Array<EntityId[] | undefined>;

  constructor(id: string, kind: LevelKind, width: number, height: number, meta: LevelMeta) {
    this.id = id;
    this.kind = kind;
    this.width = width;
    this.height = height;
    this.meta = meta;
    const n = width * height;
    this.tiles = new Uint8Array(n).fill(T.grass);
    this.props = new Uint16Array(n);
    this.structs = new Uint8Array(n);
    this.visible = new Uint8Array(n);
    this.explored = new Uint8Array(n);
    this.cells = new Array(n);
    const c = {} as Record<ComponentKey, Map<EntityId, unknown>>;
    for (const k of COMPONENT_KEYS) c[k] = new Map();
    this.c = c as Stores;
  }

  // ── Cells ──

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  tile(x: number, y: number): number {
    return this.inBounds(x, y) ? this.tiles[y * this.width + x] : T.void;
  }

  prop(x: number, y: number): number {
    return this.inBounds(x, y) ? this.props[y * this.width + x] : 0;
  }

  setTile(x: number, y: number, t: number): void {
    if (!this.inBounds(x, y)) return;
    this.tiles[y * this.width + x] = t;
    this.markDirty(x, y);
  }

  setProp(x: number, y: number, p: number): void {
    if (!this.inBounds(x, y)) return;
    this.props[y * this.width + x] = p;
    this.markDirty(x, y);
    this.sightVersion++;
  }

  private markDirty(x: number, y: number): void {
    const cw = Math.ceil(this.width / CHUNK);
    this.dirtyChunks.add(Math.floor(y / CHUNK) * cw + Math.floor(x / CHUNK));
  }

  /** Terrain + props + structures allow standing here (ignores entities). */
  isPassable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = y * this.width + x;
    if (this.structs[i]) return false;
    if (PROPS[this.props[i]].solid) return false;
    return TILES[this.tiles[i]].walkable;
  }

  isWater(x: number, y: number): 0 | 1 | 2 {
    return TILES[this.tile(x, y)].water as 0 | 1 | 2;
  }

  /** Deep water you could cross by swimming/water walking (passable if not for depth). */
  isSwimmable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = y * this.width + x;
    return TILES[this.tiles[i]].water === 2 && !this.structs[i] && !PROPS[this.props[i]].solid;
  }

  isOpaque(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    const i = y * this.width + x;
    if (this.structs[i] || PROPS[this.props[i]].opaque) return true;
    const ids = this.cells[i];
    if (ids) for (const id of ids) if (this.c.blocker.get(id)?.sight) return true;
    return false;
  }

  hasCover(x: number, y: number): boolean {
    return PROPS[this.prop(x, y)].cover;
  }

  // ── Entities ──

  create(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  destroy(id: EntityId): void {
    const pos = this.c.pos.get(id);
    if (pos) this.unindex(id, pos.x, pos.y);
    for (const k of COMPONENT_KEYS) this.c[k].delete(id);
    this.entities.delete(id);
    this.scheduler.unschedule(id);
  }

  add<K extends ComponentKey>(id: EntityId, key: K, value: Components[K]): Components[K] {
    if (key === 'pos') {
      const old = this.c.pos.get(id);
      if (old) this.unindex(id, old.x, old.y);
      const p = value as Components['pos'];
      this.index(id, p.x, p.y);
    }
    (this.c[key] as Map<EntityId, Components[K]>).set(id, value);
    return value;
  }

  get<K extends ComponentKey>(id: EntityId, key: K): Components[K] | undefined {
    return (this.c[key] as Map<EntityId, Components[K]>).get(id);
  }

  has(id: EntityId, key: ComponentKey): boolean {
    return this.c[key].has(id);
  }

  remove(id: EntityId, key: ComponentKey): void {
    if (key === 'pos') {
      const p = this.c.pos.get(id);
      if (p) this.unindex(id, p.x, p.y);
    }
    this.c[key].delete(id);
  }

  /** Move an entity to a cell, keeping the spatial index in sync. */
  moveTo(id: EntityId, x: number, y: number, facing?: Dir8): void {
    const p = this.c.pos.get(id);
    if (!p) return;
    if (p.x !== x || p.y !== y) {
      this.unindex(id, p.x, p.y);
      p.x = x;
      p.y = y;
      this.index(id, x, y);
    }
    if (facing) p.facing = facing;
  }

  at(x: number, y: number): readonly EntityId[] {
    if (!this.inBounds(x, y)) return EMPTY;
    return this.cells[y * this.width + x] ?? EMPTY;
  }

  /** First entity on the cell that blocks movement. */
  blockerAt(x: number, y: number): EntityId | null {
    for (const id of this.at(x, y)) if (this.c.blocker.get(id)?.move) return id;
    return null;
  }

  /** Passable terrain and no blocking entity. */
  isFree(x: number, y: number): boolean {
    return this.isPassable(x, y) && this.blockerAt(x, y) === null;
  }

  pos(id: EntityId): Vec | null {
    return this.c.pos.get(id) ?? null;
  }

  emit(ev: SimEvent): void {
    this.outbox.push(ev);
  }

  /** Rebuild the spatial index from positions (after deserialization). */
  reindex(): void {
    this.cells = new Array(this.width * this.height);
    for (const [id, p] of this.c.pos) this.index(id, p.x, p.y);
  }

  private index(id: EntityId, x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    const i = y * this.width + x;
    const list = this.cells[i];
    if (list) list.push(id);
    else this.cells[i] = [id];
  }

  private unindex(id: EntityId, x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    const i = y * this.width + x;
    const list = this.cells[i];
    if (!list) return;
    const k = list.indexOf(id);
    if (k >= 0) list.splice(k, 1);
    if (list.length === 0) this.cells[i] = undefined;
  }
}

const EMPTY: readonly EntityId[] = Object.freeze([]);
