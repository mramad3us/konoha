/**
 * Domain events: things that happened in the world that other sim subsystems (missions,
 * records) react to. Handlers are stateless functions registered once at startup.
 */

import type { Level } from '../ecs/level.ts';
import type { EntityId } from '../ecs/components.ts';
import type { Game } from './game.ts';

export type DomainEvent =
  | { type: 'ko'; id: EntityId; by: EntityId | null }
  | { type: 'death'; id: EntityId; by: EntityId | null }
  | { type: 'restrained'; id: EntityId; by: EntityId }
  | { type: 'searched'; id: EntityId; by: EntityId }
  | { type: 'collected'; id: EntityId }
  | { type: 'talked'; id: EntityId }
  | { type: 'stepped'; id: EntityId; x: number; y: number };

type Handler = (g: Game, lv: Level, e: DomainEvent) => void;
const handlers: Handler[] = [];

export function onDomain(h: Handler): void {
  if (!handlers.includes(h)) handlers.push(h);
}

export function fire(g: Game, lv: Level, e: DomainEvent): void {
  for (const h of handlers) h(g, lv, e);
}
