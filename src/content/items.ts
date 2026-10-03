import type { ItemKind } from '../ecs/components.ts';
import { PRICES } from '../core/config.ts';

export interface ItemDef {
  kind: ItemKind;
  name: string;
  plural: string;
  price: number;
  description: string;
  /** Can be used from the item bar. */
  usable: boolean;
}

export const ITEMS: Record<ItemKind, ItemDef> = {
  kunai: {
    kind: 'kunai', name: 'kunai', plural: 'kunai', price: PRICES.kunai, usable: false,
    description: 'A balanced throwing knife. Hits hard; recover it from where it lands.',
  },
  shuriken: {
    kind: 'shuriken', name: 'shuriken', plural: 'shuriken', price: PRICES.shuriken, usable: false,
    description: 'A throwing star. Lighter and more accurate than a kunai, less damage.',
  },
  bandage: {
    kind: 'bandage', name: 'bandage', plural: 'bandages', price: PRICES.bandage, usable: true,
    description: 'Stops bleeding and restores a little health. Faster and stronger with Medicine.',
  },
  soldier_pill: {
    kind: 'soldier_pill', name: 'soldier pill', plural: 'soldier pills', price: PRICES.soldier_pill, usable: true,
    description: 'A bitter military ration pill. Restores stamina and chakra at once.',
  },
};

export const ITEM_ORDER: readonly ItemKind[] = ['kunai', 'shuriken', 'bandage', 'soldier_pill'];

export function itemLabel(kind: ItemKind, count: number): string {
  const d = ITEMS[kind];
  return `${count} ${count === 1 ? d.name : d.plural}`;
}
