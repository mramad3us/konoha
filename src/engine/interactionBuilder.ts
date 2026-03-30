/**
 * Universal context menu builder — reads entity state and builds
 * the appropriate interaction options for any entity.
 */

import type { ContextMenuOption } from '../ui/contextMenu.ts';
import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import { isUnconscious, isDead } from './entityState.ts';
import { canSurpriseAttack } from './surpriseAttack.ts';
import { isRestrainedAndConscious } from './restraintCarry.ts';
import { SHINOBI_RANK_LABELS } from '../types/character.ts';
import type { CharacterSkills, SkillId } from '../types/character.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';

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

  // ── Special interactable (sleep, meditate, etc.) ──
  if (interactable && !unconscious && !dead) {
    if (interactable.interactionType === 'sleep') {
      options.push({ id: 'use_sleep', label: 'Sleep', accent: true });
    } else if (interactable.interactionType === 'meditate') {
      options.push({ id: 'use_meditate', label: 'Meditate', accent: true });
    } else if (interactable.interactionType === 'talk') {
      options.push({ id: 'talk', label: 'Talk' });
    } else if (interactable.interactionType === 'mission_board') {
      options.push({ id: 'use_mission_board', label: 'Pick Mission', accent: true });
    } else if (interactable.interactionType === 'village_gate') {
      // Show "Depart on Mission" if player has an active away mission (C/B/A rank)
      if (world.missionLog?.active && !world.missionLog.active.objectiveComplete) {
        const templateKey = world.missionLog.active.mission.templateKey;
        if (templateKey.startsWith('c_') || templateKey.startsWith('b_') || templateKey.startsWith('a_')) {
          options.push({ id: 'depart_mission', label: 'Depart on Mission', accent: true });
        }
      }
    }
  }

  // ── Check restraint state ──
  const restrained = world.restrained.has(entityId);
  const restrainedConscious = isRestrainedAndConscious(world, entityId);

  // ── Check if player is carrying anything (can't start new interactions) ──
  const playerIsCarrying = world.carrying.has(world.playerEntityId);

  // ── NPC: Conscious (and not restrained) ──
  if (isNpc && !unconscious && !dead && !restrained) {
    // Delivery mission target
    const npcName = world.names.get(entityId)?.display;
    const isDeliveryTarget = npcName && world.missionLog.active
      && !world.missionLog.active.objectiveComplete
      && world.missionLog.active.mission.templateKey === 'delivery'
      && world.missionLog.active.mission.templateData.targetNpc === npcName;

    if (isDeliveryTarget) {
      options.push({ id: 'talk', label: 'Deliver Package', accent: true });
    }

    // Medical ninja healing — available when player is hurt
    const isMedic = charSheet.title === 'Medical Ninja';
    if (isMedic) {
      const playerHp = world.healths.get(world.playerEntityId);
      if (playerHp && playerHp.current < playerHp.max) {
        options.push({ id: 'request_healing', label: 'Request Healing', accent: true });
      } else {
        options.push({ id: 'request_healing', label: 'Request Healing', disabled: true, disabledReason: 'You\'re not injured' });
      }
    }

    // Surprise attack — only if approaching from behind
    const canSurprise = canSurpriseAttack(world, entityId);
    if (canSurprise) {
      if (world.playerKillIntent) {
        options.push({ id: 'surprise_assassinate', label: 'Assassinate', danger: true });
      } else {
        options.push({ id: 'surprise_subdue', label: 'Subdue', accent: true });
      }
    } else {
      // Normal assassination (blocked in safe zones)
      if (world.playerKillIntent) {
        options.push({
          id: 'assassinate', label: 'Assassinate', danger: true,
          disabled: !zone.allowKill, disabledReason: !zone.allowKill ? 'Not here' : undefined,
        });
      }
    }
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

  // ── NPC: Restrained & Conscious ─��
  if (isNpc && restrainedConscious) {
    options.push({ id: 'release', label: 'Release' });
    options.push({ id: 'carry', label: 'Carry', accent: true, disabled: playerIsCarrying, disabledReason: playerIsCarrying ? 'Already carrying someone' : undefined });
    options.push({ id: 'execute', label: 'Execute', danger: true });
  }

  // ── NPC: Unconscious ──
  if (isNpc && unconscious) {
    options.push({ id: 'revive', label: 'Revive', accent: true });
    options.push({ id: 'restrain', label: 'Restrain', accent: true });
    options.push({ id: 'carry', label: 'Carry', accent: true, disabled: playerIsCarrying, disabledReason: playerIsCarrying ? 'Already carrying someone' : undefined });
    options.push({ id: 'search', label: 'Search' });
    options.push({ id: 'execute', label: 'Execute', danger: true });
  }

  // ─��� NPC: Dead ──
  if (isNpc && dead) {
    options.push({ id: 'carry', label: 'Carry', accent: true, disabled: playerIsCarrying, disabledReason: playerIsCarrying ? 'Already carrying someone' : undefined });
    options.push({ id: 'search', label: 'Search' });
  }

  // ── Player is carrying: show "Drop" option ──
  if (playerIsCarrying) {
    options.push({ id: 'drop_carried', label: 'Drop Body' });
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

  if (world.restrained.has(entityId)) {
    if (isUnconscious(world, entityId)) {
      lines.push('Unconscious and restrained. Bound hand and foot, gagged.');
    } else {
      lines.push('Restrained. Bound and gagged, conscious but helpless.');
    }
  } else if (isUnconscious(world, entityId)) {
    lines.push('Unconscious. Breathing shallowly.');
  }
  if (isDead(world, entityId)) {
    lines.push('Dead.');
  }

  // ── NPC Skill Assessment (roleplay text, no numbers) ──
  if (charSheet && charSheet.class !== 'civilian') {
    const playerSheet = world.characterSheets.get(world.playerEntityId);
    if (playerSheet) {
      const skillLines = assessNpcSkills(name, charSheet.skills, playerSheet.skills, entityId);
      lines.push(...skillLines);
    }
  }

  return lines;
}

// ── NPC SKILL ASSESSMENT ──

/**
 * Assess an NPC's skills relative to the player.
 * If player is within 5 skill points, they can gauge the exact level.
 * If the NPC is much higher (>5 difference), the player knows they're far above.
 * Many variations per skill to avoid repetition.
 */
function assessNpcSkills(
  _npcName: string,
  npcSkills: CharacterSkills,
  playerSkills: CharacterSkills,
  entityId: number,
): string[] {
  const lines: string[] = [];
  const skillKeys: SkillId[] = ['taijutsu', 'bukijutsu', 'ninjutsu', 'genjutsu', 'med'];

  for (const skill of skillKeys) {
    const npcVal = npcSkills[skill];
    const playerVal = playerSkills[skill];
    const diff = npcVal - playerVal;

    // Skip if NPC has negligible skill (<3)
    if (npcVal < 3) continue;

    // Use entity ID + skill as seed for picking from variation pool
    const seed = cellHash(entityId, skill.charCodeAt(0));

    if (diff > 5) {
      // NPC is much better — player can't fully assess but knows they're outclassed
      lines.push(pickVariation(SKILL_OUTCLASSED[skill], seed));
    } else if (diff > 0) {
      // NPC is somewhat better — player can gauge they're above
      lines.push(pickVariation(SKILL_ABOVE[skill], seed));
    } else if (diff > -5) {
      // NPC is close to player — player can assess their level
      if (npcVal >= 60) {
        lines.push(pickVariation(SKILL_CLOSE_HIGH[skill], seed));
      } else if (npcVal >= 30) {
        lines.push(pickVariation(SKILL_CLOSE_MID[skill], seed));
      } else {
        lines.push(pickVariation(SKILL_CLOSE_LOW[skill], seed));
      }
    } else {
      // Player is significantly better
      if (npcVal >= 30) {
        lines.push(pickVariation(SKILL_BELOW_DECENT[skill], seed));
      } else if (npcVal >= 10) {
        lines.push(pickVariation(SKILL_BELOW_BASIC[skill], seed));
      }
      // Very low NPC skill + player much better: skip, nothing notable
    }
  }

  return lines;
}

function pickVariation(pool: string[], seed: number): string {
  return pool[seed % pool.length];
}

// ── SKILL ASSESSMENT TEXT POOLS ──

/** NPC is much stronger than player (>5 higher) — player can't gauge how strong, just knows they're outmatched */
const SKILL_OUTCLASSED: Record<SkillId, string[]> = {
  taijutsu: [
    'Their stance alone radiates deadly precision. You can\'t even begin to gauge how far above you they are.',
    'The way they carry themselves speaks of a mastery in taijutsu you can barely comprehend.',
    'Something about their posture tells you — in a hand-to-hand fight, you wouldn\'t last a second.',
    'Their body moves with a fluid economy that suggests taijutsu mastery far beyond your understanding.',
    'You sense a coiled power in their every movement. Their taijutsu is on another level entirely.',
  ],
  bukijutsu: [
    'The way they rest their hand near their tools suggests a familiarity with weapons you can\'t fathom.',
    'You notice subtle calluses from years of bukijutsu training that dwarf your own experience.',
    'Their eyes track every weapon in the room instinctively. Their tool mastery is terrifying.',
    'The precision in their smallest gestures hints at weapon skills far beyond your comprehension.',
  ],
  ninjutsu: [
    'His mastery of chakra is unmistakable — the presence he musters with a single look is overwhelming.',
    'You can feel their chakra radiating outward. Their ninjutsu is leagues beyond yours.',
    'The air around them hums faintly with controlled chakra. You can\'t imagine that level of mastery.',
    'Something in their aura tells you their ninjutsu could crush you without them breaking a sweat.',
    'Their hand seal speed, even in casual gesture, is impossibly fast. A true ninjutsu master.',
  ],
  genjutsu: [
    'Their gaze unsettles you in ways you can\'t explain. You suspect a genjutsu mastery you can\'t fathom.',
    'Looking into their eyes makes reality feel... slippery. Their genjutsu is far beyond yours.',
    'You feel a faint pull at the edge of your mind. Their genjutsu prowess is terrifying.',
    'Something about their presence makes you question what\'s real. A genjutsu master, without doubt.',
  ],
  med: [
    'Their hands move with a surgeon\'s confidence. Their medical knowledge vastly exceeds yours.',
    'The precision of their chakra control suggests medical skills you can\'t begin to assess.',
    'You notice them casually diagnosing your condition with a glance. Their med skills are frightening.',
    'Their knowledge of the body seems absolute. A medical ninja of the highest caliber.',
  ],
};

/** NPC is somewhat above player (1-5 higher) */
const SKILL_ABOVE: Record<SkillId, string[]> = {
  taijutsu: [
    'Their taijutsu stance is noticeably sharper than yours. They\'d have the edge in close combat.',
    'You can tell from their footwork — their hand-to-hand skills are a step above your own.',
    'Their taijutsu form is tighter, more refined than yours. They have real combat experience.',
  ],
  bukijutsu: [
    'Their weapon handling is slightly more confident than yours. Experience shows.',
    'You notice their tool maintenance is meticulous — a sign of bukijutsu skill exceeding yours.',
    'The way they reach for their equipment is just a bit faster and surer than you.',
  ],
  ninjutsu: [
    'Their chakra feels more controlled than yours. Their ninjutsu has a slight edge.',
    'You sense a steadiness in their chakra flow that suggests their ninjutsu surpasses yours.',
    'Their hand seals look just a bit smoother, a bit faster. They\'re ahead in ninjutsu.',
  ],
  genjutsu: [
    'Their gaze is unnervingly steady. You suspect their genjutsu is stronger than yours.',
    'There\'s a subtle quality to their presence that suggests superior genjutsu skill.',
    'You feel slightly off-balance near them — their genjutsu is better than yours.',
  ],
  med: [
    'They handle medical supplies with a practiced ease that exceeds your own training.',
    'Their knowledge of anatomy seems deeper than yours. A more experienced healer.',
    'You notice them correcting their posture instinctively — better medical training than you.',
  ],
};

/** NPC is close to player skill, high level (60+) */
const SKILL_CLOSE_HIGH: Record<SkillId, string[]> = {
  taijutsu: [
    'A formidable fighter. Their taijutsu is on par with your own — and that says a lot.',
    'You recognize a fellow expert in hand-to-hand combat. This would be a close fight.',
    'Their taijutsu mastery mirrors your own. A worthy equal in close quarters.',
  ],
  bukijutsu: [
    'A skilled weapons user, on par with your own training. Mutual respect is warranted.',
    'Their tool mastery matches yours. This is someone who takes bukijutsu seriously.',
  ],
  ninjutsu: [
    'Their chakra control is impressive — roughly on par with your own considerable skill.',
    'You sense a kindred ninjutsu practitioner. Their mastery matches yours.',
  ],
  genjutsu: [
    'Their mind feels as sharp as yours. A genjutsu battle would be a true contest.',
    'You sense equal genjutsu prowess. Neither of you would gain an easy advantage.',
  ],
  med: [
    'A fellow healer of great skill. Their medical knowledge rivals your own.',
    'Their medical technique is refined, matching your own extensive training.',
  ],
};

/** NPC is close to player skill, mid level (30-59) */
const SKILL_CLOSE_MID: Record<SkillId, string[]> = {
  taijutsu: [
    'A competent fighter. Their taijutsu is about as developed as yours.',
    'Their close-combat skills are comparable to yours. A fair match.',
    'You read their stance — solid fundamentals, roughly your level.',
  ],
  bukijutsu: [
    'Their weapon handling is decent, about on par with yours.',
    'A reasonably skilled tool user. Nothing to sneeze at.',
  ],
  ninjutsu: [
    'Their chakra control is developing, about the same as yours.',
    'Their ninjutsu is at a similar stage to your own training.',
  ],
  genjutsu: [
    'Their mental presence feels about as strong as yours. Evenly matched.',
    'You sense a genjutsu aptitude similar to your own.',
  ],
  med: [
    'They know their way around a wound, about as well as you do.',
    'Their medical knowledge is comparable to yours.',
  ],
};

/** NPC is close to player skill, low level (<30) */
const SKILL_CLOSE_LOW: Record<SkillId, string[]> = {
  taijutsu: [
    'Their taijutsu is basic, about the same level as yours. Room to grow for both of you.',
    'Not much fighting experience. They\'re at roughly the same level as you in close combat.',
  ],
  bukijutsu: [
    'Their weapon skills are still developing, much like yours.',
    'They handle tools with the same hesitation you feel. Similar level.',
  ],
  ninjutsu: [
    'Their chakra control is still rough around the edges, like yours.',
    'You sense a fellow beginner in ninjutsu. Neither of you has mastered this yet.',
  ],
  genjutsu: [
    'Neither of you has developed much genjutsu ability. You\'re at a similar stage.',
    'Genjutsu isn\'t their strong suit either. You\'re both at a basic level.',
  ],
  med: [
    'Basic first aid knowledge. About the same as yours.',
    'They know the fundamentals of medicine, similar to your training.',
  ],
};

/** NPC is below player but still decent (30+) */
const SKILL_BELOW_DECENT: Record<SkillId, string[]> = {
  taijutsu: [
    'Decent taijutsu, but you\'d have the clear advantage in a fight.',
    'Their hand-to-hand skills are solid for their rank, but below your own.',
  ],
  bukijutsu: [
    'They handle weapons competently, though you could outperform them.',
    'Reasonable tool skills, but not at your level.',
  ],
  ninjutsu: [
    'Their ninjutsu is functional but lacks the refinement you\'ve developed.',
    'You can tell their chakra control isn\'t as tight as yours.',
  ],
  genjutsu: [
    'Their mental defenses seem adequate, but below your own genjutsu ability.',
    'You sense you could trap them in a genjutsu without much trouble.',
  ],
  med: [
    'They know some medical technique, but you\'re clearly the better healer.',
    'Their medical skills are passable, but below your training.',
  ],
};

/** NPC is below player with basic skills (10-29) */
const SKILL_BELOW_BASIC: Record<SkillId, string[]> = {
  taijutsu: [
    'Their fighting stance has basic academy form. Nothing that would challenge you.',
    'Minimal combat training. You\'d overwhelm them easily.',
  ],
  bukijutsu: [
    'They know which end of a kunai to hold. That\'s about it.',
    'Basic weapon handling at best. Well below your skill.',
  ],
  ninjutsu: [
    'Their chakra control is rudimentary. Elementary academy level.',
    'You sense barely any ninjutsu training. A novice at best.',
  ],
  genjutsu: [
    'Little to no genjutsu aptitude that you can sense.',
    'Their mental defenses are thin. No real genjutsu training.',
  ],
  med: [
    'They know how to apply a bandage, at least.',
    'Very basic medical knowledge. Hardly trained.',
  ],
};
