import { createElement } from '../utils/dom.ts';
import type { TempoState } from '../types/combat.ts';

/**
 * Tempo bead display — shows accumulated tempo as small filled/empty beads.
 * Visible only when in melee range of a target.
 */
export class TempoBeadsUI {
  readonly element: HTMLElement;
  private beadContainer: HTMLElement;
  private label: HTMLElement;

  constructor() {
    this.element = createElement('div', { className: 'tempo-beads' });

    this.label = createElement('span', { className: 'tempo-beads__label', text: 'Tempo' });
    this.element.appendChild(this.label);

    this.beadContainer = createElement('div', { className: 'tempo-beads__row' });
    this.element.appendChild(this.beadContainer);
  }

  /** Update the bead display. Pass null to hide. */
  update(tempo: TempoState | null): void {
    if (!tempo) {
      this.element.classList.remove('tempo-beads--visible');
      return;
    }

    this.element.classList.add('tempo-beads--visible');
    this.beadContainer.innerHTML = '';

    for (let i = 0; i < tempo.max; i++) {
      const bead = createElement('div', {
        className: `tempo-beads__bead ${i < tempo.current ? 'tempo-beads__bead--filled' : ''}`,
      });
      this.beadContainer.appendChild(bead);
    }
  }
}
