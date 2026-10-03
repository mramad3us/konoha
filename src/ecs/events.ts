/**
 * Events the simulation emits for presentation (render, audio, UI). The sim never reads them.
 */

import type { Vec, Dir8 } from '../core/geometry.ts';
import type { EntityId, Move, ItemKind, AwareState, Skill, Attr } from './components.ts';

export type ExchangeOutcome =
  | 'win'        // a beat b
  | 'lose'       // b beat a
  | 'trade'      // both landed (strike/strike)
  | 'clinch'     // break/break
  | 'circle';    // guard/guard

export type SimEvent =
  | { t: 'move'; id: EntityId; from: Vec; to: Vec; ticks: number }
  | { t: 'teleport'; id: EntityId; from: Vec; to: Vec }
  | { t: 'face'; id: EntityId; dir: Dir8 }
  | { t: 'exchange'; a: EntityId; b: EntityId; moveA: Move; moveB: Move; outcome: ExchangeOutcome }
  | { t: 'open_hit'; attacker: EntityId; target: EntityId; move: Move }
  | { t: 'damage'; id: EntityId; amount: number; crit: boolean; source: EntityId | null; kind: 'melee' | 'thrown' | 'bleed' | 'takedown' }
  | { t: 'parry'; id: EntityId }
  | { t: 'stagger'; id: EntityId }
  | { t: 'ko'; id: EntityId }
  | { t: 'death'; id: EntityId }
  | { t: 'revive'; id: EntityId }
  | { t: 'throw'; source: EntityId; from: Vec; to: Vec; weapon: ItemKind; hit: boolean; target: EntityId | null }
  | { t: 'noise'; at: Vec; radius: number }
  | { t: 'aware'; id: EntityId; state: AwareState }
  | { t: 'sign'; id: EntityId; sign: number }
  | { t: 'cast'; id: EntityId; technique: string }
  | { t: 'smoke'; at: Vec }
  | { t: 'float'; at: Vec; text: string; color: string }
  | { t: 'bark'; id: EntityId; text: string }
  | { t: 'door'; id: EntityId; open: boolean }
  | { t: 'pickup'; id: EntityId; item: ItemKind; count: number }
  | { t: 'progress'; stat: Skill | Attr; from: number; to: number }
  | { t: 'takedown'; id: EntityId; target: EntityId; lethal: boolean }
  | { t: 'sfx'; name: string };
