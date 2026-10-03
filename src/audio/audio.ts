/**
 * Sound design: maps sim events and UI moments to synthesized sounds.
 */

import { engine as E } from './engine.ts';
import type { Level } from '../ecs/level.ts';
import type { SimEvent } from '../ecs/events.ts';
import { T } from '../world/tiles.ts';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const sfx = {
  hit(heavy = false): void {
    E.burst({ dur: heavy ? 0.18 : 0.11, vol: heavy ? 0.55 : 0.4, freq: rnd(700, 1000), q: 0.8 });
    E.tone({ freq: heavy ? 90 : 130, to: 50, dur: heavy ? 0.16 : 0.1, vol: heavy ? 0.5 : 0.35, type: 'sine' });
  },
  crit(): void {
    sfx.hit(true);
    E.burst({ dur: 0.35, vol: 0.25, freq: 2400, q: 3, at: 0.02, sweepTo: 600 });
    E.tone({ freq: 60, dur: 0.3, vol: 0.4, type: 'sine', at: 0.01 });
  },
  parry(): void {
    E.tone({ freq: rnd(1800, 2200), dur: 0.12, vol: 0.18, type: 'square', to: 1400 });
    E.burst({ dur: 0.06, vol: 0.25, freq: 3500, q: 4 });
  },
  whiff(): void {
    E.burst({ dur: 0.14, vol: 0.18, freq: 1800, q: 1.5, attack: 0.03, sweepTo: 500 });
  },
  clinch(): void {
    E.burst({ dur: 0.2, vol: 0.2, freq: 300, q: 0.7, attack: 0.02 });
  },
  step(surface: 'soft' | 'hard' | 'water' = 'soft', quiet = false): void {
    const v = quiet ? 0.04 : 0.09;
    if (surface === 'water') E.burst({ dur: 0.12, vol: v * 1.4, freq: 900, q: 0.8, sweepTo: 400 });
    else E.burst({ dur: 0.05, vol: v, freq: surface === 'hard' ? 1600 : 700, q: 1.2 });
  },
  throw(): void {
    E.burst({ dur: 0.16, vol: 0.2, freq: 2500, q: 2, attack: 0.02, sweepTo: 900 });
  },
  impact(metal: boolean): void {
    if (metal) E.tone({ freq: 2600, dur: 0.15, vol: 0.12, type: 'triangle', to: 2000 });
    E.burst({ dur: 0.08, vol: 0.25, freq: 1100, q: 1 });
  },
  poof(): void {
    E.burst({ dur: 0.45, vol: 0.3, freq: 600, q: 0.6, attack: 0.01, sweepTo: 150, type: 'lowpass' });
  },
  sign(): void {
    E.burst({ dur: 0.04, vol: 0.3, freq: 2000, q: 6 });
    E.tone({ freq: 700, dur: 0.05, vol: 0.12, type: 'square' });
  },
  cast(): void {
    [523, 659, 784, 1046].forEach((f, i) => E.tone({ freq: f, dur: 0.25, vol: 0.1, type: 'sine', at: i * 0.05 }));
  },
  alert(): void {
    E.tone({ freq: 80, to: 55, dur: 0.25, vol: 0.5, type: 'sine' });
    E.burst({ dur: 0.18, vol: 0.3, freq: 250, q: 0.5, type: 'lowpass' });
    E.tone({ freq: 880, dur: 0.12, vol: 0.12, type: 'square', at: 0.05 });
    E.tone({ freq: 1175, dur: 0.18, vol: 0.12, type: 'square', at: 0.13 });
  },
  suspicious(): void {
    E.tone({ freq: 660, dur: 0.1, vol: 0.07, type: 'triangle' });
    E.tone({ freq: 740, dur: 0.12, vol: 0.07, type: 'triangle', at: 0.1 });
  },
  ko(): void {
    E.tone({ freq: 70, to: 40, dur: 0.35, vol: 0.5, type: 'sine' });
    E.burst({ dur: 0.25, vol: 0.25, freq: 200, q: 0.5, type: 'lowpass' });
  },
  pickup(): void {
    E.tone({ freq: 1400, dur: 0.06, vol: 0.1, type: 'triangle' });
    E.tone({ freq: 2100, dur: 0.08, vol: 0.08, type: 'triangle', at: 0.05 });
  },
  door(): void {
    E.burst({ dur: 0.3, vol: 0.12, freq: 400, q: 3, sweepTo: 250 });
  },
  progress(): void {
    [392, 494, 587, 784].forEach((f, i) => E.pluck(f, 0.12, i * 0.07));
  },
  ui(kind: 'move' | 'confirm' | 'back' | 'error'): void {
    if (kind === 'move') E.tone({ freq: 900, dur: 0.03, vol: 0.05, type: 'square' });
    else if (kind === 'confirm') { E.tone({ freq: 660, dur: 0.05, vol: 0.08, type: 'square' }); E.tone({ freq: 990, dur: 0.07, vol: 0.08, type: 'square', at: 0.05 }); }
    else if (kind === 'back') E.tone({ freq: 500, to: 350, dur: 0.08, vol: 0.07, type: 'square' });
    else E.tone({ freq: 160, dur: 0.12, vol: 0.12, type: 'square' });
  },
};


export const audio = {
  events(lv: Level, events: SimEvent[]): void {
    if (!E.ready) return;
    let steps = 0;
    for (const ev of events) {
      switch (ev.t) {
        case 'move': {
          if (steps++ > 2) break;
          const near = ev.id === lv.playerId;
          if (!near && !lv.visible[lv.idx(ev.to.x, ev.to.y)]) break;
          const water = lv.isWater(ev.to.x, ev.to.y) > 0;
          const t = lv.tile(ev.to.x, ev.to.y);
          const quiet = lv.c.actor.get(ev.id)?.stance === 'sneak' || !near;
          sfx.step(water ? 'water' : t === T.road || t === T.plaza || t === T.planks ? 'hard' : 'soft', quiet);
          break;
        }
        case 'exchange':
          if (ev.outcome === 'clinch') sfx.clinch();
          else if (ev.outcome === 'circle') sfx.whiff();
          break;
        case 'parry': sfx.parry(); break;
        case 'damage':
          if (ev.kind === 'bleed') break;
          if (ev.crit) sfx.crit(); else sfx.hit(ev.amount >= 8);
          break;
        case 'throw': sfx.throw(); if (!ev.hit) setTimeout(() => sfx.impact(true), 180); break;
        case 'smoke': sfx.poof(); break;
        case 'sign': sfx.sign(); break;
        case 'cast': sfx.cast(); break;
        case 'aware':
          if (ev.state === 'alert') sfx.alert();
          else if (ev.state === 'suspicious') sfx.suspicious();
          break;
        case 'ko': case 'death': sfx.ko(); break;
        case 'pickup': sfx.pickup(); break;
        case 'door': sfx.door(); break;
        case 'progress': sfx.progress(); break;
        case 'takedown': sfx.hit(true); break;
        default: break;
      }
    }
  },
};
