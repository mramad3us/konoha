/**
 * Jutsu registry — all learnable techniques.
 * Add new jutsu here. The resolver handles execution by effect type.
 */

import type { JutsuDefinition } from '../types/jutsu.ts';

export const JUTSU_REGISTRY: Record<string, JutsuDefinition> = {

  substitution: {
    id: 'substitution',
    name: 'Kawarimi no Jutsu',
    description: 'Replace yourself with a log, teleporting behind the opponent.',
    chakraCost: 15,
    minNinjutsuSkill: 5,
    combatKey: '@',
    cooldownPasses: 5,
    category: 'ninjutsu',
    effect: { type: 'substitution' },
    castMessages: [
      '{caster} vanishes in a puff of smoke — a log clatters where they stood!',
      'A blur of hand signs — {caster} dissolves into smoke, leaving a wooden decoy behind!',
      'Kawarimi! {caster} swaps with a log and reappears behind {target}!',
      '{caster}\'s form shimmers and bursts into smoke. When it clears, only a log remains.',
      'In a flash of hand seals, {caster} is replaced by a wooden substitute!',
      'Smoke erupts — {caster} is gone. A splintered log takes the hit.',
      '{caster} weaves the signs: Tiger! {caster} vanishes, replaced by a log!',
      'A crack of displaced air — {caster} body-flickers away, leaving bark and splinters.',
      'The substitution is instant — one moment {caster} is there, the next, only a log.',
      '{caster} executes a textbook Kawarimi. Smoke billows, and they\'re behind {target}.',
    ],
    failMessages: {
      no_chakra: [
        'Not enough chakra for Kawarimi!',
        'You reach for the jutsu but your chakra is depleted.',
        'Your hands form the seal but nothing happens — no chakra left.',
      ],
      cooldown: [
        'Kawarimi is still on cooldown!',
        'The substitution technique needs a moment to reset.',
        'Too soon — the jutsu hasn\'t recovered yet.',
      ],
      not_learned: [
        'You don\'t know that technique.',
        'That jutsu is beyond your current training.',
      ],
      no_target: [
        'No one to substitute away from.',
        'Kawarimi requires a threat to escape from.',
      ],
    },
  },

};

/** Get a jutsu definition by combat key */
export function getJutsuByCombatKey(key: string): JutsuDefinition | null {
  for (const jutsu of Object.values(JUTSU_REGISTRY)) {
    if (jutsu.combatKey === key) return jutsu;
  }
  return null;
}
