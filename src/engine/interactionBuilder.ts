/**
 * Universal context menu builder — reads entity state and builds
 * the appropriate interaction options for any entity.
 */

import type { ContextMenuOption } from '../ui/contextMenu.ts';
import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import { isUnconscious, isDead } from './entityState.ts';
import { SHINOBI_RANK_LABELS } from '../types/character.ts';

export interface ZoneFlags {
  allowKill: boolean;
  allowAbduct: boolean;
}

export const TRAINING_GROUNDS_FLAGS: ZoneFlags = {
  allowKill: false,
  allowAbduct: false,
};

/**
 * Build context menu options for any entity based on its components and state.
 */
export function buildContextOptions(
  world: World,
  entityId: EntityId,
  zone: ZoneFlags,
): ContextMenuOption[] {
  const options: ContextMenuOption[] = [];
  const sheet = world.objectSheets.get(entityId);
  const charSheet = world.characterSheets.get(entityId);
  const interactable = world.interactables.get(entityId);
  const unconscious = isUnconscious(world, entityId);
  const dead = isDead(world, entityId);
  const isNpc = !!charSheet;

  // ── Examine (always available for anything with a sheet) ──
  if (sheet || charSheet) {
    // Check if this is a mission search target — show "Collect" instead
    const isSearchTarget = world.missionLog.active
      && !world.missionLog.active.objectiveComplete
      && world.missionLog.active.mission.templateKey === 'search'
      && world.missionLog.active.progress.searchEntityId === entityId;

    if (isSearchTarget) {
      options.push({ id: 'examine', label: 'Collect', accent: true });
    } else {
      options.push({ id: 'examine', label: 'Examine' });
    }
  }

  // ── Special interactable (sleep, etc.) ──
  if (interactable && !unconscious && !dead) {
    if (interactable.interactionType === 'sleep') {
      options.push({ id: 'use_sleep', label: 'Sleep', accent: true });
    } else if (interactable.interactionType === 'talk') {
      options.push({ id: 'talk', label: 'Talk' });
    } else if (interactable.interactionType === 'mission_board') {
      options.push({ id: 'use_mission_board', label: 'Pick Mission', accent: true });
    }
  }

  // ── NPC: Conscious ──
  if (isNpc && !unconscious && !dead) {
    // Talk is enabled for delivery mission targets, otherwise disabled
    const npcName = world.names.get(entityId)?.display;
    const isDeliveryTarget = npcName && world.missionLog.active
      && !world.missionLog.active.objectiveComplete
      && world.missionLog.active.mission.templateKey === 'delivery'
      && world.missionLog.active.mission.templateData.targetNpc === npcName;

    if (isDeliveryTarget) {
      options.push({ id: 'talk', label: 'Deliver Package', accent: true });
    } else {
      options.push({ id: 'talk', label: 'Talk', disabled: true, disabledReason: 'Not available yet' });
    }
    options.push({
      id: 'assassinate', label: 'Assassinate', danger: true,
      disabled: !zone.allowKill, disabledReason: !zone.allowKill ? 'Not here' : undefined,
    });
  }

  // ── Bleeding (any living NPC, conscious or unconscious) ──
  const isBleeding = world.bleeding.has(entityId);
  if (isNpc && !dead && isBleeding) {
    options.push({ id: 'patch_up', label: 'Patch Up', accent: true });
  }

  // ── Wounded (any living NPC with < max HP) ──
  const health = world.healths.get(entityId);
  if (isNpc && !dead && health && health.current < health.max) {
    options.push({ id: 'first_aid', label: 'First Aid', accent: true });
  }

  // ── NPC: Unconscious ──
  if (isNpc && unconscious) {
    options.push({ id: 'revive', label: 'Revive', accent: true });
    options.push({ id: 'restrain', label: 'Restrain', disabled: true, disabledReason: 'No rope' });
    options.push({ id: 'search', label: 'Search', disabled: true, disabledReason: 'Nothing to find' });
    options.push({ id: 'abduct', label: 'Abduct', disabled: true, disabledReason: !zone.allowAbduct ? 'Not here' : 'Not available yet' });
    options.push({
      id: 'kill', label: 'Kill', danger: true,
      disabled: !zone.allowKill, disabledReason: !zone.allowKill ? 'Not here' : undefined,
    });
  }

  // ── NPC: Dead ──
  if (isNpc && dead) {
    options.push({ id: 'search', label: 'Search', disabled: true, disabledReason: 'Nothing to find' });
  }

  return options;
}

/**
 * Generate examine text for an entity.
 */
export function getExamineText(world: World, entityId: EntityId): string[] {
  const lines: string[] = [];
  const sheet = world.objectSheets.get(entityId);
  const charSheet = world.characterSheets.get(entityId);
  const name = world.names.get(entityId)?.display ?? 'Unknown';

  if (sheet) {
    lines.push(sheet.description);
    if (sheet.examineDetails) {
      lines.push(...sheet.examineDetails);
    }
  }

  if (charSheet) {
    const rankLabel = SHINOBI_RANK_LABELS[charSheet.rank] ?? charSheet.rank;
    lines.push(`${name}: ${rankLabel}, ${charSheet.title}.`);
  }

  const hp = world.healths.get(entityId);
  if (hp) {
    const pct = hp.current / hp.max;
    if (pct >= 0.8) lines.push('They look healthy and strong.');
    else if (pct >= 0.5) lines.push('Some bruises and scrapes are visible.');
    else if (pct >= 0.2) lines.push('They\'re visibly hurt, moving stiffly.');
    else if (pct > 0) lines.push('They look barely able to stand.');
  }

  const bleeding = world.bleeding.get(entityId);
  if (bleeding) {
    if (bleeding.intensity >= 6) lines.push('Bleeding profusely — blood pools beneath them.');
    else if (bleeding.intensity >= 3) lines.push('Bleeding steadily from open wounds.');
    else lines.push('Bleeding lightly from minor cuts.');
  }

  const blood = world.resources.get(entityId);
  if (blood && blood.blood < blood.maxBlood) {
    const pct = blood.blood / blood.maxBlood;
    if (pct <= 0.2) lines.push('Their skin is white as a ghost. They\'re barely alive.');
    else if (pct <= 0.4) lines.push('Dangerously pale. They\'ve lost too much blood.');
    else if (pct <= 0.7) lines.push('Getting pale. The blood loss is taking its toll.');
  }

  if (isUnconscious(world, entityId)) {
    lines.push('Unconscious. Breathing shallowly.');
  }
  if (isDead(world, entityId)) {
    lines.push('Dead.');
  }

  return lines;
}
