/**
 * Canvas-based particle system for visual effects.
 * Particles live in grid coordinates and are projected to screen by the renderer.
 */

import { TILE_WIDTH, TILE_HEIGHT } from '../core/constants.ts';

export interface Particle {
  gridX: number;
  gridY: number;
  offsetX: number;   // sub-tile pixel offset
  offsetY: number;
  vx: number;        // velocity in pixels/s
  vy: number;
  life: number;      // remaining life in seconds
  maxLife: number;
  radius: number;
  r: number; g: number; b: number;
}

const particles: Particle[] = [];

/** Spawn a smoke puff at a grid position */
export function spawnSmokePuff(gridX: number, gridY: number, count: number = 8): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 25;
    const life = 0.3 + Math.random() * 0.3;
    particles.push({
      gridX, gridY,
      offsetX: (Math.random() - 0.5) * 12,
      offsetY: (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 10, // drift upward
      life,
      maxLife: life,
      radius: 3 + Math.random() * 4,
      r: 180 + Math.random() * 40,
      g: 175 + Math.random() * 40,
      b: 160 + Math.random() * 40,
    });
  }
}

/** Spawn a chakra flash (blue burst) at a grid position */
export function spawnChakraFlash(gridX: number, gridY: number, count: number = 5): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 30;
    const life = 0.15 + Math.random() * 0.15;
    particles.push({
      gridX, gridY,
      offsetX: (Math.random() - 0.5) * 8,
      offsetY: (Math.random() - 0.5) * 6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      radius: 2 + Math.random() * 3,
      r: 60 + Math.random() * 30,
      g: 120 + Math.random() * 40,
      b: 200 + Math.random() * 55,
    });
  }
}

/** Update all particles — call once per render frame */
export function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.offsetX += p.vx * dt;
    p.offsetY += p.vy * dt;
    p.radius *= 0.98; // shrink slightly
  }
}

/** Draw all particles on the canvas */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  offset: { ox: number; oy: number },
): void {
  const halfTW = TILE_WIDTH / 2;
  const halfTH = TILE_HEIGHT / 2;

  for (const p of particles) {
    const sx = (p.gridX - p.gridY) * halfTW + offset.ox + halfTW / 2 + p.offsetX;
    const sy = (p.gridX + p.gridY) * halfTH + offset.oy + halfTH / 2 + p.offsetY;
    const alpha = (p.life / p.maxLife) * 0.7;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${Math.floor(p.r)},${Math.floor(p.g)},${Math.floor(p.b)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

/** Check if any particles are active */
export function hasActiveParticles(): boolean {
  return particles.length > 0;
}
