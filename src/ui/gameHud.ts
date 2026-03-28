import { createElement } from '../utils/dom.ts';
import { ResourceBar } from './resourceBar.ts';
import { GameLog } from './gameLog.ts';
import type { World } from '../engine/world.ts';
import { STANCE_TICK_COST } from '../core/constants.ts';

export class GameHud {
  readonly element: HTMLElement;

  private hpBar: ResourceBar;
  private chakraBar: ResourceBar;
  private willpowerBar: ResourceBar;
  private staminaBar: ResourceBar;
  private stanceValue: HTMLElement;
  private stanceTicks: HTMLElement;
  private stanceEl: HTMLElement | null = null;
  private gameLog: GameLog;

  constructor() {
    this.element = createElement('div', { className: 'game-hud' });

    // ── Resources section ──
    const resources = createElement('div', { className: 'hud-resources' });
    resources.appendChild(
      createElement('div', { className: 'hud-resources__title', text: '// Status' })
    );

    this.hpBar = new ResourceBar({ label: 'HP', type: 'hp' });
    this.chakraBar = new ResourceBar({ label: 'CKR', type: 'chakra' });
    this.willpowerBar = new ResourceBar({ label: 'WIL', type: 'willpower' });
    this.staminaBar = new ResourceBar({ label: 'STA', type: 'stamina' });

    resources.appendChild(this.hpBar.element);
    resources.appendChild(this.chakraBar.element);
    resources.appendChild(this.willpowerBar.element);
    resources.appendChild(this.staminaBar.element);

    this.element.appendChild(resources);

    // ── Stance indicator ──
    const stance = createElement('div', { className: 'hud-stance' });
    stance.appendChild(
      createElement('span', { className: 'hud-stance__label', text: 'Stance:' })
    );
    this.stanceValue = createElement('span', { className: 'hud-stance__value', text: 'Walk' });
    stance.appendChild(this.stanceValue);
    this.stanceTicks = createElement('span', { className: 'hud-stance__ticks', text: '2 ticks/move' });
    stance.appendChild(this.stanceTicks);
    this.stanceEl = stance;
    this.element.appendChild(stance);

    // ── Game Log ──
    this.gameLog = new GameLog();
    this.element.appendChild(this.gameLog.element);

  }

  /** Update all HUD elements from world state */
  update(world: World): void {
    const playerId = world.playerEntityId;
    const health = world.healths.get(playerId);
    const resources = world.resources.get(playerId);
    const playerCtrl = world.playerControlled.get(playerId);

    if (health) {
      this.hpBar.update(health.current, health.max);
    }

    if (resources) {
      this.chakraBar.update(resources.chakra, resources.maxChakra);
      this.willpowerBar.update(resources.willpower, resources.maxWillpower);
      this.staminaBar.update(resources.stamina, resources.maxStamina);
    }

    if (playerCtrl) {
      const stanceNames = {
        sprint: 'Sprint',
        walk: 'Walk',
        creep: 'Creep',
        crawl: 'Crawl',
      };
      this.stanceValue.textContent = stanceNames[playerCtrl.movementStance];
      this.stanceTicks.textContent = `${STANCE_TICK_COST[playerCtrl.movementStance]} ticks/move`;
    }

    this.gameLog.update(world.gameLog);
  }

  /** Insert an element after the stance indicator (for tempo beads etc.) */
  insertAfterStance(el: HTMLElement): void {
    if (this.stanceEl && this.stanceEl.nextSibling) {
      this.element.insertBefore(el, this.stanceEl.nextSibling);
    } else {
      this.element.appendChild(el);
    }
  }

  /** Full re-render (for save loads) */
  fullRender(world: World): void {
    this.gameLog.fullRender(world.gameLog);
    this.update(world);
  }
}
