/**
 * Log flavor text. {a} = actor, {b} = other. The player is "you", so templates are written to
 * read naturally either way via the `you` / `npc` variants.
 */

import type { Move } from '../ecs/components.ts';
import type { Rng } from '../core/rng.ts';

type Pool = readonly string[];

export const MOVE_LABEL: Record<Move, string> = { strike: 'Strike', break: 'Break', guard: 'Guard' };
export const MOVE_KANJI: Record<Move, string> = { strike: '打', break: '崩', guard: '受' };

/** Player won an exchange, by winning move. */
export const YOU_WIN: Record<Move, Pool> = {
  strike: [
    'You slip inside {b}\'s grab and drive a fist into the ribs.',
    'Your strike lands before {b} can close — clean, sharp, painful.',
    '{b} commits to the grapple; your knuckles meet their jaw first.',
    'You snap a short punch through {b}\'s reaching arms.',
  ],
  break: [
    'You smash through {b}\'s guard and send them reeling.',
    'You hook {b}\'s arm, twist, and wrench them off balance.',
    '{b} turtles up; you bulldoze straight through the block.',
    'A shoulder check folds {b}\'s guard. They stagger.',
  ],
  guard: [
    'You catch {b}\'s strike on your forearm and answer with an elbow.',
    'You parry {b}\'s blow and snap a counter into their side.',
    '{b} swings; you redirect it and punish the opening.',
    'Your guard turns {b}\'s fist aside. You make them pay for it.',
  ],
};

/** Player lost an exchange, by the enemy's winning move. */
export const YOU_LOSE: Record<Move, Pool> = {
  strike: [
    'You reach to grapple — {b} is faster and cracks you across the face.',
    '{b}\'s jab cuts through your grab and rocks your head back.',
    'Too slow. {b} punishes your wind-up with a hard strike.',
  ],
  break: [
    '{b} crashes through your guard. Your arms buckle and you stagger.',
    'You brace — {b} grabs your collar and throws you off balance.',
    '{b} rams your guard aside. You\'re wide open.',
  ],
  guard: [
    '{b} reads your strike, parries it and clips you on the way back.',
    'Your blow meets {b}\'s forearm. The counter stings.',
    '{b} deflects your punch with insulting ease and hits back.',
  ],
};

export const TRADE: Pool = [
  'You and {b} trade blows at the same instant.',
  'Fists cross — you both connect.',
  'A simultaneous exchange. Both of you feel it.',
];

export const CLINCH: Pool = [
  'You lock up with {b}, straining for leverage. Neither gives.',
  'You grapple with {b}; a wrestling stalemate saps you both.',
];

export const CIRCLE: Pool = [
  'You and {b} circle, guards high, catching your breath.',
  'Both of you hold back, waiting for an opening.',
];

export const OPEN_HIT: Pool = [
  '{b} catches you off guard.',
  '{b} punishes the opening.',
  'You leave yourself open — {b} doesn\'t waste it.',
];

export function line(rng: Rng, pool: Pool, b: string): string {
  return rng.pick(pool).replace(/\{b\}/g, b);
}

export const BARKS = {
  alert: ['Intruder!', 'Over there!', 'Who goes there?!', 'Hey! You!', 'Get them!'],
  suspicious: ['Hm?', 'What was that?', 'Someone there?', '...?'],
  lost: ['Where\'d they go?', 'Tch. Lost them.', 'Must be the wind.'],
  body: ['Someone\'s down!', 'What happened here?!', 'Wake up, idiot!'],
  hurt: ['Gah!', 'Tch!', 'Ngh!', 'Kuh!'],
  flee: ['I\'m out!', 'Not worth it!', 'Run!'],
  kawarimi: ['Kawarimi!'],
} as const;
