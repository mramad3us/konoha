/**
 * Proximity dialogue — NPCs say things when the player gets close.
 * Checks distance every turn, picks from situation-appropriate pools.
 * Respects cooldown to prevent spam.
 */

import type { World } from './world.ts';
import { isUnconscious, isDead } from './entityState.ts';

const PROXIMITY_RANGE = 3; // tiles

/**
 * Check all NPCs with proximity dialogue and fire lines if player is close.
 * Call once per turn (from advanceTurn).
 */
export function tickProximityDialogue(world: World): void {
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return;

  for (const [entityId, dialogue] of world.proximityDialogue) {
    if (isDead(world, entityId)) continue;

    // Cooldown check
    if (world.currentTick - dialogue.lastSpokeTick < dialogue.cooldownTicks) continue;

    const pos = world.positions.get(entityId);
    if (!pos) continue;

    const dist = Math.max(Math.abs(pos.x - playerPos.x), Math.abs(pos.y - playerPos.y));
    if (dist > PROXIMITY_RANGE) continue;

    // Pick situation
    const situation = getSituation(world, entityId);
    const pool = dialogue.lines[situation] ?? dialogue.lines['idle'];
    if (!pool || pool.length === 0) continue;

    const name = world.names.get(entityId)?.display ?? 'Someone';
    const line = pool[Math.floor(Math.random() * pool.length)];

    world.log(`${name}: "${line}"`, 'info');
    dialogue.lastSpokeTick = world.currentTick;
  }
}

/** Determine the current situation for an NPC */
function getSituation(world: World, entityId: number): string {
  if (isUnconscious(world, entityId)) return 'unconscious';

  // Check if player is bleeding
  const playerRes = world.resources.get(world.playerEntityId);
  if (playerRes && playerRes.blood < playerRes.maxBlood * 0.5) return 'player_bleeding';

  // Check player HP
  const playerHp = world.healths.get(world.playerEntityId);
  if (playerHp && playerHp.current < playerHp.max * 0.3) return 'player_hurt';

  // Check if NPC itself is hurt
  const npcHp = world.healths.get(entityId);
  if (npcHp && npcHp.current < npcHp.max * 0.5) return 'self_hurt';

  // Check time of day
  const hour = Math.floor((world.gameTimeSeconds % 86400) / 3600);
  if (hour >= 20 || hour < 5) return 'night';
  if (hour >= 5 && hour < 7) return 'dawn';

  return 'idle';
}

// ── DIALOGUE POOLS ──

export const TAKESHI_DIALOGUE: Record<string, string[]> = {
  idle: [
    'Ready for another round?',
    'Keep your guard up. Always.',
    'Not bad for a genin. But you can do better.',
    'The academy taught us the basics. The field teaches the rest.',
    'You\'re getting faster. I can feel it.',
    'Don\'t just swing — think. Every move should have purpose.',
    'I\'ve been training here since dawn. Your turn.',
    'Focus your chakra. Feel where the strike is coming from.',
    'A good shinobi fights smart, not just hard.',
    'Want to spar? I won\'t go easy.',
  ],
  player_hurt: [
    'You should rest. You\'re in no shape to fight.',
    'There\'s a sleeping bag over there. Use it.',
    'Don\'t push yourself too hard. Even shinobi need to heal.',
    'You look like you took a beating. Take a breather.',
  ],
  player_bleeding: [
    'You\'re bleeding! Patch that up before it gets worse.',
    'Blood everywhere... you need medical attention.',
    'Stop the bleeding first. Everything else can wait.',
  ],
  self_hurt: [
    'Ugh... good hit. I felt that one.',
    'You\'re improving. That actually hurt.',
    'Alright, you got me. But I\'m not done yet.',
  ],
  night: [
    'Training at night? Dedicated. I like it.',
    'The torches keep the training grounds lit, at least.',
    'Most genin are asleep by now. Not us, huh?',
  ],
  dawn: [
    'Early morning training. The best kind.',
    'Dawn is the shinobi\'s hour. Let\'s make the most of it.',
  ],
};

export const ANBU_DIALOGUE: Record<string, string[]> = {
  idle: [
    '...',
    'You shouldn\'t be able to see me.',
    'Keep training. The village needs strong shinobi.',
    'I\'m not here. You didn\'t see me.',
    'Interesting technique. Unrefined, but interesting.',
    'The Hokage has eyes everywhere.',
    'Don\'t waste my time unless you have something to show.',
    'Your form needs work. But you have potential.',
    'I\'ve killed shinobi twice your size. Don\'t test me.',
    'Training grounds. Peaceful. For now.',
    'ANBU doesn\'t do small talk.',
    'You\'re being watched. Always.',
  ],
  player_hurt: [
    'Weak. A real mission would have killed you.',
    'Get up. Pain is temporary. Death is permanent.',
    'If you can\'t handle a sparring session, stay out of the field.',
  ],
  player_bleeding: [
    'Control your bleeding or you\'ll die on a real mission.',
    'Blood draws attention. Patch it. Now.',
  ],
  self_hurt: [
    'Impressive. You actually landed one.',
    'Don\'t get cocky. That won\'t happen again.',
  ],
  night: [
    'Night is when the real work begins.',
    'Darkness is an ANBU\'s ally. Remember that.',
    'Most threats come after sunset. Stay sharp.',
  ],
  dawn: [
    'Shift change. I should be leaving.',
    'Dawn already. Time moves differently when you\'re watching.',
  ],
};
