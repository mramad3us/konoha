import type { Level } from '../ecs/level.ts';
import type { EntityId, Faction } from '../ecs/components.ts';

const HOSTILE: Record<Faction, readonly Faction[]> = {
  leaf: ['bandit', 'rogue'],
  civilian: ['bandit', 'rogue'],
  bandit: ['leaf', 'civilian'],
  rogue: ['leaf', 'civilian'],
  neutral: [],
};

/** Would a fight between a and b be hostile (attack on sight)? Duels make two allies hostile. */
export function isHostile(lv: Level, a: EntityId, b: EntityId): boolean {
  if (a === b) return false;
  const da = lv.c.duel.get(a);
  if (da && da.opponent === b) return true;
  const db = lv.c.duel.get(b);
  if (db && db.opponent === a) return true;
  const fa = lv.c.faction.get(a)?.id;
  const fb = lv.c.faction.get(b)?.id;
  if (!fa || !fb) return false;
  return HOSTILE[fa].includes(fb);
}

/** Can a attack b at all (hostile, or b is a training dummy)? Villagers and allies are off-limits. */
export function canAttack(lv: Level, a: EntityId, b: EntityId): boolean {
  if (a === b) return false;
  if (lv.c.dummy.has(b)) return true;
  return isHostile(lv, a, b);
}

export function isAlly(lv: Level, a: EntityId, b: EntityId): boolean {
  if (a === b) return true;
  if (isHostile(lv, a, b)) return false;
  const fa = lv.c.faction.get(a)?.id;
  const fb = lv.c.faction.get(b)?.id;
  return !!fa && fa === fb;
}
