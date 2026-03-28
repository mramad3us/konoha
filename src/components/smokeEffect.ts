import { SMOKE_PARTICLE_SVG } from '../assets/sprites/pixelArt.ts';

/** Create a smoke puff effect at a given position within a container */
export function createSmokePuff(container: HTMLElement, x: number, y: number, count = 6): void {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.innerHTML = SMOKE_PARTICLE_SVG;
    particle.style.cssText = `
      position: absolute;
      left: ${x + (Math.random() - 0.5) * 40}px;
      top: ${y + (Math.random() - 0.5) * 20}px;
      width: ${16 + Math.random() * 16}px;
      height: ${16 + Math.random() * 16}px;
      color: var(--color-ink-faint);
      pointer-events: none;
      image-rendering: pixelated;
      opacity: 0;
      z-index: 50;
    `;
    particle.className = 'smoke-puff';
    particle.style.animationDelay = `${i * 60}ms`;
    container.appendChild(particle);

    particle.addEventListener('animationend', () => particle.remove());
  }
}
