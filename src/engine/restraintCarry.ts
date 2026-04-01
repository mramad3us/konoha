/**
 * Restraint & Carry System — managing restrained NPCs and body carrying.
 *
 * Restraints: Gag and tie up an unconscious NPC. When they regain consciousness,
 * they remain incapacitated (prone sprite, can't move/fight).
 *
 * Carry: Pick up a body (unconscious, dead, or restrained), move at half speed.
 * Visual indicator drawn above carrier. Drop with interact menu.
 */

import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import { COMBAT_PASS_TICKS } from '../core/constants.ts';

// ── RESTRAINT ──

const RESTRAIN_FLAVOR: string[] = [
  'You bind {target}\'s hands behind their back and secure a gag. They won\'t be going anywhere.',
  'Working quickly, you tie {target}\'s wrists and ankles. A strip of cloth serves as a gag.',
  'You lash {target}\'s arms together with practiced efficiency. Done. They\'re secured.',
  'Hands tied, mouth gagged. {target} is completely immobilized.',
  'A few tight knots and {target} is trussed up like a package. Not going anywhere.',
  'You restrain {target} methodically — wrists, ankles, gag. Clean work.',
];

const RELEASE_FLAVOR: string[] = [
  'You cut the bindings. {target} is free.',
  'The restraints fall away as you slice through them.',
  'You undo the knots and remove the gag. {target} is released.',
  'The bindings come off. {target}\'s hands and legs are freed.',
];

/**
 * Restrain an unconscious NPC.
 */
export function restrainEntity(world: World, targetId: EntityId, restrainerId: EntityId): boolean {
  // Must be unconscious and not already restrained
  if (!world.unconscious.has(targetId) && !isRestrainedAndConscious(world, targetId)) return false;
  if (world.dead.has(targetId)) return false;
  if (world.restrained.has(targetId)) return false;

  const targetName = world.names.get(targetId)?.display ?? 'them';

  world.restrained.set(targetId, {
    restrainedBy: restrainerId,
    tickRestrained: world.currentTick,
  });

  // Flavor
  const msg = RESTRAIN_FLAVOR[Math.floor(Math.random() * RESTRAIN_FLAVOR.length)]
    .replace(/\{target\}/g, targetName);
  world.log(msg, 'info');

  // Takes 2s
  world.currentTick += COMBAT_PASS_TICKS;  // 2 seconds

  return true;
}

/**
 * Release a restrained NPC.
 */
export function releaseEntity(world: World, targetId: EntityId): boolean {
  if (!world.restrained.has(targetId)) return false;

  const targetName = world.names.get(targetId)?.display ?? 'them';

  world.restrained.delete(targetId);

  // If they're conscious (restrained + not unconscious), they stand up
  if (!world.unconscious.has(targetId) && !world.dead.has(targetId)) {
    // Re-enable blocking
    const blocking = world.blockings.get(targetId);
    if (blocking) blocking.blocksMovement = true;

    // Stand up sprite
    const renderable = world.renderables.get(targetId);
    if (renderable) {
      const spriteBase = renderable.spriteId.replace(/_prone$/, '');
      renderable.spriteId = `${spriteBase}_s`;
      renderable.offsetY = -16;
    }
  }

  const msg = RELEASE_FLAVOR[Math.floor(Math.random() * RELEASE_FLAVOR.length)]
    .replace(/\{target\}/g, targetName);
  world.log(msg, 'info');

  world.currentTick += COMBAT_PASS_TICKS;  // 2 seconds

  return true;
}

/**
 * Check if an entity is restrained and has regained consciousness
 * (not in the unconscious map but still in restrained map).
 */
export function isRestrainedAndConscious(world: World, entityId: EntityId): boolean {
  return world.restrained.has(entityId) && !world.unconscious.has(entityId) && !world.dead.has(entityId);
}

/**
 * Handle a restrained NPC waking up — keep them incapacitated.
 * Called from the unconscious recovery tick.
 */
export function onRestrainedWake(world: World, entityId: EntityId): void {
  if (!world.restrained.has(entityId)) return;

  const name = world.names.get(entityId)?.display ?? 'Someone';

  // Remove unconscious but keep prone and non-blocking
  world.unconscious.delete(entityId);

  // They wake up but can't do anything
  // Keep prone sprite, keep non-blocking
  const renderable = world.renderables.get(entityId);
  if (renderable && !renderable.spriteId.endsWith('_prone')) {
    const spriteBase = renderable.spriteId.replace(/_[snew]$/, '');
    renderable.spriteId = `${spriteBase}_prone`;
    renderable.offsetY = -8;
  }
  const blocking = world.blockings.get(entityId);
  if (blocking) blocking.blocksMovement = false;

  // Flavor — muffled sounds
  const WAKE_RESTRAINED = [
    `${name} stirs beneath the bindings. Muffled sounds come from behind the gag.`,
    `${name}\'s eyes snap open. They struggle against the restraints, but the knots hold.`,
    `A groan from the ground — ${name} is awake, thrashing weakly against their bonds.`,
    `${name} tries to move and finds they can't. Their eyes go wide with panic.`,
    `${name} regains consciousness and immediately tests the restraints. No give.`,
  ];
  world.log(WAKE_RESTRAINED[Math.floor(Math.random() * WAKE_RESTRAINED.length)], 'info');
}

// ── CARRY ──

const PICKUP_FLAVOR: string[] = [
  'You hoist {target} over your shoulder. The weight slows you down considerably.',
  'You lift {target}\'s limp body. This will make moving difficult.',
  'With effort, you sling {target} across your back. Heavy.',
  'You pick up {target}. Every step will cost you twice the effort now.',
  'Hefting {target}\'s weight onto your shoulder, you brace yourself. This won\'t be easy.',
];

const DROP_FLAVOR: string[] = [
  'You lower {target} to the ground.',
  'You set {target} down carefully.',
  '{target} slides off your shoulder. Done.',
  'You deposit {target} on the ground.',
];

/**
 * Start carrying an entity (unconscious, dead, or restrained).
 */
export function startCarrying(world: World, carrierId: EntityId, targetId: EntityId): boolean {
  // Can't carry if already carrying something
  if (world.carrying.has(carrierId)) return false;

  // Target must be unconscious, dead, or restrained
  const isValidTarget = world.unconscious.has(targetId) || world.dead.has(targetId) || world.restrained.has(targetId);
  if (!isValidTarget) return false;

  const targetName = world.names.get(targetId)?.display ?? 'them';

  // Set carry components
  world.carrying.set(carrierId, { carriedEntityId: targetId });
  world.carried.set(targetId, { carriedBy: carrierId });

  // Remove carried entity from the grid (they travel with the carrier)
  const targetPos = world.positions.get(targetId);
  if (targetPos) {
    world.removeFromGrid(targetId, targetPos.x, targetPos.y);
  }

  // Make carried entity not renderable (they're on carrier's back)
  const renderable = world.renderables.get(targetId);
  if (renderable) {
    renderable.layer = 'effect'; // move to effect layer so it doesn't render normally
    renderable.spriteId = '__carried_hidden__'; // non-existent sprite = invisible
  }

  // Flavor
  const msg = PICKUP_FLAVOR[Math.floor(Math.random() * PICKUP_FLAVOR.length)]
    .replace(/\{target\}/g, targetName);
  world.log(msg, 'info');

  world.currentTick += COMBAT_PASS_TICKS;  // 2 seconds

  return true;
}

/**
 * Stop carrying — drop the carried entity at the carrier's current position.
 */
export function stopCarrying(world: World, carrierId: EntityId): boolean {
  const carry = world.carrying.get(carrierId);
  if (!carry) return false;

  const targetId = carry.carriedEntityId;
  const targetName = world.names.get(targetId)?.display ?? 'them';
  const carrierPos = world.positions.get(carrierId);

  // Place carried entity at carrier's position
  if (carrierPos) {
    const targetPos = world.positions.get(targetId);
    if (targetPos) {
      targetPos.x = carrierPos.x;
      targetPos.y = carrierPos.y;
      world.registerInGrid(targetId, targetPos.x, targetPos.y);
    }
  }

  // Restore rendering
  const renderable = world.renderables.get(targetId);
  if (renderable) {
    renderable.layer = 'character';
    // Restore to prone sprite
    const anchor = world.anchors.get(targetId);
    const prefix = anchor?.spritePrefix ?? 'char_shinobi';
    renderable.spriteId = `${prefix}_prone`;
    renderable.offsetY = -8;
  }

  // Remove carry components
  world.carrying.delete(carrierId);
  world.carried.delete(targetId);

  // Flavor
  const msg = DROP_FLAVOR[Math.floor(Math.random() * DROP_FLAVOR.length)]
    .replace(/\{target\}/g, targetName);
  world.log(msg, 'info');

  return true;
}

/**
 * Update carried entity's position to match carrier's position.
 * Call after every carrier movement.
 */
export function updateCarriedPosition(world: World, carrierId: EntityId): void {
  const carry = world.carrying.get(carrierId);
  if (!carry) return;

  const carrierPos = world.positions.get(carrierId);
  const targetPos = world.positions.get(carry.carriedEntityId);
  if (carrierPos && targetPos) {
    targetPos.x = carrierPos.x;
    targetPos.y = carrierPos.y;
  }
}
