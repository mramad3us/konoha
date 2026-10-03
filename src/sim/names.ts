import type { Level } from '../ecs/level.ts';
import type { EntityId } from '../ecs/components.ts';

/** Name as used in log sentences. The player is "you". */
export function displayName(lv: Level, id: EntityId): string {
  if (id === lv.playerId) return 'you';
  const n = lv.c.name.get(id);
  if (!n) return 'something';
  return n.name;
}

export function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "Goro the Bandit" style label for panels. */
export function fullName(lv: Level, id: EntityId): string {
  const n = lv.c.name.get(id);
  if (!n) return '';
  return n.title ? `${n.name}, ${n.title}` : n.name;
}
