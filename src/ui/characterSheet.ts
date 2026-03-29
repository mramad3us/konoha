import { createElement } from '../utils/dom.ts';
import type { CharacterSheet } from '../types/character.ts';
import {
  getProficiencyTier,
  SKILL_LABELS, STAT_LABELS,
  SKILL_DESCRIPTIONS, STAT_DESCRIPTIONS,
  ALL_SKILL_IDS, ALL_STAT_IDS,
  SHINOBI_RANK_LABELS,
} from '../types/character.ts';
import type { MissionRank } from '../engine/missions.ts';

export interface MissionRecord {
  completed: Record<MissionRank, number>;
  totalCompleted: number;
}


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

  show(name: string, sheet: CharacterSheet, missions?: MissionRecord): void {
    this.render(name, sheet, missions);
    this._visible = true;
    this.element.classList.add('charsheet-overlay--visible');
  }

  hide(): void {
    this._visible = false;
    this.element.classList.remove('charsheet-overlay--visible');
  }

  toggle(name: string, sheet: CharacterSheet, missions?: MissionRecord): void {
    if (this._visible) this.hide();
    else this.show(name, sheet, missions);
  }

  private render(name: string, sheet: CharacterSheet, missions?: MissionRecord): void {
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

    // ── Mission Record ──
    if (missions) {
      this.content.appendChild(
        createElement('div', { className: 'charsheet-section-title', text: '// Mission Record' })
      );
      this.content.appendChild(this.renderMissionRecord(missions));
    }

    // ── Skills section ──
    this.content.appendChild(
      createElement('div', { className: 'charsheet-section-title', text: '// Skills' })
    );

    const skillsGrid = createElement('div', { className: 'charsheet-grid' });
    for (const id of ALL_SKILL_IDS) {
      skillsGrid.appendChild(this.renderRow(
        SKILL_LABELS[id], sheet.skills[id], SKILL_DESCRIPTIONS[id], true,
      ));
    }
    this.content.appendChild(skillsGrid);

    // ── Stats section ──
    this.content.appendChild(
      createElement('div', { className: 'charsheet-section-title', text: '// Attributes' })
    );

    const statsGrid = createElement('div', { className: 'charsheet-grid' });
    for (const id of ALL_STAT_IDS) {
      statsGrid.appendChild(this.renderRow(
        STAT_LABELS[id], sheet.stats[id], STAT_DESCRIPTIONS[id], false,
      ));
    }
    this.content.appendChild(statsGrid);
  }

  private renderRow(label: string, value: number, description: string, showTier: boolean): HTMLElement {
    const tier = getProficiencyTier(value);
    const row = createElement('div', { className: 'charsheet-row' });

    row.appendChild(createElement('div', { className: 'charsheet-row__label', text: label }));

    // Bar
    const barWrap = createElement('div', { className: 'charsheet-row__bar' });
    const barFill = createElement('div', { className: 'charsheet-row__fill' });
    barFill.style.width = `${value}%`;
    barFill.style.backgroundColor = showTier ? tier.color : 'var(--color-ink-muted)';
    barWrap.appendChild(barFill);
    row.appendChild(barWrap);

    // Value + optional tier name
    const valueWrap = createElement('div', { className: 'charsheet-row__value' });
    valueWrap.appendChild(createElement('span', {
      className: 'charsheet-row__num',
      text: String(Math.floor(value)),
    }));
    if (showTier) {
      const tierEl = createElement('span', { className: 'charsheet-row__tier', text: tier.name });
      tierEl.style.color = tier.color;
      valueWrap.appendChild(tierEl);
    }
    row.appendChild(valueWrap);

    // Description
    row.appendChild(createElement('div', { className: 'charsheet-row__desc', text: description }));

    return row;
  }

  private renderMissionRecord(missions: MissionRecord): HTMLElement {
    const wrap = createElement('div', { className: 'charsheet-missions' });

    const RANK_COLORS: Record<MissionRank, string> = {
      D: '#6b9e6b',
      C: '#7a9ec2',
      B: '#c49a6c',
      A: '#c26b6b',
    };

    const ranks: MissionRank[] = ['D', 'C', 'B', 'A'];
    for (const rank of ranks) {
      const count = missions.completed[rank];
      const entry = createElement('div', { className: 'charsheet-mission-entry' });

      const badge = createElement('span', {
        className: `charsheet-mission-rank charsheet-mission-rank--${rank}`,
        text: rank,
      });
      badge.style.color = RANK_COLORS[rank];
      entry.appendChild(badge);

      entry.appendChild(createElement('span', {
        className: 'charsheet-mission-label',
        text: '-Rank',
      }));

      entry.appendChild(createElement('span', {
        className: 'charsheet-mission-count',
        text: String(count),
      }));

      wrap.appendChild(entry);
    }

    // Total
    const totalEntry = createElement('div', { className: 'charsheet-mission-entry charsheet-mission-total' });
    totalEntry.appendChild(createElement('span', {
      className: 'charsheet-mission-label',
      text: 'Total',
    }));
    totalEntry.appendChild(createElement('span', {
      className: 'charsheet-mission-count',
      text: String(missions.totalCompleted),
    }));
    wrap.appendChild(totalEntry);

    return wrap;
  }
}
