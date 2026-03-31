/**
 * Ninpo effect resolution — applies effects when a hand-sign sequence completes.
 * Also handles timed effect expiry (e.g., vanish duration).
 */

import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import type { NinpoDefinition } from '../types/ninpo.ts';
import { getVanishDuration, getShadowStepRange } from '../data/ninpo.ts';
import { spawnSmokePuff } from '../systems/particleSystem.ts';
import { spawnFloatingText } from '../systems/floatingTextSystem.ts';

/**
 * Resolve a completed ninpo — deduct chakra and apply the effect.
 * Returns true if the ninpo was successfully cast.
 */
export function resolveNinpo(world: World, casterId: EntityId, ninpo: NinpoDefinition): boolean {
  const sheet = world.characterSheets.get(casterId);
  const res = world.resources.get(casterId);
  if (!sheet || !res) return false;

  const ninjutsuLevel = sheet.skills.ninjutsu;
  const cost = ninpo.chakraCost(ninjutsuLevel);

  // Check chakra
  if (res.chakra < cost) {
    const msg = ninpo.failMessages['no_chakra'];
    const text = msg[Math.floor(Math.random() * msg.length)];
    world.log(text, 'info');
    const pos = world.positions.get(casterId);
    if (pos) spawnFloatingText(pos.x, pos.y, 'No chakra!', '#6688cc', 1.2, 12);
    return false;
  }

  // Deduct chakra
  res.chakra = Math.max(0, res.chakra - cost);

  // Log cast message
  const casterName = world.names.get(casterId)?.display ?? 'The shinobi';
  const castMsg = ninpo.castMessages[Math.floor(Math.random() * ninpo.castMessages.length)]
    .replace('{caster}', casterName);
  world.log(castMsg, 'combat_tempo');

  // Dispatch by effect type
  switch (ninpo.effectType) {
    case 'vanish':
      applyVanish(world, casterId, ninjutsuLevel);
      break;
    case 'shadow_step':
      initShadowStep(world, casterId, ninjutsuLevel);
      break;
  }

  // Signal squad to mirror this ninpo (player only)
  if (casterId === world.playerEntityId) {
    world._squadNinpoMirror = ninpo.id;
  }

  return true;
}

// ── Vanish ──

function applyVanish(world: World, casterId: EntityId, ninjutsuLevel: number): void {
  world.invisible.set(casterId, { casterNinjutsu: ninjutsuLevel });

  const duration = getVanishDuration(ninjutsuLevel);
  if (duration > 0) {
    world.ninpoTimers.set(casterId, {
      ninpoId: 'vanish',
      expiresAtGameSeconds: world.gameTimeSeconds + duration,
    });
  }
  // duration === -1 means permanent (until interaction breaks it)

  const pos = world.positions.get(casterId);
  if (pos) {
    spawnSmokePuff(pos.x, pos.y, 10);
    spawnFloatingText(pos.x, pos.y, 'Vanish!', '#aaccff', 1.5, 13);
  }
}

// ── Shadow Step ──

function initShadowStep(world: World, casterId: EntityId, ninjutsuLevel: number): void {
  const maxRange = getShadowStepRange(ninjutsuLevel);
  world._pendingShadowStep = { casterId, maxRange };
  // Input system will pick this up and enter tile-picker mode
}

/** Actually teleport the entity — called by input system after tile selection */
export function applyShadowStep(world: World, casterId: EntityId, targetX: number, targetY: number): void {
  const pos = world.positions.get(casterId);
  if (!pos) return;

  const oldX = pos.x;
  const oldY = pos.y;

  // Smoke at origin
  spawnSmokePuff(oldX, oldY, 8);

  // Move entity
  world.moveInGrid(casterId, oldX, oldY, targetX, targetY);
  pos.x = targetX;
  pos.y = targetY;

  // Smoke at destination
  spawnSmokePuff(targetX, targetY, 8);
  spawnFloatingText(targetX, targetY, 'Shadow Step!', '#ccaaff', 1.5, 13);
}

// ── Timer Tick ──

/** Expire timed ninpo effects. Called from advanceTurn slow-systems loop. */
export function tickNinpoTimers(world: World): void {
  const expired: EntityId[] = [];

  for (const [entityId, timer] of world.ninpoTimers) {
    if (timer.expiresAtGameSeconds >= 0 && world.gameTimeSeconds >= timer.expiresAtGameSeconds) {
      expired.push(entityId);
    }
  }

  for (const entityId of expired) {
    const timer = world.ninpoTimers.get(entityId)!;
    world.ninpoTimers.delete(entityId);

    if (timer.ninpoId === 'vanish') {
      world.invisible.delete(entityId);
      const name = world.names.get(entityId)?.display ?? 'The shinobi';
      const isPlayer = entityId === world.playerEntityId;
      if (isPlayer) {
        world.log('Your invisibility fades — the technique has expired.', 'info');
      } else {
        const pos = world.positions.get(entityId);
        if (pos && world.fovVisible.has(`${pos.x},${pos.y}`)) {
          world.log(`${name} shimmers back into view.`, 'info');
        }
      }
      const pos = world.positions.get(entityId);
      if (pos) spawnSmokePuff(pos.x, pos.y, 6);
    }
  }
}
