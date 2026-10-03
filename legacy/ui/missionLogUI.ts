import { createElement } from '../utils/dom.ts';
import type { MissionLog } from '../engine/missions.ts';
import { getActiveMissionStatus, isAwayMission } from '../engine/missions.ts';

export class MissionLogUI {
  readonly element: HTMLElement;
  private content: HTMLElement;
  private _visible = false;

  constructor() {
    this.element = createElement('div', { className: 'mission-log-overlay' });
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.hide();
    });

    const panel = createElement('div', { className: 'mission-log-panel' });

    const closeBtn = createElement('button', { className: 'charsheet-close', text: '×' });
    closeBtn.addEventListener('click', () => this.hide());
    panel.appendChild(closeBtn);

    this.content = createElement('div', { className: 'mission-log-content' });
    panel.appendChild(this.content);

    this.element.appendChild(panel);
  }

  get visible(): boolean { return this._visible; }

  show(log: MissionLog, gameDay: number): void {
    this.render(log, gameDay);
    this._visible = true;
    this.element.classList.add('mission-log-overlay--visible');
  }

  hide(): void {
    this._visible = false;
    this.element.classList.remove('mission-log-overlay--visible');
  }

  toggle(log: MissionLog, gameDay: number): void {
    if (this._visible) this.hide();
    else this.show(log, gameDay);
  }

  private render(log: MissionLog, gameDay: number): void {
    this.content.innerHTML = '';

    // Header
    const header = createElement('div', { className: 'mission-log-header' });
    header.textContent = '// Mission Log';
    this.content.appendChild(header);

    if (!log.active) {
      const empty = createElement('div', { className: 'mission-log-empty' });
      empty.textContent = 'No active mission. Visit the Mission Desk to accept one.';
      this.content.appendChild(empty);
    } else {
      const m = log.active.mission;
      const active = log.active;

      // Rank badge + title
      const titleRow = createElement('div', { className: 'mission-log-title' });
      const rankBadge = createElement('span', { className: `mission-log-rank mission-log-rank--${m.rank.toLowerCase()}` });
      rankBadge.textContent = m.rank;
      titleRow.appendChild(rankBadge);
      titleRow.appendChild(document.createTextNode(` ${m.title}`));
      this.content.appendChild(titleRow);

      // Client
      this.addRow('Client', m.client);

      // Type indicator
      if (isAwayMission(m.templateKey)) {
        this.addRow('Type', 'Away Mission');
      } else {
        this.addRow('Type', 'Village Mission');
      }

      // Description
      const descBlock = createElement('div', { className: 'mission-log-desc' });
      descBlock.textContent = m.description;
      this.content.appendChild(descBlock);

      // Objective
      const objHeader = createElement('div', { className: 'mission-log-section' });
      objHeader.textContent = '// Objective';
      this.content.appendChild(objHeader);

      const objText = createElement('div', { className: 'mission-log-objective' });
      objText.textContent = m.objective;
      this.content.appendChild(objText);

      // Status
      const status = getActiveMissionStatus(log);
      if (status) {
        const statusRow = createElement('div', { className: `mission-log-status ${active.objectiveComplete ? 'mission-log-status--complete' : ''}` });
        statusRow.textContent = active.objectiveComplete ? 'OBJECTIVE COMPLETE — Report to Mission Desk' : status;
        this.content.appendChild(statusRow);
      }

      // Time info
      const daysLeft = (m.postedDay + m.durationDays) - gameDay;
      if (daysLeft > 0) {
        this.addRow('Expires in', `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`);
      } else {
        this.addRow('Status', 'EXPIRED');
      }
    }

    // Completed missions tally
    const tallyHeader = createElement('div', { className: 'mission-log-section' });
    tallyHeader.textContent = '// Record';
    this.content.appendChild(tallyHeader);

    const tally = createElement('div', { className: 'mission-log-tally' });
    const ranks: Array<'D' | 'C' | 'B' | 'A'> = ['D', 'C', 'B', 'A'];
    for (const rank of ranks) {
      const count = log.completed[rank] ?? 0;
      const entry = createElement('span', { className: 'mission-log-tally-entry' });
      const badge = createElement('span', { className: `mission-log-rank mission-log-rank--${rank.toLowerCase()}` });
      badge.textContent = rank;
      entry.appendChild(badge);
      entry.appendChild(document.createTextNode(` ×${count}`));
      tally.appendChild(entry);
    }
    this.content.appendChild(tally);

    const totalLine = createElement('div', { className: 'mission-log-total' });
    totalLine.textContent = `Total completed: ${log.totalCompleted}`;
    this.content.appendChild(totalLine);
  }

  private addRow(label: string, value: string): void {
    const row = createElement('div', { className: 'mission-log-row' });
    const lbl = createElement('span', { className: 'mission-log-row-label' });
    lbl.textContent = label;
    const val = createElement('span', { className: 'mission-log-row-value' });
    val.textContent = value;
    row.appendChild(lbl);
    row.appendChild(val);
    this.content.appendChild(row);
  }
}
