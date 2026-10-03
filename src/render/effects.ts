/**
 * Transient visual effects in world (tile) coordinates: particles, projectiles, floating text,
 * speech bubbles, noise rings, decals. Presentation only.
 */

import type { ItemKind } from '../ecs/components.ts';
import type { RGB } from '../art/color.ts';

export interface Particle {
  x: number; y: number; z: number;     // tile coords + height in px
  vx: number; vy: number; vz: number;  // per second
  life: number; age: number;
  color: RGB; size: number; gravity: number; fade: boolean;
}

export interface Projectile { fx: number; fy: number; tx: number; ty: number; t0: number; dur: number; weapon: ItemKind; spin: number }
export interface FloatText { x: number; y: number; text: string; color: RGB; t0: number; dur: number; big: boolean }
export interface Bubble { id: number; text: string; t0: number; dur: number }
export interface Ring { x: number; y: number; r: number; t0: number; dur: number }
export interface Decal { x: number; y: number; kind: 'blood' | 'pool' | 'scorch'; seed: number; t0: number }

export class Effects {
  particles: Particle[] = [];
  projectiles: Projectile[] = [];
  floats: FloatText[] = [];
  bubbles: Bubble[] = [];
  rings: Ring[] = [];
  decals: Decal[] = [];

  update(now: number, dt: number): void {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= p.gravity * dt;
      if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; }
    }
    this.particles = this.particles.filter(p => p.age < p.life);
    this.projectiles = this.projectiles.filter(p => now < p.t0 + p.dur);
    this.floats = this.floats.filter(f => now < f.t0 + f.dur);
    this.bubbles = this.bubbles.filter(b => now < b.t0 + b.dur);
    this.rings = this.rings.filter(r => now < r.t0 + r.dur);
    if (this.decals.length > 400) this.decals.splice(0, this.decals.length - 400);
  }

  burst(x: number, y: number, n: number, color: RGB, opts: Partial<Particle> & { speed?: number; up?: number } = {}): void {
    const speed = opts.speed ?? 1.2, up = opts.up ?? 30;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y, z: opts.z ?? 10,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: up * (0.5 + Math.random() * 0.8),
        life: (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6), age: 0,
        color, size: opts.size ?? 1, gravity: opts.gravity ?? 120, fade: opts.fade ?? true,
      });
    }
  }

  smoke(x: number, y: number, n = 14): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.3 + Math.random() * 0.7;
      const g = 170 + Math.random() * 60;
      this.particles.push({
        x, y, z: 4 + Math.random() * 10,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 6 + Math.random() * 14,
        life: 0.7 + Math.random() * 0.5, age: 0, color: [g, g, g + 8], size: 2 + Math.floor(Math.random() * 2),
        gravity: -4, fade: true,
      });
    }
  }

  float(x: number, y: number, text: string, color: RGB, now: number, big = false, dur = 1100): void {
    // Stack floats on the same tile so they don't overlap.
    const stacked = this.floats.filter(f => Math.abs(f.x - x) < 0.5 && Math.abs(f.y - y) < 0.5 && now - f.t0 < 400).length;
    this.floats.push({ x, y, text, color, t0: now + stacked * 120, dur, big });
  }

  bark(id: number, text: string, now: number): void {
    this.bubbles = this.bubbles.filter(b => b.id !== id);
    this.bubbles.push({ id, text, t0: now, dur: 2200 });
  }
}
