import { createElement } from '../utils/dom.ts';
import { ResourceBar } from './resourceBar.ts';
import { AmmoDisplay } from './ammoDisplay.ts';
import { GameLog } from './gameLog.ts';
import type { World } from '../engine/world.ts';
import type { ThrownWeaponType } from '../types/throwing.ts';
import { CHAKRA_SPRINT_COST, WATER_WALK_CHAKRA_COST } from '../core/constants.ts';
import { getChakraSprintSpeed, getChakraSprintTier, hasTechnique } from '../data/techniques.ts';

export class GameHud {
  readonly element: HTMLElement;

  private hpBar: ResourceBar;
  private chakraBar: ResourceBar;
  private willpowerBar: ResourceBar;
  private staminaBar: ResourceBar;
  private bloodBar: ResourceBar;
  private stanceValue: HTMLElement;
  private stanceTicks: HTMLElement;
  private stanceEl: HTMLElement | null = null;
  private ammoDisplay: AmmoDisplay;
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
    this.bloodBar = new ResourceBar({ label: 'BLD', type: 'blood' });
    this.bloodBar.element.style.display = 'none'; // hidden when at 100%

    resources.appendChild(this.hpBar.element);
    resources.appendChild(this.chakraBar.element);
    resources.appendChild(this.willpowerBar.element);
    resources.appendChild(this.staminaBar.element);
    resources.appendChild(this.bloodBar.element);

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

    // ── Ammo Display ──
    this.ammoDisplay = new AmmoDisplay();
    this.element.appendChild(this.ammoDisplay.element);

    // ── Game Log ──
    this.gameLog = new GameLog();
    this.element.appendChild(this.gameLog.element);

  }

  /** Update all HUD elements from world state */
  update(world: World, throwingMode = false, selectedWeapon: ThrownWeaponType = 'kunai'): void {
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
      this.bloodBar.update(resources.blood, resources.maxBlood);
      // Only show blood bar when not at full
      this.bloodBar.element.style.display = resources.blood < resources.maxBlood ? 'flex' : 'none';
    }

    if (playerCtrl) {
      const stanceNames: Record<string, string> = {
        sprint: 'Sprint',
        walk: 'Walk',
        creep: 'Creep',
        crawl: 'Crawl',
        chakra_sprint: 'Chakra Sprint',
      };

      const isCarrying = world.carrying.has(playerId);
      const carryLabel = isCarrying ? ' [Carrying]' : '';

      // Check if swimming (on water without water walk)
      const playerPos = world.positions.get(playerId);
      const onWater = playerPos ? world.tileMap.isWater(playerPos.x, playerPos.y) : false;
      const playerSheet = world.characterSheets.get(playerId);
      const playerNin = playerSheet?.skills.ninjutsu ?? 0;
      const playerRes = world.resources.get(playerId);
      const canWaterWalk = onWater && hasTechnique(playerNin, 'water_walk') && (playerRes ? playerRes.chakra >= WATER_WALK_CHAKRA_COST : false);
      const isSwimming = onWater && !canWaterWalk;

      if (isSwimming) {
        this.stanceValue.textContent = 'Swim';
        const displaySecs = isCarrying ? 48 : 24;
        this.stanceTicks.textContent = `${displaySecs}s/step${carryLabel}`;
      } else {
        this.stanceValue.textContent = stanceNames[playerCtrl.movementStance] ?? playerCtrl.movementStance;

        // Show seconds per step for all stances
        const STANCE_SECONDS: Record<string, number> = {
          sprint: 3, walk: 6, creep: 9, crawl: 12, chakra_sprint: 2,
        };

        if (playerCtrl.movementStance === 'chakra_sprint') {
          const nin = world.characterSheets.get(playerId)?.skills.ninjutsu ?? 10;
          const speed = getChakraSprintSpeed(nin);
          const tier = getChakraSprintTier(nin);
          this.stanceTicks.textContent = `${tier} · ${speed}s/step · ${CHAKRA_SPRINT_COST} ckr+sta${carryLabel}`;
        } else {
          const secs = STANCE_SECONDS[playerCtrl.movementStance] ?? 6;
          const displaySecs = isCarrying ? secs * 2 : secs;
          this.stanceTicks.textContent = `${displaySecs}s/step${carryLabel}`;
        }
      }
    }

    // Ammo display — compute cooldown progress (0=just thrown, 1=ready)
    const ammo = world.thrownAmmo.get(playerId);
    let cooldownProgress = 1;
    const cd = world.throwCooldowns.get(playerId);
    if (cd && cd.totalTicks > 0 && world.currentTick < cd.readyAtTick) {
      const remaining = cd.readyAtTick - world.currentTick;
      cooldownProgress = Math.max(0, 1 - remaining / cd.totalTicks);
    }
    this.ammoDisplay.update(ammo, selectedWeapon, throwingMode, cooldownProgress);

    this.gameLog.update(world.gameLog, world.gameTimeSeconds);
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
    this.gameLog.fullRender(world.gameLog, world.gameTimeSeconds);
    this.update(world);
  }
}
