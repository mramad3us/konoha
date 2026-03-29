/**
 * Centralized entity state management.
 * Single authority for all state transitions: alive → unconscious → dead.
 * Every system calls this instead of managing state inline.
 */

import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';

// ── STATE QUERIES ──

export function isUnconscious(world: World, entityId: EntityId): boolean {
  return world.unconscious.has(entityId);
}

export function isDead(world: World, entityId: EntityId): boolean {
  return world.dead.has(entityId);
}

export function isAlive(world: World, entityId: EntityId): boolean {
  return !isUnconscious(world, entityId) && !isDead(world, entityId);
}

// ── STATE CHANGE RESULT ──

export type StateChange =
  | { type: 'unconscious'; reason: 'hp' | 'willpower' | 'ability'; entityId: EntityId }
  | { type: 'dead'; entityId: EntityId }
  | null;

// ── PLAYER RESPAWN CALLBACK ──

let playerRespawnCallback: (() => void) | null = null;

export function setPlayerRespawnCallback(cb: () => void): void {
  playerRespawnCallback = cb;
}

// ── CHECK & AUTO-APPLY STATE ──

/**
 * Check an entity's resources and apply the correct state.
 * Call this after ANY resource change (damage, drain, poison, etc.).
 * Returns what changed, or null if no transition.
 */
export function checkEntityState(world: World, entityId: EntityId): StateChange {
  // Already dead — nothing to do
  if (isDead(world, entityId)) return null;

  // Already unconscious — nothing to do (must be killed or revived explicitly)
  if (isUnconscious(world, entityId)) return null;

  // Check HP
  const health = world.healths.get(entityId);
  if (health && health.current <= 0) {
    knockUnconscious(world, entityId, 'hp');

    // If this is the player, trigger respawn
    if (entityId === world.playerEntityId && playerRespawnCallback) {
      playerRespawnCallback();
    }

    return { type: 'unconscious', reason: 'hp', entityId };
  }

  // Check willpower
  const resources = world.resources.get(entityId);
  if (resources && resources.willpower <= 0) {
    knockUnconscious(world, entityId, 'willpower');

    if (entityId === world.playerEntityId && playerRespawnCallback) {
      playerRespawnCallback();
    }

    return { type: 'unconscious', reason: 'willpower', entityId };
  }

  return null;
}

// ── KNOCK UNCONSCIOUS ──

/**
 * Force an entity into unconscious state.
 * Works for any reason: HP depletion, willpower drain, abilities, missions.
 */
export function knockUnconscious(
  world: World,
  entityId: EntityId,
  reason: 'hp' | 'willpower' | 'ability',
): void {
  if (isUnconscious(world, entityId) || isDead(world, entityId)) return;

  const name = world.names.get(entityId)?.display ?? 'Someone';

  // Set unconscious component with random recovery time (10-600 ticks = ~1min to ~1hr)
  const recoveryDelay = 10 + Math.floor(Math.random() * 590);
  world.unconscious.set(entityId, { reason, tickFallen: world.currentTick, recoveryTick: world.currentTick + recoveryDelay });

  // Switch sprite to prone
  const renderable = world.renderables.get(entityId);
  if (renderable) {
    const spriteBase = renderable.spriteId.replace(/_[snew]$/, '');
    renderable.spriteId = `${spriteBase}_prone`;
    renderable.offsetY = -8;
  }

  // Disable blocking (can walk over unconscious bodies)
  const blocking = world.blockings.get(entityId);
  if (blocking) blocking.blocksMovement = false;

  // Make interactable
  world.interactables.set(entityId, { interactionType: 'examine', label: 'Examine' });

  // Remove from combat stats (can't fight while unconscious)
  // Keep the component — just can't be targeted for combat

  // Flavor text
  const pool = reason === 'willpower' ? UNCONSCIOUS_WILLPOWER_TEXT : UNCONSCIOUS_HP_TEXT;
  const msg = pool[Math.floor(Math.random() * pool.length)].replace(/\{name\}/g, name);
  world.log(msg, 'system');
}

// ── KILL ──

/**
 * Kill an entity. Only works on unconscious entities (or can be forced).
 * Entity persists as a dead body — can be searched, carried, etc.
 */
export function killEntity(
  world: World,
  entityId: EntityId,
  killerId: EntityId | null = null,
  force: boolean = false,
): boolean {
  if (isDead(world, entityId)) return false;
  if (!force && !isUnconscious(world, entityId)) return false;

  const name = world.names.get(entityId)?.display ?? 'Someone';

  // Set dead component
  world.dead.set(entityId, { tickDied: world.currentTick, killer: killerId });

  // Remove unconscious (they're dead now, not unconscious)
  world.unconscious.delete(entityId);

  // Remove combat capability
  world.combatStats.delete(entityId);
  world.aiControlled.delete(entityId);

  // Update interactable to searchable
  world.interactables.set(entityId, { interactionType: 'examine', label: 'Search' });

  // Sprite stays prone (dead bodies look like unconscious ones for now)
  // Future: add _dead sprite variant

  // Flavor text
  const msg = KILL_TEXT[Math.floor(Math.random() * KILL_TEXT.length)].replace(/\{name\}/g, name);
  world.log(msg, 'system');

  return true;
}

// ── REVIVE ──

/**
 * Revive an unconscious entity. Restores HP to a percentage of max.
 */
export function reviveEntity(
  world: World,
  entityId: EntityId,
  hpPercent: number = 0.5,
): boolean {
  if (!isUnconscious(world, entityId) || isDead(world, entityId)) return false;

  const name = world.names.get(entityId)?.display ?? 'Someone';

  // Remove unconscious
  world.unconscious.delete(entityId);

  // Restore HP
  const health = world.healths.get(entityId);
  if (health) {
    health.current = Math.max(1, Math.floor(health.max * hpPercent));
  }

  // Restore willpower if that was the reason
  const resources = world.resources.get(entityId);
  if (resources && resources.willpower <= 0) {
    resources.willpower = Math.max(1, Math.floor(resources.maxWillpower * 0.3));
  }

  // Restore sprite to standing
  const renderable = world.renderables.get(entityId);
  if (renderable) {
    const spriteBase = renderable.spriteId.replace(/_prone$/, '');
    renderable.spriteId = `${spriteBase}_s`;
    renderable.offsetY = -16;
  }

  // Re-enable blocking
  const blocking = world.blockings.get(entityId);
  if (blocking) blocking.blocksMovement = true;

  // Remove examine interactable
  world.interactables.delete(entityId);

  // Flavor text
  const msg = REVIVE_TEXT[Math.floor(Math.random() * REVIVE_TEXT.length)].replace(/\{name\}/g, name);
  world.log(msg, 'system');

  return true;
}

// ── FLAVOR TEXT POOLS ──

const UNCONSCIOUS_HP_TEXT = [
  '{name} crumples to the ground, out cold.',
  '{name}\'s eyes roll back as they collapse.',
  'The final blow sends {name} sprawling. They don\'t get up.',
  '{name} hits the dirt, consciousness snuffed out like a candle.',
  '{name} folds at the knees and drops face-first into the earth.',
  'A heavy thud — {name} is down. Breathing, but barely.',
  '{name} staggers, sways, and falls. The fight is over for them.',
  '{name} collapses in a heap, arms splayed, completely limp.',
  'Lights out. {name} crumbles where they stand.',
  '{name} takes the blow and goes down hard. They\'re not moving.',
  '{name}\'s legs give way. They crash to the ground unconscious.',
  'The strike puts {name} out. They slump to the earth, motionless.',
];

const UNCONSCIOUS_WILLPOWER_TEXT = [
  '{name}\'s mind shatters. They slump forward, eyes vacant.',
  'The mental pressure is too much — {name} collapses, consciousness fleeing.',
  '{name}\'s will breaks. Their body follows, crumpling to the ground.',
  'A hollow look crosses {name}\'s face before they fall, mind overwhelmed.',
  '{name} goes rigid, then limp. Their willpower is spent.',
];

const KILL_TEXT = [
  'You deliver the finishing blow. {name} is no more.',
  'A swift strike ends it. {name}\'s breathing stops.',
  'It\'s done. {name} will not rise again.',
  'You end {name}\'s life with cold precision.',
  'The final blow falls. {name}\'s story ends here.',
  '{name} draws their last breath.',
  'Without hesitation, you finish what the fight started. {name} is gone.',
  'A clean end. {name} passes from this world.',
];

// ── AUTO-RECOVERY ──

/**
 * Tick unconscious recovery for all entities.
 * Call once per game tick. Entities wake up when their recovery time is reached.
 * Does NOT apply to the player (player respawns via separate flow).
 */
export function tickUnconsciousRecovery(world: World): void {
  for (const [entityId, state] of world.unconscious) {
    if (entityId === world.playerEntityId) continue; // Player respawns differently
    if (world.dead.has(entityId)) continue; // Dead don't recover
    if (world.currentTick >= state.recoveryTick) {
      const name = world.names.get(entityId)?.display ?? 'Someone';
      const msg = RECOVERY_TEXT[Math.floor(Math.random() * RECOVERY_TEXT.length)].replace(/\{name\}/g, name);
      reviveEntity(world, entityId, 0.05); // Wake at 5% HP
      world.log(msg, 'info');
    }
  }
}

const RECOVERY_TEXT = [
  '{name} stirs, groaning, and slowly pushes themselves upright.',
  '{name}\'s eyes flutter open. They look around, dazed but alive.',
  'A cough from the ground — {name} is coming to.',
  '{name} twitches, then rolls over. Consciousness returns.',
  '{name} gasps and sits up suddenly, wide-eyed and disoriented.',
  'Slowly, painfully, {name} rises from the dirt.',
  '{name} lets out a low moan and begins to move again.',
];

const REVIVE_TEXT = [
  '{name} stirs, groaning. Consciousness returns.',
  '{name}\'s eyes flutter open. They\'re alive.',
  'A cough, a gasp — {name} pushes themselves up, shaking.',
  '{name} comes to, disoriented but breathing.',
  'Life returns to {name}\'s eyes. They rise unsteadily.',
];
