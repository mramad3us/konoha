import { createElement } from '../utils/dom.ts';

export interface ResourceBarConfig {
  label: string;
  type: 'hp' | 'chakra' | 'willpower' | 'stamina' | 'blood';
}

export class ResourceBar {
  readonly element: HTMLElement;
  private fill: HTMLElement;
  private valueEl: HTMLElement;

  constructor(config: ResourceBarConfig) {
    this.element = createElement('div', { className: 'resource-bar' });

    this.element.appendChild(
      createElement('span', { className: 'resource-bar__label', text: config.label })
    );

    const track = createElement('div', { className: 'resource-bar__track' });
    this.fill = createElement('div', {
      className: `resource-bar__fill resource-bar__fill--${config.type}`,
    });
    this.fill.style.width = '100%';
    track.appendChild(this.fill);
    this.element.appendChild(track);

    this.valueEl = createElement('span', {
      className: 'resource-bar__value',
      text: '0/0',
    });
    this.element.appendChild(this.valueEl);
  }

  update(current: number, max: number): void {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    const newWidth = `${pct}%`;

    // Only flash on decrease
    if (parseFloat(this.fill.style.width) > pct) {
      this.fill.classList.remove('resource-bar__fill--flash');
      void this.fill.offsetWidth; // Force reflow
      this.fill.classList.add('resource-bar__fill--flash');
    }

    this.fill.style.width = newWidth;
    this.valueEl.textContent = `${Math.ceil(current)}/${max}`;
  }
}
