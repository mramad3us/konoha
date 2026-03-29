/**
 * Mission Board UI — pixel art billboard modal.
 *
 * Shows available missions pinned to a board, with a detail panel.
 * Keyboard (↑↓/ENTER/ESC) and mouse navigation.
 */

import { createElement } from '../utils/dom.ts';
import { sfxMenuClick } from '../systems/audioSystem.ts';
import type { Mission, MissionBoard, MissionLog, MissionRank } from '../engine/missions.ts';
import { canTakeMission, RANK_LABELS, getGameDay } from '../engine/missions.ts';
import type { ShinobiRank } from '../types/character.ts';

export class MissionBoardUI {
  private backdrop: HTMLElement;
  private panel: HTMLElement;
  private listEl: HTMLElement;
  private detailEl: HTMLElement;
  private footerEl: HTMLElement;
  private acceptBtn: HTMLButtonElement;
  private dayLabel: HTMLElement;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private resolvePromise: ((missionId: string | null) => void) | null = null;
  private selectedIndex = 0;
  private missions: Mission[] = [];
  private playerRank: ShinobiRank = 'genin';
  private completedLog: Record<MissionRank, number> = { D: 0, C: 0, B: 0, A: 0 };
  private hasActiveMission = false;

  constructor() {
    // Backdrop
    this.backdrop = createElement('div', { className: 'mission-board-backdrop' });
    this.backdrop.addEventListener('click', () => this.close(null));

    // Main panel
    this.panel = createElement('div', { className: 'mission-board' });

    // Header
    const header = createElement('div', { className: 'mission-board__header' });
    const titleWrap = createElement('div');
    const title = createElement('div', { className: 'mission-board__title', text: 'Mission Board' });
    this.dayLabel = createElement('div', { className: 'mission-board__day' });
    titleWrap.appendChild(title);
    titleWrap.appendChild(this.dayLabel);
    header.appendChild(titleWrap);

    const closeBtn = createElement('button', { className: 'mission-board__close', text: '\u00d7' });
    closeBtn.addEventListener('click', () => this.close(null));
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // Body: list + detail
    const body = createElement('div', { className: 'mission-board__body' });

    this.listEl = createElement('div', { className: 'mission-board__list' });
    body.appendChild(this.listEl);

    this.detailEl = createElement('div', { className: 'mission-board__detail' });
    body.appendChild(this.detailEl);

    this.panel.appendChild(body);

    // Footer
    this.footerEl = createElement('div', { className: 'mission-board__footer' });

    this.acceptBtn = createElement('button', {
      className: 'mission-board__accept-btn',
      text: 'Accept Mission',
    }) as HTMLButtonElement;
    this.acceptBtn.disabled = true;
    this.acceptBtn.addEventListener('click', () => this.acceptSelected());
    this.footerEl.appendChild(this.acceptBtn);

    const hint = createElement('div', {
      className: 'mission-board__hint',
      text: 'ESC close \u00b7 \u2191\u2193 select \u00b7 ENTER accept',
    });
    this.footerEl.appendChild(hint);

    this.panel.appendChild(this.footerEl);
  }

  /**
   * Show the mission board. Returns the selected mission ID or null if cancelled.
   */
  show(
    board: MissionBoard,
    log: MissionLog,
    playerRank: ShinobiRank,
    gameTimeSeconds: number,
  ): Promise<string | null> {
    this.missions = board.missions;
    this.playerRank = playerRank;
    this.completedLog = log.completed;
    this.hasActiveMission = log.active !== null;
    this.selectedIndex = 0;

    // Find first selectable mission
    for (let i = 0; i < this.missions.length; i++) {
      const { allowed } = canTakeMission(this.missions[i].rank, playerRank, log.completed);
      if (allowed) {
        this.selectedIndex = i;
        break;
      }
    }

    const day = getGameDay(gameTimeSeconds);
    this.dayLabel.textContent = `Day ${day}`;

    this.renderList(day);
    this.renderDetail(day);

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.panel);

    requestAnimationFrame(() => {
      this.backdrop.classList.add('mission-board-backdrop--visible');
      this.panel.classList.add('mission-board--visible');
    });

    // Keyboard
    this.keyHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        this.close(null);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        this.moveSelection(-1);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        this.moveSelection(1);
      } else if (e.key === 'Enter') {
        this.acceptSelected();
      }
    };
    document.addEventListener('keydown', this.keyHandler, true);

    return new Promise(resolve => {
      this.resolvePromise = resolve;
    });
  }

  private moveSelection(dir: number): void {
    const len = this.missions.length;
    if (len === 0) return;
    this.selectedIndex = (this.selectedIndex + dir + len) % len;
    const day = parseInt(this.dayLabel.textContent?.replace('Day ', '') ?? '1');
    this.renderList(day);
    this.renderDetail(day);
  }

  private acceptSelected(): void {
    if (this.hasActiveMission) return;
    const mission = this.missions[this.selectedIndex];
    if (!mission) return;
    const { allowed } = canTakeMission(mission.rank, this.playerRank, this.completedLog);
    if (!allowed) return;
    sfxMenuClick();
    this.close(mission.id);
  }

  private renderList(currentDay: number): void {
    this.listEl.innerHTML = '';

    for (let i = 0; i < this.missions.length; i++) {
      const m = this.missions[i];
      const { allowed } = canTakeMission(m.rank, this.playerRank, this.completedLog);

      const item = createElement('div', {
        className: `mission-board__item${i === this.selectedIndex ? ' mission-board__item--selected' : ''}${!allowed ? ' mission-board__item--locked' : ''}`,
      });

      // Rank badge
      const rank = createElement('span', {
        className: `mission-board__rank mission-board__rank--${m.rank}`,
        text: m.rank,
      });
      item.appendChild(rank);

      // Title
      const title = createElement('span', {
        className: 'mission-board__item-title',
        text: m.title,
      });
      item.appendChild(title);

      // Expiry
      const daysLeft = (m.postedDay + m.durationDays) - currentDay;
      const expiry = createElement('span', {
        className: `mission-board__expiry${daysLeft <= 1 ? ' mission-board__expiry--urgent' : ''}`,
        text: `${daysLeft}d`,
      });
      item.appendChild(expiry);

      // Lock icon
      if (!allowed) {
        const lock = createElement('span', { className: 'mission-board__lock', text: '\u2716' });
        item.appendChild(lock);
      }

      item.addEventListener('click', () => {
        this.selectedIndex = i;
        this.renderList(currentDay);
        this.renderDetail(currentDay);
      });

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.renderList(currentDay);
        this.renderDetail(currentDay);
      });

      this.listEl.appendChild(item);
    }
  }

  private renderDetail(currentDay: number): void {
    this.detailEl.innerHTML = '';

    if (this.missions.length === 0) {
      const empty = createElement('div', {
        className: 'mission-board__empty',
        text: 'No missions available',
      });
      this.detailEl.appendChild(empty);
      this.acceptBtn.disabled = true;
      return;
    }

    const m = this.missions[this.selectedIndex];
    if (!m) return;

    const { allowed, reason } = canTakeMission(m.rank, this.playerRank, this.completedLog);

    // Active mission banner
    if (this.hasActiveMission) {
      const banner = createElement('div', {
        className: 'mission-board__active-banner',
        text: '\u25c6 You already have an active mission \u25c6',
      });
      this.detailEl.appendChild(banner);
    }

    // Header: rank badge + title + client
    const header = createElement('div', { className: 'mission-board__detail-header' });

    const rankBadge = createElement('div', {
      className: `mission-board__detail-rank mission-board__detail-rank--${m.rank}`,
      text: m.rank,
    });
    header.appendChild(rankBadge);

    const headerText = createElement('div');
    const titleEl = createElement('div', {
      className: 'mission-board__detail-title',
      text: m.title,
    });
    headerText.appendChild(titleEl);

    const clientEl = createElement('div', {
      className: 'mission-board__detail-client',
      text: `Client: ${m.client}`,
    });
    headerText.appendChild(clientEl);

    const rankLabel = createElement('div', {
      className: 'mission-board__detail-client',
      text: RANK_LABELS[m.rank],
    });
    headerText.appendChild(rankLabel);

    header.appendChild(headerText);
    this.detailEl.appendChild(header);

    // Description
    const descSection = createElement('div', { className: 'mission-board__section' });
    descSection.appendChild(createElement('div', { className: 'mission-board__section-label', text: 'Briefing' }));
    descSection.appendChild(createElement('div', { className: 'mission-board__section-text', text: m.description }));
    this.detailEl.appendChild(descSection);

    // Objective
    const objSection = createElement('div', { className: 'mission-board__section' });
    objSection.appendChild(createElement('div', { className: 'mission-board__section-label', text: 'Objective' }));
    objSection.appendChild(createElement('div', { className: 'mission-board__section-text', text: m.objective }));
    this.detailEl.appendChild(objSection);

    // Specifics (from template data — show only player-facing info)
    if (m.templateData) {
      const details: string[] = [];
      if (m.templateData.hint) details.push(`Hint: ${m.templateData.hint}`);
      if (m.templateData.targetLocation) details.push(`Location: ${m.templateData.targetLocation}`);
      if (m.templateData.searchArea) details.push(`Search area: ${m.templateData.searchArea}`);
      if (m.templateData.routeName) details.push(`Route: ${m.templateData.routeName}`);
      if (m.templateData.notImplemented) details.push('This mission type is not yet available.');

      if (details.length > 0) {
        const specSection = createElement('div', { className: 'mission-board__section' });
        specSection.appendChild(createElement('div', { className: 'mission-board__section-label', text: 'Details' }));
        const specEl = createElement('div', { className: 'mission-board__section-text mission-board__section-text--small' });
        specEl.style.whiteSpace = 'pre-line';
        specEl.textContent = details.join('\n');
        specSection.appendChild(specEl);
        this.detailEl.appendChild(specSection);
      }
    }

    // Mission info (expiry + track record note)
    const infoSection = createElement('div', { className: 'mission-board__section' });
    infoSection.appendChild(createElement('div', { className: 'mission-board__section-label', text: 'Info' }));
    const infoRow = createElement('div', { className: 'mission-board__rewards' });

    // Expiry
    const daysLeft = (m.postedDay + m.durationDays) - currentDay;
    const expiryInfo = createElement('div', { className: 'mission-board__reward' });
    expiryInfo.appendChild(createElement('span', { className: 'mission-board__reward-label', text: 'Expires in:' }));
    const daysEl = createElement('span', { className: 'mission-board__reward-value' });
    daysEl.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
    if (daysLeft <= 1) daysEl.style.color = 'var(--color-blood)';
    expiryInfo.appendChild(daysEl);
    infoRow.appendChild(expiryInfo);

    // Track record note
    const recordInfo = createElement('div', { className: 'mission-board__reward' });
    recordInfo.appendChild(createElement('span', { className: 'mission-board__reward-label', text: 'Reward:' }));
    recordInfo.appendChild(createElement('span', { className: 'mission-board__reward-value', text: 'Track record' }));
    infoRow.appendChild(recordInfo);

    infoSection.appendChild(infoRow);
    this.detailEl.appendChild(infoSection);

    // Locked reason
    if (!allowed && reason) {
      const lockEl = createElement('div', { className: 'mission-board__locked-reason', text: reason });
      this.detailEl.appendChild(lockEl);
    }

    // XP bonus note
    const noteSection = createElement('div', { className: 'mission-board__section' });
    noteSection.appendChild(createElement('div', { className: 'mission-board__section-label', text: 'Note' }));
    noteSection.appendChild(createElement('div', {
      className: 'mission-board__section-text mission-board__section-text--small',
      text: 'All skill training grants 2\u00d7 XP while on an active mission.',
    }));
    this.detailEl.appendChild(noteSection);

    // Accept button state
    this.acceptBtn.disabled = !allowed || this.hasActiveMission;
    this.acceptBtn.textContent = this.hasActiveMission
      ? 'Mission in Progress'
      : allowed ? 'Accept Mission' : 'Locked';
  }

  private close(result: string | null): void {
    this.backdrop.classList.remove('mission-board-backdrop--visible');
    this.panel.classList.remove('mission-board--visible');

    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }

    setTimeout(() => {
      this.backdrop.remove();
      this.panel.remove();
      if (this.resolvePromise) {
        this.resolvePromise(result);
        this.resolvePromise = null;
      }
    }, 150);
  }
}
