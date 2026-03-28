import type { World } from '../world.ts';

/**
 * AI system dispatcher.
 * For v0.1.0, all entities are 'static' so this is a no-op.
 * The structure is in place for future patrol/chase behaviors.
 */
export function runAI(_world: World): void {
  // v0.1.0: Training dummies are static. Nothing to do.
  // Future: iterate world.aiControlled entries and dispatch by behavior type.
}
