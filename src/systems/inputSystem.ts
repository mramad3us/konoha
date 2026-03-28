import { resolveAction, GAME_KEYS } from '../engine/actionResolver.ts';
import { executeTurn } from '../engine/turnSystem.ts';
import { processCombatMove, getPlayerTempo, clearStaleEngagements } from '../engine/combatSystem.ts';
import { isCombatKey } from '../types/combat.ts';
import type { World } from '../engine/world.ts';
import type { Camera } from '../rendering/camera.ts';
import type { GameHud } from '../ui/gameHud.ts';
import type { KeybindingsPanel } from '../ui/keybindingsPanel.ts';
import type { CharacterSheetUI } from '../ui/characterSheet.ts';
import type { TempoBeadsUI } from '../ui/tempoBeads.ts';
import { INPUT_DEBOUNCE_MS } from '../core/constants.ts';

export class InputSystem {
  private world: World;
  private camera: Camera;
  private hud: GameHud;
  private keybindingsPanel: KeybindingsPanel;
  private characterSheet: CharacterSheetUI;
  private tempoBeads: TempoBeadsUI;
  private handler: (e: KeyboardEvent) => void;
  private lastInputTime = 0;

  constructor(
    world: World,
    camera: Camera,
    hud: GameHud,
    keybindingsPanel: KeybindingsPanel,
    characterSheet: CharacterSheetUI,
    tempoBeads: TempoBeadsUI,
  ) {
    this.world = world;
    this.camera = camera;
    this.hud = hud;
    this.keybindingsPanel = keybindingsPanel;
    this.characterSheet = characterSheet;
    this.tempoBeads = tempoBeads;

    this.handler = (e: KeyboardEvent) => this.handleKey(e);
    document.addEventListener('keydown', this.handler);
  }

  private handleKey(e: KeyboardEvent): void {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key;

    // Prevent default for game keys and combat keys
    if (GAME_KEYS.has(key) || isCombatKey(key)) {
      e.preventDefault();
    }

    // Debounce
    const now = Date.now();
    if (now - this.lastInputTime < INPUT_DEBOUNCE_MS) return;
    this.lastInputTime = now;

    // ── Combat keys (a/z/e/q/s/d) ──
    if (isCombatKey(key)) {
      const turnConsumed = processCombatMove(this.world, key);
      if (turnConsumed) {
        this.hud.update(this.world);
        this.tempoBeads.update(getPlayerTempo(this.world));
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
        this.characterSheet.toggle(name, sheet);
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

    // Update HUD + tempo
    this.hud.update(this.world);
    this.tempoBeads.update(getPlayerTempo(this.world));
  }

  /** Update world reference (for save loads) */
  setWorld(world: World): void {
    this.world = world;
  }

  /** Remove event listener */
  dispose(): void {
    document.removeEventListener('keydown', this.handler);
  }
}
