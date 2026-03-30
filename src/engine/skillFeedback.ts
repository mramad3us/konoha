/**
 * Skill & stat level-up flavor text and detection.
 * Logs golden messages when a skill or stat crosses an integer boundary.
 */

import type { World } from './world.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';

// ── SKILL FLAVOR POOLS ──

const TAIJUTSU_UP: string[] = [
  'Something clicks — your fists feel faster, your footwork sharper.',
  'The rhythm of combat is starting to feel natural. Your body remembers.',
  'You catch yourself reacting before thinking. Muscle memory takes hold.',
  'A stance that once felt awkward now flows like water. You\'re improving.',
  'Your punches land where you aim them. Taijutsu is becoming instinct.',
  'The distance between you and your opponent — you read it without thinking now.',
  'Your body has learned something your mind hasn\'t caught up to yet.',
  'Blocking, striking, weaving — the motions are becoming one fluid sequence.',
  'You feel the subtle shift. Movements that took effort now come effortlessly.',
  'Your joints know the angles. Your muscles know the timing. You\'ve grown.',
  'The dummy\'s rhythm is predictable now. Soon, so will real opponents be.',
  'You feel a quiet confidence settle into your limbs. Stronger. Faster.',
];

const BUKIJUTSU_UP: string[] = [
  'The kunai sits differently in your hand now — more natural, more precise.',
  'Your throws are tighter. The blade goes where your eyes tell it to.',
  'Tool handling that once required thought now happens on reflex.',
  'You feel the weight of each weapon like an extension of yourself.',
  'The arc of a thrown shuriken — you can predict it before release.',
  'Your fingers find the grip instinctively. Bukijutsu is taking root.',
  'Drawing steel feels less like a motion and more like a thought.',
  'Something about the way you hold a blade has changed. It feels right.',
];

const NINJUTSU_UP: string[] = [
  'Chakra flows through your meridians a little more smoothly than before.',
  'You feel your chakra reserves deepen — like a stream widening into a river.',
  'The hand seals feel less awkward. Your fingers know the shapes.',
  'Something shifts within. Your connection to chakra strengthens.',
  'The flow of energy through your body — you can almost see it now.',
  'Control that once required fierce concentration now comes with a breath.',
  'Your chakra responds faster, burns steadier. You\'re making progress.',
  'The boundary between body and chakra blurs. They move as one.',
  'A hand seal you\'ve practiced a hundred times finally feels effortless.',
  'You sense your chakra network expanding, pathways widening.',
  'The invisible current of energy within you hums a little louder.',
  'Where chakra once trickled, it now flows. Your training is paying off.',
];

const GENJUTSU_UP: string[] = [
  'The world seems sharper. You notice details you\'d have missed before.',
  'Your mind feels keener — illusion and reality a little easier to distinguish.',
  'Something in your perception has shifted. The veil between real and false thins.',
  'Your mental focus crystallizes. Genjutsu\'s subtleties reveal themselves.',
  'You feel your awareness expand. The mind is a weapon, and yours just got sharper.',
  'The flicker at the edge of your vision — you know now it\'s always been there.',
  'Your thoughts feel clearer, more ordered. Mental discipline deepening.',
  'You can feel the threads of perception more distinctly now.',
];

const MED_UP: string[] = [
  'Anatomy that was abstract knowledge becomes intuitive understanding.',
  'Your hands remember the pressure points, the tender spots, the danger zones.',
  'Medical knowledge settles into place — you recognize wounds at a glance now.',
  'The subtle differences between injury types — you\'re starting to read them.',
  'Healing chakra flows more precisely under your direction. Less waste, more effect.',
  'You notice things about the human body you never did before.',
  'The smell of blood and herbs doesn\'t bother you anymore. It\'s just information.',
  'Treatment protocols that once needed thought now come automatically.',
];

// ── STAT FLAVOR POOLS ──

const PHY_UP: string[] = [
  'Your body feels denser, tougher. The training is hardening you.',
  'You notice it in small ways — heavier loads feel lighter, longer runs feel shorter.',
  'Something in your core has solidified. You\'re physically stronger.',
  'Your muscles respond with a snap they didn\'t have before.',
  'Endurance you didn\'t know you had reveals itself. Your body adapts.',
  'You catch your breath faster. Recover quicker. The body remembers.',
  'There\'s a sturdiness to your frame now. The weakness of youth fading.',
  'Your limbs feel powerful in a way they didn\'t yesterday.',
];

const CHA_UP: string[] = [
  'Something opens within — your chakra reserves feel deeper, vaster.',
  'The wellspring of energy inside you grows. More chakra to draw from.',
  'You feel it like a warm current — your chakra pool has expanded.',
  'Pathways that were narrow now widen. More power flows through you.',
  'Your meditation has paid off. The chakra within you runs deeper.',
  'A subtle warmth spreads through your core. Your reserves have grown.',
  'The boundary of your chakra stretches. You can sustain more, do more.',
  'Like a dam releasing, you feel new reserves of chakra available to you.',
];

const MEN_UP: string[] = [
  'Your mind feels more resilient. Doubt recedes a little further.',
  'Mental clarity sharpens. Distractions that once derailed you lose their grip.',
  'Your will hardens. You can push through what once would have stopped you.',
  'Focus comes easier. The noise of the world fades when you need it to.',
  'Something in your spirit has strengthened. An inner resolve solidifies.',
  'Fear is still there, but it\'s smaller now. Your mind commands it.',
  'Willpower isn\'t just a word anymore — you feel it like a physical thing.',
  'The meditation is changing you. Your thoughts obey you more readily.',
];

const SOC_UP: string[] = [
  'You notice the subtle cues — a shift in posture, a hesitation in speech.',
  'People seem more readable. Their intentions clearer in their expressions.',
  'Your words land differently now. People listen a little more carefully.',
  'Social currents that once confused you are starting to make sense.',
  'You feel more comfortable in conversation. Less guarded, more natural.',
  'The village is full of stories — and you\'re getting better at reading them.',
  'Influence isn\'t about power. It\'s about understanding. And you understand more.',
  'You catch yourself persuading where you once would have stumbled.',
];

// ── LOOKUP MAPS ──

const SKILL_POOLS: Record<string, string[]> = {
  taijutsu: TAIJUTSU_UP,
  bukijutsu: BUKIJUTSU_UP,
  ninjutsu: NINJUTSU_UP,
  genjutsu: GENJUTSU_UP,
  med: MED_UP,
};

const STAT_POOLS: Record<string, string[]> = {
  phy: PHY_UP,
  cha: CHA_UP,
  men: MEN_UP,
  soc: SOC_UP,
};

const SKILL_LABELS: Record<string, string> = {
  taijutsu: 'Taijutsu',
  bukijutsu: 'Bukijutsu',
  ninjutsu: 'Ninjutsu',
  genjutsu: 'Genjutsu',
  med: 'Medicine',
  phy: 'Physical',
  cha: 'Chakra',
  men: 'Mental',
  soc: 'Social',
};

/**
 * Check if a skill/stat crossed an integer boundary and log flavor text.
 * Call AFTER updating the value via computeImprovement.
 */
export function checkSkillUp(
  world: World,
  fieldName: string,
  oldValue: number,
  newValue: number,
): void {
  const oldLevel = Math.floor(oldValue);
  const newLevel = Math.floor(newValue);
  if (newLevel <= oldLevel) return;

  const pool = SKILL_POOLS[fieldName] ?? STAT_POOLS[fieldName];
  if (!pool || pool.length === 0) return;

  // Deterministic-ish pick based on tick + level to avoid repeats
  const seed = cellHash(world.currentTick, newLevel + fieldName.charCodeAt(0));
  const flavor = pool[seed % pool.length];

  const label = SKILL_LABELS[fieldName] ?? fieldName;
  world.log(flavor, 'skill_up');
  world.log(`${label} is now ${newLevel}.`, 'skill_up');
}
