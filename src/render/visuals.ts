/**
 * Visual state per entity (tweened position, temporary poses, flashes) driven by sim events.
 */

import type { Level } from '../ecs/level.ts';
import type { EntityId, Move } from '../ecs/components.ts';
import type { SimEvent } from '../ecs/events.ts';
import type { Pose } from '../art/characters.ts';
import { Effects } from './effects.ts';
import { hex, type RGB } from '../art/color.ts';
import { HAND_SIGNS, TECHNIQUES } from '../content/techniques.ts';
import { STAT_LABEL } from '../sim/progress.ts';
import { ITEMS } from '../content/items.ts';

export interface Vis {
  x: number; y: number;
  fx: number; fy: number; tx: number; ty: number; t0: number; dur: number;
  pose: Pose | null; poseUntil: number;
  lungeX: number; lungeY: number; lungeUntil: number;
  flashUntil: number;
  stepPhase: number;
  awarePop: number;
}

const POSE_OF: Record<Move, Pose> = { strike: 'strike', break: 'break', guard: 'guard' };

export const COLORS = {
  dmgOut: hex('#ffe08a'),
  dmgIn: hex('#ff6a5a'),
  crit: hex('#ffb040'),
  info: hex('#e8e4da'),
  good: hex('#8fe08a'),
  chakra: hex('#8ac8ff'),
  gold: hex('#f0c860'),
  blood: hex('#8a1a1a'),
  bloodLight: hex('#b8302a'),
  spark: hex('#fff2b0'),
} satisfies Record<string, RGB>;

export class Visuals {
  private map = new Map<EntityId, Vis>();
  readonly fx = new Effects();
  /** Screen shake request (ms timestamp until, strength px). */
  shakeUntil = 0;
  shakeMag = 0;
  private levelId = '';

  bind(lv: Level): void {
    if (lv.id !== this.levelId) {
      this.map.clear();
      this.fx.decals = [];
      this.fx.particles = [];
      this.fx.projectiles = [];
      this.levelId = lv.id;
    }
  }

  get(lv: Level, id: EntityId): Vis {
    let v = this.map.get(id);
    const p = lv.c.pos.get(id);
    if (!v) {
      const x = p?.x ?? 0, y = p?.y ?? 0;
      v = { x, y, fx: x, fy: y, tx: x, ty: y, t0: 0, dur: 0, pose: null, poseUntil: 0, lungeX: 0, lungeY: 0, lungeUntil: 0, flashUntil: 0, stepPhase: 0, awarePop: 0 };
      this.map.set(id, v);
    }
    return v;
  }

  /** Snap every visual to its sim position (after loading or a level change). */
  snapAll(lv: Level): void {
    for (const [id, p] of lv.c.pos) {
      const v = this.get(lv, id);
      v.x = v.fx = v.tx = p.x; v.y = v.fy = v.ty = p.y; v.dur = 0;
    }
  }

  isMoving(v: Vis, now: number): boolean {
    return now < v.t0 + v.dur;
  }

  update(lv: Level, now: number, dt: number): void {
    for (const [id, v] of this.map) {
      const p = lv.c.pos.get(id);
      if (!p) { this.map.delete(id); continue; }
      if (v.dur > 0 && now < v.t0 + v.dur) {
        const t = Math.max(0, (now - v.t0) / v.dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        v.x = v.fx + (v.tx - v.fx) * e;
        v.y = v.fy + (v.ty - v.fy) * e;
      } else {
        // Settle on the sim position (covers moves we never saw an event for).
        v.x = p.x; v.y = p.y;
      }
    }
    this.fx.update(now, dt);
  }

  apply(lv: Level, events: SimEvent[], now: number): void {
    const flightDelay = new Map<EntityId, number>();
    for (const ev of events) {
      switch (ev.t) {
        case 'move': {
          const v = this.get(lv, ev.id);
          const ms = Math.max(70, Math.min(260, ev.ticks * 11));
          const cur = this.isMoving(v, now) ? { x: v.x, y: v.y } : { x: ev.from.x, y: ev.from.y };
          v.fx = cur.x; v.fy = cur.y; v.tx = ev.to.x; v.ty = ev.to.y;
          v.t0 = now; v.dur = ms;
          v.stepPhase ^= 1;
          break;
        }
        case 'teleport': {
          const v = this.get(lv, ev.id);
          v.x = v.fx = v.tx = ev.to.x; v.y = v.fy = v.ty = ev.to.y; v.dur = 0;
          break;
        }
        case 'exchange': {
          this.strikePose(lv, ev.a, ev.b, ev.moveA, now);
          this.strikePose(lv, ev.b, ev.a, ev.moveB, now);
          const pa = lv.c.pos.get(ev.a), pb = lv.c.pos.get(ev.b);
          if (pa && pb && (ev.outcome === 'clinch' || ev.outcome === 'trade' || ev.moveA === 'guard' || ev.moveB === 'guard')) {
            this.fx.burst((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, 5, COLORS.spark, { z: 14, speed: 0.8, up: 20, life: 0.25, gravity: 60 });
          }
          break;
        }
        case 'open_hit':
          this.strikePose(lv, ev.attacker, ev.target, ev.move, now);
          break;
        case 'takedown': {
          this.strikePose(lv, ev.id, ev.target, 'break', now);
          const p = lv.c.pos.get(ev.target);
          if (p) this.fx.float(p.x, p.y, ev.lethal ? 'Silenced' : 'Takedown', COLORS.good, now, true);
          break;
        }
        case 'damage': {
          const p = lv.c.pos.get(ev.id);
          if (!p) break;
          const v = this.get(lv, ev.id);
          const delay = ev.kind === 'thrown' ? flightDelay.get(ev.id) ?? 0 : 0;
          v.flashUntil = now + delay + 110;
          const toPlayer = ev.id === lv.playerId;
          if (ev.amount > 0 || lv.c.dummy.has(ev.id)) {
            this.fx.float(p.x, p.y, `${ev.amount}${ev.crit ? '!' : ''}`, ev.crit ? COLORS.crit : toPlayer ? COLORS.dmgIn : COLORS.dmgOut, now + delay, ev.crit);
          }
          if (!lv.c.dummy.has(ev.id) && ev.amount > 0 && ev.kind !== 'bleed') {
            this.fx.burst(p.x, p.y, ev.crit ? 10 : 5, COLORS.blood, { z: 12, speed: 1, up: 35, life: 0.6, size: 1 });
            if (Math.random() < 0.5) this.fx.decals.push({ x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + (Math.random() - 0.5) * 0.6, kind: 'blood', seed: Math.random() * 1e6 | 0, t0: now });
          }
          if (ev.crit || (toPlayer && ev.amount >= 8)) { this.shakeUntil = now + 220; this.shakeMag = ev.crit ? 3 : 2; }
          break;
        }
        case 'parry': {
          const p = lv.c.pos.get(ev.id);
          if (p) this.fx.float(p.x, p.y, 'Parry', COLORS.info, now);
          break;
        }
        case 'stagger': {
          const p = lv.c.pos.get(ev.id);
          if (p) this.fx.float(p.x, p.y, 'Stagger', COLORS.crit, now);
          break;
        }
        case 'ko': {
          const p = lv.c.pos.get(ev.id);
          if (p) this.fx.float(p.x, p.y, 'KO', COLORS.info, now, true);
          break;
        }
        case 'death': {
          const p = lv.c.pos.get(ev.id);
          if (p) this.fx.decals.push({ x: p.x, y: p.y, kind: 'pool', seed: Math.random() * 1e6 | 0, t0: now });
          break;
        }
        case 'throw': {
          const d = Math.hypot(ev.to.x - ev.from.x, ev.to.y - ev.from.y);
          const dur = 60 + d * 45;
          this.fx.projectiles.push({ fx: ev.from.x, fy: ev.from.y, tx: ev.to.x, ty: ev.to.y, t0: now, dur, weapon: ev.weapon, spin: 0 });
          if (ev.target !== null) flightDelay.set(ev.target, dur);
          const v = this.get(lv, ev.source);
          v.pose = 'throw'; v.poseUntil = now + 260;
          break;
        }
        case 'noise':
          if (ev.radius >= 3) this.fx.rings.push({ x: ev.at.x, y: ev.at.y, r: ev.radius, t0: now, dur: 650 });
          break;
        case 'aware':
          this.get(lv, ev.id).awarePop = now;
          break;
        case 'sign': {
          const p = lv.c.pos.get(ev.id);
          const v = this.get(lv, ev.id);
          v.pose = 'sign'; v.poseUntil = now + 450;
          if (p) this.fx.float(p.x, p.y, HAND_SIGNS[ev.sign].jp, COLORS.gold, now, false, 800);
          break;
        }
        case 'cast': {
          const p = lv.c.pos.get(ev.id);
          if (p) {
            this.fx.float(p.x, p.y, TECHNIQUES[ev.technique]?.name ?? ev.technique, COLORS.chakra, now, true, 1300);
            this.fx.burst(p.x, p.y, 12, COLORS.chakra, { z: 10, speed: 0.9, up: 25, life: 0.5, gravity: 20 });
          }
          break;
        }
        case 'smoke':
          this.fx.smoke(ev.at.x, ev.at.y);
          break;
        case 'float':
          this.fx.float(ev.at.x, ev.at.y, ev.text, hex(ev.color), now);
          break;
        case 'bark':
          this.fx.bark(ev.id, ev.text, now);
          break;
        case 'pickup': {
          const p = lv.c.pos.get(ev.id);
          if (p) this.fx.float(p.x, p.y, `+${ev.count} ${ITEMS[ev.item].name}`, COLORS.info, now);
          break;
        }
        case 'progress': {
          const p = lv.c.pos.get(lv.playerId);
          if (p) this.fx.float(p.x, p.y, `${STAT_LABEL[ev.stat]} ${ev.to}`, COLORS.gold, now + 200, true, 1800);
          break;
        }
        case 'face': case 'door': case 'revive': case 'sfx':
          break;
      }
    }
  }

  private strikePose(lv: Level, id: EntityId, target: EntityId, m: Move, now: number): void {
    const v = this.get(lv, id);
    v.pose = POSE_OF[m];
    v.poseUntil = now + (m === 'guard' ? 320 : 240);
    if (m !== 'guard') {
      const a = lv.c.pos.get(id), b = lv.c.pos.get(target);
      if (a && b) { v.lungeX = (b.x - a.x) * 0.22; v.lungeY = (b.y - a.y) * 0.22; v.lungeUntil = now + 150; }
    }
  }
}
