import { it, expect } from 'vitest';
import { generateVillage } from '../src/world/gen/village.ts';
import { findPath } from '../src/world/path.ts';

it('the fields can be walked into and out of', () => {
  for (const seed of [1, 11, 123, 4242]) {
    const { level, spots } = generateVillage(seed);
    expect(findPath(level, { x: 22, y: 85 }, spots.plaza, { avoidActors: false, limit: 20000 })).not.toBeNull();
  }
});
