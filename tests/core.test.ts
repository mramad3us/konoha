import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng.ts';
import { Scheduler } from '../src/core/scheduler.ts';
import { Level } from '../src/ecs/level.ts';
import { serializeLevel, deserializeLevel } from '../src/ecs/serialize.ts';
import { P, T } from '../src/world/tiles.ts';

describe('Rng', () => {
  it('is deterministic and resumable from state', () => {
    const a = new Rng(42);
    const seq1 = [a.next(), a.next(), a.next()];
    const b = new Rng(42);
    expect([b.next(), b.next(), b.next()]).toEqual(seq1);
    const c = new Rng(a.state);
    const d = new Rng(a.state);
    expect(c.int(0, 1000)).toBe(d.int(0, 1000));
  });

  it('int stays in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe('Scheduler', () => {
  it('pops in tick order with FIFO ties', () => {
    const s = new Scheduler();
    s.schedule(1, 10);
    s.schedule(2, 5);
    s.schedule(3, 10);
    expect(s.pop()!.id).toBe(2);
    expect(s.pop()!.id).toBe(1);
    expect(s.pop()!.id).toBe(3);
    expect(s.pop()).toBeNull();
  });

  it('rescheduling replaces the old entry', () => {
    const s = new Scheduler();
    s.schedule(1, 10);
    s.schedule(1, 50);
    s.schedule(2, 20);
    expect(s.pop()!.id).toBe(2);
    expect(s.pop()).toEqual(expect.objectContaining({ id: 1, tick: 50 }));
    expect(s.pop()).toBeNull();
  });

  it('round-trips through serialization', () => {
    const s = new Scheduler();
    s.schedule(1, 30); s.schedule(2, 10); s.schedule(1, 40); s.unschedule(2); s.schedule(3, 35);
    const r = Scheduler.deserialize(JSON.parse(JSON.stringify(s.serialize())));
    expect(r.pop()!.id).toBe(3);
    expect(r.pop()!.id).toBe(1);
    expect(r.pop()).toBeNull();
  });
});

describe('Level', () => {
  it('keeps the spatial index in sync and serializes', () => {
    const lv = new Level('t', 'village', 10, 8, { name: 'Test' });
    lv.setProp(2, 2, P.tree_pine);
    lv.setTile(5, 5, T.deep);
    const a = lv.create();
    lv.add(a, 'pos', { x: 1, y: 1, facing: 's' });
    lv.add(a, 'blocker', { move: true, sight: false });
    expect(lv.at(1, 1)).toEqual([a]);
    lv.moveTo(a, 3, 4);
    expect(lv.at(1, 1)).toEqual([]);
    expect(lv.blockerAt(3, 4)).toBe(a);
    expect(lv.isPassable(2, 2)).toBe(false);
    expect(lv.isPassable(5, 5)).toBe(false);
    expect(lv.isOpaque(2, 2)).toBe(true);

    const data = JSON.parse(JSON.stringify(serializeLevel(lv)));
    const lv2 = deserializeLevel(data);
    expect(lv2.at(3, 4)).toEqual([a]);
    expect(lv2.prop(2, 2)).toBe(P.tree_pine);
    expect(lv2.tile(5, 5)).toBe(T.deep);

    lv2.destroy(a);
    expect(lv2.at(3, 4)).toEqual([]);
    expect(lv2.c.blocker.size).toBe(0);
  });
});
