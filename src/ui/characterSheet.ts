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
import { getAvailableTechniques, getNextTechnique, getChakraSprintSpeed, getChakraSprintTier } from '../data/techniques.ts';
import type { NinjutsuTechnique } from '../data/techniques.ts';
import type { SquadRoster, SquadMember } from '../types/squad.ts';

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

  show(name: string, sheet: CharacterSheet, missions?: MissionRecord, squad?: SquadRoster): void {
    this.render(name, sheet, missions, squad);
    this._visible = true;
    this.element.classList.add('charsheet-overlay--visible');
  }

  hide(): void {
    this._visible = false;
    this.element.classList.remove('charsheet-overlay--visible');
  }

  toggle(name: string, sheet: CharacterSheet, missions?: MissionRecord, squad?: SquadRoster): void {
    if (this._visible) this.hide();
    else this.show(name, sheet, missions, squad);
  }

  private render(name: string, sheet: CharacterSheet, missions?: MissionRecord, squad?: SquadRoster): void {
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

    // ── Ninjutsu Techniques ──
    const techniques = getAvailableTechniques(sheet.skills.ninjutsu);
    const nextTech = getNextTechnique(sheet.skills.ninjutsu);

    this.content.appendChild(
      createElement('div', { className: 'charsheet-section-title', text: '// Ninjutsu Techniques' })
    );
    const techGrid = createElement('div', { className: 'charsheet-techniques' });

    if (techniques.length > 0) {
      for (const tech of techniques) {
        techGrid.appendChild(this.renderTechnique(tech, sheet.skills.ninjutsu));
      }
    }

    // Show next locked technique as a teaser
    if (nextTech) {
      techGrid.appendChild(this.renderLockedTechnique(nextTech));
    }

    // Show "none yet" if no techniques AND no upcoming ones (shouldn't happen, but safe)
    if (techniques.length === 0 && !nextTech) {
      techGrid.appendChild(createElement('div', { className: 'charsheet-technique charsheet-technique--locked', text: 'No techniques known yet.' }));
    }

    this.content.appendChild(techGrid);

    // ── Squad Roster ──
    if (squad && squad.members.length > 0) {
      this.content.appendChild(
        createElement('div', { className: 'charsheet-section-title', text: '// Squad Roster' })
      );
      const squadWrap = createElement('div', { className: 'charsheet-squad' });
      for (const member of squad.members) {
        squadWrap.appendChild(this.renderSquadMember(member, squad));
      }
      this.content.appendChild(squadWrap);
    }
  }

  private renderRow(label: string, value: number, description: string, showTier: boolean): HTMLElement {
    const tier = getProficiencyTier(value);
    const row = createElement('div', { className: 'charsheet-row' });

    row.appendChild(createElement('div', { className: 'charsheet-row__label', text: label }));

    // Bar — shows progress toward the next whole level (fractional part)
    const progressPct = (value - Math.floor(value)) * 100;
    const barWrap = createElement('div', { className: 'charsheet-row__bar' });
    const barFill = createElement('div', { className: 'charsheet-row__fill' });
    barFill.style.width = `${progressPct}%`;
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

  private renderTechnique(tech: NinjutsuTechnique, ninjutsuLevel: number): HTMLElement {
    const row = createElement('div', { className: 'charsheet-technique' });

    // Scroll icon
    const scrollIcon = createElement('span', { className: 'charsheet-technique__scroll' });
    row.appendChild(scrollIcon);

    // Name
    row.appendChild(createElement('span', {
      className: 'charsheet-technique__name',
      text: tech.name,
    }));

    // Extra info for scaling techniques
    if (tech.id === 'chakra_sprint') {
      const speed = getChakraSprintSpeed(ninjutsuLevel);
      const tier = getChakraSprintTier(ninjutsuLevel);
      row.appendChild(createElement('span', {
        className: 'charsheet-technique__detail',
        text: `${tier} · ${speed}s/step`,
      }));
    }

    // Description
    const desc = createElement('div', {
      className: 'charsheet-technique__desc',
      text: tech.description,
    });
    row.appendChild(desc);

    return row;
  }

  private renderLockedTechnique(tech: NinjutsuTechnique): HTMLElement {
    const row = createElement('div', { className: 'charsheet-technique charsheet-technique--locked' });

    // Locked scroll icon (dimmed)
    const scrollIcon = createElement('span', { className: 'charsheet-technique__scroll charsheet-technique__scroll--locked' });
    row.appendChild(scrollIcon);

    // Name (with requirement)
    row.appendChild(createElement('span', {
      className: 'charsheet-technique__name',
      text: `??? — Ninjutsu ${tech.requiredNinjutsu}`,
    }));

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

  private renderSquadMember(member: SquadMember, _roster: SquadRoster): HTMLElement {
    const card = createElement('div', { className: 'charsheet-squad-member' });

    // ── Header row: name, rank, status ──
    const header = createElement('div', { className: 'charsheet-squad-member__header' });

    header.appendChild(createElement('span', {
      className: 'charsheet-squad-member__name',
      text: member.name,
    }));

    header.appendChild(createElement('span', {
      className: 'charsheet-squad-member__rank',
      text: SHINOBI_RANK_LABELS[member.rank],
    }));

    // Status badge
    const statusColors: Record<string, string> = {
      available: '#6b9e6b',
      on_mission: '#c49a6c',
      injured: '#c2a24e',
      dead: '#c26b6b',
    };
    const statusLabels: Record<string, string> = {
      available: 'Available',
      on_mission: 'Deployed',
      injured: 'Injured',
      dead: 'KIA',
    };
    const statusBadge = createElement('span', {
      className: `charsheet-squad-status charsheet-squad-status--${member.status}`,
      text: statusLabels[member.status] ?? member.status,
    });
    statusBadge.style.color = statusColors[member.status] ?? 'var(--color-ink-muted)';
    header.appendChild(statusBadge);

    // Personality tag
    header.appendChild(createElement('span', {
      className: 'charsheet-squad-member__personality',
      text: member.personality,
    }));

    card.appendChild(header);

    // ── Skill bars (compact: taijutsu, ninjutsu, genjutsu) ──
    const skillsRow = createElement('div', { className: 'charsheet-squad-skills' });
    const displaySkills: Array<{ id: keyof typeof SKILL_LABELS; label: string }> = [
      { id: 'taijutsu', label: 'TAI' },
      { id: 'ninjutsu', label: 'NIN' },
      { id: 'genjutsu', label: 'GEN' },
      { id: 'bukijutsu', label: 'BUK' },
      { id: 'med', label: 'MED' },
    ];

    for (const { id, label } of displaySkills) {
      const val = member.skills[id];
      const tier = getProficiencyTier(val);
      const skill = createElement('div', { className: 'charsheet-squad-skill' });

      skill.appendChild(createElement('span', {
        className: 'charsheet-squad-skill__label',
        text: label,
      }));

      const bar = createElement('div', { className: 'charsheet-squad-skill__bar' });
      const fill = createElement('div', { className: 'charsheet-squad-skill__fill' });
      fill.style.width = `${Math.min(100, val)}%`;
      fill.style.backgroundColor = tier.color;
      bar.appendChild(fill);
      skill.appendChild(bar);

      const num = createElement('span', {
        className: 'charsheet-squad-skill__num',
        text: String(Math.floor(val)),
      });
      skill.appendChild(num);

      skillsRow.appendChild(skill);
    }

    card.appendChild(skillsRow);

    // ── Footer: missions completed ──
    const footer = createElement('div', { className: 'charsheet-squad-member__footer' });
    footer.appendChild(createElement('span', {
      className: 'charsheet-squad-member__missions',
      text: `${member.missionsCompleted} mission${member.missionsCompleted !== 1 ? 's' : ''} completed`,
    }));
    card.appendChild(footer);

    return card;
  }
}
