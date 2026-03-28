import { createElement } from '../utils/dom.ts';
import type { CharacterSheet } from '../types/character.ts';
import {
  getProficiencyTier,
  SKILL_LABELS, STAT_LABELS,
  SKILL_DESCRIPTIONS, STAT_DESCRIPTIONS,
  ALL_SKILL_IDS, ALL_STAT_IDS,
  SHINOBI_RANK_LABELS,
} from '../types/character.ts';


/**
 * Character sheet overlay — shows skills, stats, rank, title.
 * Toggled with 'c' key from the game screen.
 */
export class CharacterSheetUI {
  readonly element: HTMLElement;
  private content: HTMLElement;
  private _visible = false;

  constructor() {
    this.element = createElement('div', { className: 'charsheet-overlay' });
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.hide();
    });

    const panel = createElement('div', { className: 'charsheet-panel' });

    // Close button
    const closeBtn = createElement('button', { className: 'charsheet-close', text: '×' });
    closeBtn.addEventListener('click', () => this.hide());
    panel.appendChild(closeBtn);

    this.content = createElement('div', { className: 'charsheet-content' });
    panel.appendChild(this.content);

    this.element.appendChild(panel);
  }

  get visible(): boolean { return this._visible; }

  show(name: string, sheet: CharacterSheet): void {
    this.render(name, sheet);
    this._visible = true;
    this.element.classList.add('charsheet-overlay--visible');
  }

  hide(): void {
    this._visible = false;
    this.element.classList.remove('charsheet-overlay--visible');
  }

  toggle(name: string, sheet: CharacterSheet): void {
    if (this._visible) this.hide();
    else this.show(name, sheet);
  }

  private render(name: string, sheet: CharacterSheet): void {
    this.content.innerHTML = '';

    // ── Header ──
    const header = createElement('div', { className: 'charsheet-header' });
    header.appendChild(createElement('div', { className: 'charsheet-name', text: name }));

    const meta = createElement('div', { className: 'charsheet-meta' });
    meta.appendChild(createElement('span', {
      className: 'charsheet-rank',
      text: SHINOBI_RANK_LABELS[sheet.rank],
    }));
    meta.appendChild(createElement('span', { className: 'charsheet-sep', text: '·' }));
    meta.appendChild(createElement('span', {
      className: 'charsheet-title',
      text: sheet.title,
    }));
    header.appendChild(meta);
    this.content.appendChild(header);

    // ── Skills section ──
    this.content.appendChild(
      createElement('div', { className: 'charsheet-section-title', text: '// Skills' })
    );

    const skillsGrid = createElement('div', { className: 'charsheet-grid' });
    for (const id of ALL_SKILL_IDS) {
      skillsGrid.appendChild(this.renderStatRow(
        SKILL_LABELS[id],
        sheet.skills[id],
        SKILL_DESCRIPTIONS[id],
      ));
    }
    this.content.appendChild(skillsGrid);

    // ── Stats section ──
    this.content.appendChild(
      createElement('div', { className: 'charsheet-section-title', text: '// Attributes' })
    );

    const statsGrid = createElement('div', { className: 'charsheet-grid' });
    for (const id of ALL_STAT_IDS) {
      statsGrid.appendChild(this.renderStatRow(
        STAT_LABELS[id],
        sheet.stats[id],
        STAT_DESCRIPTIONS[id],
      ));
    }
    this.content.appendChild(statsGrid);
  }

  private renderStatRow(label: string, value: number, description: string): HTMLElement {
    const tier = getProficiencyTier(value);
    const row = createElement('div', { className: 'charsheet-row' });

    const labelEl = createElement('div', { className: 'charsheet-row__label', text: label });
    row.appendChild(labelEl);

    // Bar
    const barWrap = createElement('div', { className: 'charsheet-row__bar' });
    const barFill = createElement('div', { className: 'charsheet-row__fill' });
    barFill.style.width = `${value}%`;
    barFill.style.backgroundColor = tier.color;
    barWrap.appendChild(barFill);
    row.appendChild(barWrap);

    // Value + tier
    const valueWrap = createElement('div', { className: 'charsheet-row__value' });
    valueWrap.appendChild(createElement('span', {
      className: 'charsheet-row__num',
      text: String(Math.floor(value)),
    }));
    const tierEl = createElement('span', { className: 'charsheet-row__tier', text: tier.name });
    tierEl.style.color = tier.color;
    valueWrap.appendChild(tierEl);
    row.appendChild(valueWrap);

    // Tooltip-style description
    const desc = createElement('div', { className: 'charsheet-row__desc', text: description });
    row.appendChild(desc);

    return row;
  }
}
