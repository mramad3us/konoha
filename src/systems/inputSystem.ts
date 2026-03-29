import { resolveAction, GAME_KEYS, JUTSU_COMBAT_KEYS } from '../engine/actionResolver.ts';
import { tryCastJutsuByKey, getJutsuFailMessage } from '../engine/jutsuResolver.ts';
import { getJutsuByCombatKey } from '../data/jutsus.ts';
import { findAdjacentTarget as findTarget } from '../engine/combatSystem.ts';
import { executeTurn } from '../engine/turnSystem.ts';
import { processCombatMove, getPlayerTempo, getPlayerCondition, clearStaleEngagements } from '../engine/combatSystem.ts';
import { isCombatKey } from '../types/combat.ts';
import { isAttack } from '../types/combat.ts';
import type { World } from '../engine/world.ts';
import type { Camera } from '../rendering/camera.ts';
import type { GameHud } from '../ui/gameHud.ts';
import type { KeybindingsPanel } from '../ui/keybindingsPanel.ts';
import type { CharacterSheetUI } from '../ui/characterSheet.ts';
import type { TempoBeadsUI } from '../ui/tempoBeads.ts';
import type { ConditionIndicator } from '../ui/conditionIndicator.ts';
import { INPUT_DEBOUNCE_MS } from '../core/constants.ts';

export class InputSystem {
  private world: World;
  private camera: Camera;
  private hud: GameHud;
  private keybindingsPanel: KeybindingsPanel;
  private characterSheet: CharacterSheetUI;
  private tempoBeads: TempoBeadsUI;
  private conditionIndicator: ConditionIndicator;
  private handler: (e: KeyboardEvent) => void;
  private lastInputTime = 0;
  private onSleep: (() => void) | null = null;
  private onContextMenu: ((entityId: number) => void) | null = null;
  private onTargetSelect: ((candidates: number[]) => void) | null = null;

  constructor(
    world: World,
    camera: Camera,
    hud: GameHud,
    keybindingsPanel: KeybindingsPanel,
    characterSheet: CharacterSheetUI,
    tempoBeads: TempoBeadsUI,
    conditionIndicator: ConditionIndicator,
  ) {
    this.world = world;
    this.camera = camera;
    this.hud = hud;
    this.keybindingsPanel = keybindingsPanel;
    this.characterSheet = characterSheet;
    this.tempoBeads = tempoBeads;
    this.conditionIndicator = conditionIndicator;

    this.handler = (e: KeyboardEvent) => this.handleKey(e);
    document.addEventListener('keydown', this.handler);
  }

  private handleKey(e: KeyboardEvent): void {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key;

    // Prevent default for game keys, combat keys, and jutsu keys
    if (GAME_KEYS.has(key) || isCombatKey(key) || JUTSU_COMBAT_KEYS.has(key)) {
      e.preventDefault();
    }

    // Debounce
    const now = Date.now();
    if (now - this.lastInputTime < INPUT_DEBOUNCE_MS) return;
    this.lastInputTime = now;

    // ── Jutsu combat keys (@ etc.) ──
    if (JUTSU_COMBAT_KEYS.has(key)) {
      const targetId = findTarget(this.world);
      const result = tryCastJutsuByKey(this.world, this.world.playerEntityId, key, targetId);

      if (result.success) {
        this.world.log(result.message, 'combat_tempo');
        // Update camera to follow teleport
        const pp = this.world.positions.get(this.world.playerEntityId);
        if (pp) this.camera.snapTo(pp.x, pp.y);
      } else {
        const jutsu = getJutsuByCombatKey(key);
        const failMsg = jutsu
          ? getJutsuFailMessage(jutsu.id, result.reason)
          : 'Nothing happens.';
        this.world.log(failMsg, 'info');
      }

      this.hud.update(this.world);
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
          this.hud.update(this.world);
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
        this.hud.update(this.world);
        this.tempoBeads.update(getPlayerTempo(this.world));
        this.conditionIndicator.update(getPlayerCondition(this.world));
        // Player state checked by combatSystem via entityState
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
        this.characterSheet.toggle(name, sheet, missionRecord);
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
    this.hud.update(this.world);
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

  /** Remove event listener */
  dispose(): void {
    document.removeEventListener('keydown', this.handler);
  }
}
