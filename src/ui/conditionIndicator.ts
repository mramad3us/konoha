import { createElement } from '../utils/dom.ts';
import type { CombatCondition } from '../types/combat.ts';

/** SVG icon for "Down" condition — small downward arrow */
const DOWN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" class="pixel-sprite">
  <rect x="5" y="1" width="2" height="7" fill="currentColor"/>
  <rect x="3" y="6" width="6" height="2" fill="currentColor"/>
  <rect x="4" y="8" width="4" height="1" fill="currentColor"/>
  <rect x="5" y="9" width="2" height="1" fill="currentColor"/>
</svg>`;

/** SVG icon for "Stunned" condition — spinning spiral */
const STUNNED_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" class="pixel-sprite">
  <rect x="4" y="1" width="4" height="1" fill="currentColor"/>
  <rect x="8" y="2" width="1" height="2" fill="currentColor"/>
  <rect x="7" y="4" width="1" height="1" fill="currentColor"/>
  <rect x="5" y="4" width="2" height="1" fill="currentColor"/>
  <rect x="4" y="5" width="1" height="2" fill="currentColor"/>
  <rect x="5" y="7" width="2" height="1" fill="currentColor"/>
  <rect x="7" y="6" width="1" height="1" fill="currentColor"/>
  <rect x="3" y="2" width="1" height="2" fill="currentColor"/>
  <rect x="3" y="8" width="4" height="1" fill="currentColor"/>
  <rect x="8" y="6" width="1" height="3" fill="currentColor"/>
  <rect x="5" y="5" width="2" height="2" fill="currentColor"/>
</svg>`;

/**
 * Condition indicator — shows active combat condition with icon + label.
 * Hidden when no condition is active.
 */
export class ConditionIndicator {
  readonly element: HTMLElement;
  private icon: HTMLElement;
  private label: HTMLElement;

  constructor() {
    this.element = createElement('div', { className: 'condition-indicator' });

    this.icon = createElement('div', { className: 'condition-indicator__icon' });
    this.element.appendChild(this.icon);

    this.label = createElement('span', { className: 'condition-indicator__label' });
    this.element.appendChild(this.label);
  }

  update(condition: CombatCondition | null): void {
    if (!condition) {
      this.element.classList.remove('condition-indicator--visible');
      return;
    }

    this.element.classList.add('condition-indicator--visible');

    if (condition === 'down') {
      this.icon.innerHTML = DOWN_ICON;
      this.icon.style.color = 'var(--color-gold)';
      this.label.textContent = 'DOWN';
      this.label.style.color = 'var(--color-gold)';
      this.element.classList.remove('condition-indicator--stunned');
      this.element.classList.add('condition-indicator--down');
    } else {
      this.icon.innerHTML = STUNNED_ICON;
      this.icon.style.color = 'var(--color-blood-bright)';
      this.label.textContent = 'STUNNED';
      this.label.style.color = 'var(--color-blood-bright)';
      this.element.classList.remove('condition-indicator--down');
      this.element.classList.add('condition-indicator--stunned');
    }
  }
}
