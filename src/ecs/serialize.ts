/**
 * Level ⇄ plain JSON. Typed arrays are base64-encoded; component stores are [id, value] pairs.
 * Player-linked components are skipped for the player entity (the profile owns them).
 */

import { Level, type LevelKind, type LevelMeta } from './level.ts';
import { Scheduler, type ScheduleEntry } from '../core/scheduler.ts';
import { COMPONENT_KEYS, PLAYER_LINKED, type ComponentKey, type EntityId } from './components.ts';

export interface LevelData {
  id: string;
  kind: LevelKind;
  width: number;
  height: number;
  meta: LevelMeta;
  tiles: string;
  props: string;
  structs: string;
  explored: string;
  nextId: number;
  playerId: EntityId;
  entities: EntityId[];
  stores: Partial<Record<ComponentKey, Array<[EntityId, unknown]>>>;
  scheduler: { seq: number; entries: ScheduleEntry[] };
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function serializeLevel(level: Level): LevelData {
  const stores: LevelData['stores'] = {};
  for (const key of COMPONENT_KEYS) {
    const map = level.c[key] as Map<EntityId, unknown>;
    if (map.size === 0) continue;
    const pairs: Array<[EntityId, unknown]> = [];
    for (const [id, v] of map) {
      if (id === level.playerId && PLAYER_LINKED.includes(key)) continue;
      pairs.push([id, structuredClone(v)]);
    }
    if (pairs.length) stores[key] = pairs;
  }
  return {
    id: level.id,
    kind: level.kind,
    width: level.width,
    height: level.height,
    meta: structuredClone(level.meta),
    tiles: toBase64(level.tiles),
    props: toBase64(new Uint8Array(level.props.buffer, level.props.byteOffset, level.props.byteLength)),
    structs: toBase64(level.structs),
    explored: toBase64(level.explored),
    nextId: level.nextId,
    playerId: level.playerId,
    entities: [...level.entities],
    stores,
    scheduler: level.scheduler.serialize(),
  };
}

export function deserializeLevel(data: LevelData): Level {
  const level = new Level(data.id, data.kind, data.width, data.height, data.meta);
  level.tiles = fromBase64(data.tiles);
  const propBytes = fromBase64(data.props);
  level.props = new Uint16Array(propBytes.buffer, propBytes.byteOffset, propBytes.byteLength / 2);
  level.structs = fromBase64(data.structs);
  level.explored = fromBase64(data.explored);
  level.nextId = data.nextId;
  level.playerId = data.playerId;
  for (const id of data.entities) level.entities.add(id);
  for (const key of COMPONENT_KEYS) {
    const pairs = data.stores[key];
    if (!pairs) continue;
    const map = level.c[key] as Map<EntityId, unknown>;
    for (const [id, v] of pairs) map.set(id, v);
  }
  level.scheduler = Scheduler.deserialize(data.scheduler);
  level.reindex();
  return level;
}
