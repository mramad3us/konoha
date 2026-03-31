import { resolveAction, GAME_KEYS, JUTSU_COMBAT_KEYS } from '../engine/actionResolver.ts';
import { tryCastJutsuByKey, getJutsuFailMessage } from '../engine/jutsuResolver.ts';
import { getJutsuByCombatKey } from '../data/jutsus.ts';
import { findAdjacentTarget as findTarget } from '../engine/combatSystem.ts';
import { executeTurn, advanceCombatPass, advanceThrowSubtick } from '../engine/turnSystem.ts';
import { processCombatMove, getPlayerTempo, getPlayerCondition, clearStaleEngagements } from '../engine/combatSystem.ts';
import { isCombatKey } from '../types/combat.ts';
import { isAttack } from '../types/combat.ts';
import type { World } from '../engine/world.ts';
import { toggleROE } from '../engine/squadSystem.ts';
import type { Camera } from '../rendering/camera.ts';
import type { GameHud } from '../ui/gameHud.ts';
import type { KeybindingsPanel } from '../ui/keybindingsPanel.ts';
import type { CharacterSheetUI } from '../ui/characterSheet.ts';
import type { MissionLogUI } from '../ui/missionLogUI.ts';
import type { TempoBeadsUI } from '../ui/tempoBeads.ts';
import type { ConditionIndicator } from '../ui/conditionIndicator.ts';
import { INPUT_DEBOUNCE_MS } from '../core/constants.ts';
import type { ThrownWeaponType } from '../types/throwing.ts';
import { spawnProjectile, canThrow, getThrowableTargets } from '../systems/projectileSystem.ts';
import { spawnFloatingText } from '../systems/floatingTextSystem.ts';
import type { EntityId } from '../types/ecs.ts';

export class InputSystem {
  private world: World;
  private camera: Camera;
  private hud: GameHud;
  private keybindingsPanel: KeybindingsPanel;
  private characterSheet: CharacterSheetUI;
  private missionLog: MissionLogUI;
  private tempoBeads: TempoBeadsUI;
  private conditionIndicator: ConditionIndicator;
  private handler: (e: KeyboardEvent) => void;
  private lastInputTime = 0;
  private onSleep: (() => void) | null = null;
  private onContextMenu: ((entityId: number) => void) | null = null;
  private onTargetSelect: ((candidates: number[]) => void) | null = null;
  private onEdgeExtraction: (() => void) | null = null;
  private onROEToggle: ((roe: import('../types/squad.ts').SquadROE) => void) | null = null;
  private _paused = false;

  // ── Throwing mode state ──
  private _throwingMode = false;
  private _throwWeapon: ThrownWeaponType = 'kunai';
  private _throwTargets: EntityId[] = [];
  private _throwTargetIndex = 0;

  constructor(
    world: World,
    camera: Camera,
    hud: GameHud,
    keybindingsPanel: KeybindingsPanel,
    characterSheet: CharacterSheetUI,
    missionLog: MissionLogUI,
    tempoBeads: TempoBeadsUI,
    conditionIndicator: ConditionIndicator,
  ) {
    this.world = world;
    this.camera = camera;
    this.hud = hud;
    this.keybindingsPanel = keybindingsPanel;
    this.characterSheet = characterSheet;
    this.missionLog = missionLog;
    this.tempoBeads = tempoBeads;
    this.conditionIndicator = conditionIndicator;

    this.handler = (e: KeyboardEvent) => this.handleKey(e);
    document.addEventListener('keydown', this.handler);
  }

  private handleKey(e: KeyboardEvent): void {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Ignore all game input when paused (overmap travel, cutscenes, etc.)
    if (this._paused) return;

    const key = e.key;

    // Prevent default for game keys, combat keys, and jutsu keys
    if (GAME_KEYS.has(key) || isCombatKey(key) || JUTSU_COMBAT_KEYS.has(key) || key === 't' || key === 'Tab') {
      e.preventDefault();
    }

    // Debounce
    const now = Date.now();
    if (now - this.lastInputTime < INPUT_DEBOUNCE_MS) return;
    this.lastInputTime = now;

    // ── Throwing mode input ──
    if (this._throwingMode) {
      this.handleThrowingInput(key);
      return;
    }

    // ── Enter throwing mode ('t') ──
    if (key === 't') {
      this.tryEnterThrowingMode();
      return;
    }

    // ── Jutsu combat keys (@ etc.) ──
    if (JUTSU_COMBAT_KEYS.has(key)) {
      const targetId = findTarget(this.world);
      const result = tryCastJutsuByKey(this.world, this.world.playerEntityId, key, targetId);

      if (result.success) {
        this.world.log(result.message, 'combat_tempo');
        // Advance world by one combat pass
        advanceCombatPass(this.world);
        // Update camera to follow teleport
        const pp = this.world.positions.get(this.world.playerEntityId);
        if (pp) this.camera.snapTo(pp.x, pp.y);
        clearStaleEngagements(this.world);
      } else {
        const jutsu = getJutsuByCombatKey(key);
        const failMsg = jutsu
          ? getJutsuFailMessage(jutsu.id, result.reason)
          : 'Nothing happens.';
        this.world.log(failMsg, 'info');
      }

      this.hud.update(this.world, this._throwingMode, this._throwWeapon);
      this.tempoBeads.update(getPlayerTempo(this.world));
      this.conditionIndicator.update(getPlayerCondition(this.world));
      return;
    }

    // ── Combat keys (a/z/e/q/s/d) ──
    if (isCombatKey(key)) {
      // Check stamina for attacks
      if (isAttack(key)) {
        const res = this.world.resources.get(this.world.playerEntityId);
        if (res && res.stamina <= 0) {
          this.world.log('Too exhausted to attack.', 'info');
          this.hud.update(this.world, this._throwingMode, this._throwWeapon);
          return;
        }
        // Consume stamina for attack attempt
        if (res) {
          res.stamina = Math.max(0, res.stamina - 1);
          res.staminaCeiling = Math.max(res.maxStamina * 0.3, res.staminaCeiling - 0.1);
          res.lastExertionTick = this.world.currentTick;
        }
      }

      const turnConsumed = processCombatMove(this.world, key);
      if (turnConsumed) {
        // Advance world by one combat pass — ticks NPC movement and NPC-vs-NPC fights
        advanceCombatPass(this.world);

        this.hud.update(this.world, this._throwingMode, this._throwWeapon);
        this.tempoBeads.update(getPlayerTempo(this.world));
        this.conditionIndicator.update(getPlayerCondition(this.world));

        // Clear engagements if entities moved apart during the tick
        clearStaleEngagements(this.world);
      }
      return;
    }

    const action = resolveAction(key);
    if (!action) return;

    // UI-only actions
    if (action.type === 'toggleKeybindings') {
      this.keybindingsPanel.toggle();
      return;
    }

    if (action.type === 'toggleCharacterSheet') {
      const playerId = this.world.playerEntityId;
      const name = this.world.names.get(playerId)?.display ?? 'Unknown';
      const sheet = this.world.characterSheets.get(playerId);
      if (sheet) {
        const missionRecord = {
          completed: this.world.missionLog.completed,
          totalCompleted: this.world.missionLog.totalCompleted,
        };
        this.characterSheet.toggle(name, sheet, missionRecord, this.world.squadRoster);
      }
      return;
    }

    if (action.type === 'toggleMissionLog') {
      const gameDay = Math.floor(this.world.gameTimeSeconds / 86400) + 1;
      this.missionLog.toggle(this.world.missionLog, gameDay);
      return;
    }

    if (action.type === 'toggleROE') {
      if (this.world.squadRoster.activeSquad && this.world.squadMembers.size > 0) {
        const newRoe = toggleROE(this.world.squadRoster);
        const roeLabel = newRoe === 'aggressive' ? 'AGGRESSIVE — squad engages on sight' : 'DEFENSIVE — squad holds formation';
        this.world.log(`Squad ROE: ${roeLabel}`, 'system');
        if (this.onROEToggle) this.onROEToggle(newRoe);
      } else {
        this.world.log('No squad deployed.', 'info');
      }
      return;
    }

    // Game logic actions
    const turnConsumed = executeTurn(action, this.world);

    if (turnConsumed) {
      // Update camera target
      const playerPos = this.world.positions.get(this.world.playerEntityId);
      if (playerPos) {
        this.camera.setTarget(playerPos.x, playerPos.y);
      }

      // Clear engagements if player moved away
      clearStaleEngagements(this.world);
    }

    // Update HUD + tempo + condition
    this.hud.update(this.world, this._throwingMode, this._throwWeapon);
    this.tempoBeads.update(getPlayerTempo(this.world));
    this.conditionIndicator.update(getPlayerCondition(this.world));

    // Check for pending interaction
    if (this.world._pendingInteraction) {
      const interaction = this.world._pendingInteraction;
      this.world._pendingInteraction = null;

      if (interaction.type === 'sleep' && this.onSleep) {
        this.onSleep();
      } else if (interaction.type === 'target_select' && this.onTargetSelect && interaction.candidates) {
        this.onTargetSelect(interaction.candidates);
      } else if (interaction.type === 'context_menu' && this.onContextMenu) {
        this.onContextMenu(interaction.entityId);
      } else if (interaction.type === 'edge_extraction' && this.onEdgeExtraction) {
        this.onEdgeExtraction();
      }
    }
  }

  /** Update world reference (for save loads) */
  setWorld(world: World): void {
    this.world = world;
  }

  /** Set callback for sleep interaction */
  setSleepCallback(cb: () => void): void {
    this.onSleep = cb;
  }

  /** Set callback for universal context menu */
  setContextMenuCallback(cb: (entityId: number) => void): void {
    this.onContextMenu = cb;
  }

  /** Set callback for target selection (multiple interactables nearby) */
  setTargetSelectCallback(cb: (candidates: number[]) => void): void {
    this.onTargetSelect = cb;
  }

  /** Set callback for edge extraction (mission map boundary) */
  setEdgeExtractionCallback(cb: () => void): void {
    this.onEdgeExtraction = cb;
  }

  /** Set callback for ROE toggle (updates UI indicator) */
  setROEToggleCallback(cb: (roe: import('../types/squad.ts').SquadROE) => void): void {
    this.onROEToggle = cb;
  }

  /** Swap the world reference (for away mission transitions) */
  swapWorld(newWorld: World): void {
    this.world = newWorld;
  }

  /** Pause/unpause all game input (for overmap travel, cutscenes, etc.) */
  setPaused(paused: boolean): void {
    this._paused = paused;
  }

  // ── Throwing Mode ──

  /** Attempt to enter throwing mode */
  private tryEnterThrowingMode(): void {
    const playerId = this.world.playerEntityId;

    // Must have ammo
    const ammo = this.world.thrownAmmo.get(playerId);
    if (!ammo || (ammo.kunai <= 0 && ammo.shuriken <= 0)) {
      spawnFloatingText(
        this.world.positions.get(playerId)?.x ?? 0,
        this.world.positions.get(playerId)?.y ?? 0,
        'No ammo', '#ff8844',
      );
      return;
    }

    // Must have valid targets
    const targets = getThrowableTargets(this.world, playerId);
    if (targets.length === 0) {
      spawnFloatingText(
        this.world.positions.get(playerId)?.x ?? 0,
        this.world.positions.get(playerId)?.y ?? 0,
        'No targets', '#ff8844',
      );
      return;
    }

    // Keep last weapon choice if it still has ammo, otherwise switch
    if (ammo[this._throwWeapon] <= 0) {
      this._throwWeapon = this._throwWeapon === 'kunai' ? 'shuriken' : 'kunai';
    }
    this._throwTargets = targets;
    this._throwTargetIndex = 0;
    this._throwingMode = true;

    const targetName = this.world.names.get(targets[0])?.display ?? 'target';
    this.world.log(`Throwing mode: ${this._throwWeapon} — aiming at ${targetName} [j/k: cycle, TAB: switch, Enter: throw, Esc: cancel]`, 'system');
    this.hud.update(this.world, this._throwingMode, this._throwWeapon);
  }

  /** Handle key input while in throwing mode */
  private handleThrowingInput(key: string): void {
    const playerId = this.world.playerEntityId;

    if (key === 'Escape') {
      this.exitThrowingMode();
      this.world.log('Throwing mode cancelled.', 'system');
      return;
    }

    if (key === 'Tab') {
      // Switch weapon type
      const ammo = this.world.thrownAmmo.get(playerId);
      if (!ammo) { this.exitThrowingMode(); return; }

      if (this._throwWeapon === 'kunai' && ammo.shuriken > 0) {
        this._throwWeapon = 'shuriken';
      } else if (this._throwWeapon === 'shuriken' && ammo.kunai > 0) {
        this._throwWeapon = 'kunai';
      }

      this.hud.update(this.world, this._throwingMode, this._throwWeapon);
      return;
    }

    if (key === 'j') {
      // Cycle to next target
      this._throwTargetIndex = (this._throwTargetIndex + 1) % this._throwTargets.length;
      const targetName = this.world.names.get(this._throwTargets[this._throwTargetIndex])?.display ?? 'target';
      this.world.log(`Aiming at: ${targetName}`, 'system');
      this.hud.update(this.world, this._throwingMode, this._throwWeapon);
      return;
    }

    if (key === 'k') {
      // Cycle to previous target
      this._throwTargetIndex = (this._throwTargetIndex - 1 + this._throwTargets.length) % this._throwTargets.length;
      const targetName = this.world.names.get(this._throwTargets[this._throwTargetIndex])?.display ?? 'target';
      this.world.log(`Aiming at: ${targetName}`, 'system');
      this.hud.update(this.world, this._throwingMode, this._throwWeapon);
      return;
    }

    if (key === 'Enter' || key === 'f') {
      // Throw!
      if (!canThrow(this.world, playerId, this._throwWeapon)) {
        const ammo = this.world.thrownAmmo.get(playerId);
        if (!ammo || ammo[this._throwWeapon] <= 0) {
          this.world.log('No ammo left!', 'info');
        } else {
          this.world.log('Not ready to throw yet — cooldown.', 'info');
        }
        return;
      }

      const targetId = this._throwTargets[this._throwTargetIndex];
      const targetPos = this.world.positions.get(targetId);
      if (!targetPos) {
        this.world.log('Target lost.', 'info');
        this.exitThrowingMode();
        return;
      }

      spawnProjectile(this.world, playerId, this._throwWeapon, targetPos.x, targetPos.y);

      // Advance time by 1 subtick (0.5s) — throwing is fast, cooldown handles pacing
      advanceThrowSubtick(this.world);

      // Exit throwing mode immediately — player can re-enter with 't' when ready
      this.exitThrowingMode();

      this.hud.update(this.world, this._throwingMode, this._throwWeapon);
      this.tempoBeads.update(getPlayerTempo(this.world));
      this.conditionIndicator.update(getPlayerCondition(this.world));
      clearStaleEngagements(this.world);
      return;
    }
  }

  private exitThrowingMode(): void {
    this._throwingMode = false;
    this._throwTargets = [];
    this._throwTargetIndex = 0;
    this.hud.update(this.world, this._throwingMode, this._throwWeapon);
  }

  /** Whether the player is currently in throwing mode (for rendering target highlights) */
  get throwingMode(): boolean { return this._throwingMode; }
  get throwTargets(): EntityId[] { return this._throwTargets; }
  get throwTargetIndex(): number { return this._throwTargetIndex; }
  get throwWeapon(): ThrownWeaponType { return this._throwWeapon; }

  /** Remove event listener */
  dispose(): void {
    document.removeEventListener('keydown', this.handler);
  }
}
