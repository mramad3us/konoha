import type { EntityId } from '../types/ecs.ts';
import type { World } from './world.ts';
import { MELEE_STAMINA_COST } from '../core/constants.ts';

/**
 * Resolve a melee combat action (bump-to-attack).
 * Returns true if an attack was made, false otherwise.
 */
export function resolveMelee(world: World, attacker: EntityId, defender: EntityId): boolean {
  const attackerStats = world.combatStats.get(attacker);
  const defenderStats = world.combatStats.get(defender);
  const defenderHealth = world.healths.get(defender);

  if (!attackerStats || !defenderHealth) return false;

  const attackerName = world.names.get(attacker);
  const defenderName = world.names.get(defender);

  const aName = attackerName?.display ?? 'Something';
  const dArticle = defenderName?.article ? `${defenderName.article} ` : '';
  const dName = defenderName?.display ?? 'something';

  // Deduct stamina from attacker
  const attackerResources = world.resources.get(attacker);
  if (attackerResources) {
    attackerResources.stamina = Math.max(0, attackerResources.stamina - MELEE_STAMINA_COST);
  }

  // Accuracy roll
  const evasion = defenderStats?.evasion ?? 0;
  const hitChance = Math.max(5, attackerStats.accuracy - evasion);
  const roll = Math.random() * 100;

  if (roll >= hitChance) {
    // Miss
    const missMessages = [
      `${aName} swings at ${dArticle}${dName}, but misses!`,
      `${aName}'s ${attackerStats.attackVerb} goes wide!`,
      `${dArticle}${dName} narrowly avoids ${aName}'s attack.`,
    ];
    world.log(missMessages[Math.floor(Math.random() * missMessages.length)], 'combat');
    return true;
  }

  // Hit — apply damage
  const damage = attackerStats.damage;
  defenderHealth.current = Math.max(0, defenderHealth.current - damage);

  const hitMessages = [
    `${aName} ${attackerStats.attackVerb}s ${dArticle}${dName} with a fierce blow! (${damage} damage)`,
    `A solid hit! ${aName} deals ${damage} damage to ${dArticle}${dName}.`,
    `${aName} lands a clean ${attackerStats.attackVerb} on ${dArticle}${dName}. (${damage} damage)`,
  ];
  world.log(hitMessages[Math.floor(Math.random() * hitMessages.length)], 'damage');

  // Check for destruction
  if (defenderHealth.current <= 0) {
    const destructible = world.destructibles.get(defender);
    if (destructible) {
      world.log(destructible.onDestroyMessage, 'combat');
      world.destroyEntity(defender);
    } else {
      world.log(`${dArticle}${dName} has been defeated!`, 'combat');
      world.destroyEntity(defender);
    }
  }

  return true;
}
