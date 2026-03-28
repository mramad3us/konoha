import { resolveAction, GAME_KEYS } from '../engine/actionResolver.ts';
import { executeTurn } from '../engine/turnSystem.ts';
import type { World } from '../engine/world.ts';
import type { Camera } from '../rendering/camera.ts';
import type { GameHud } from '../ui/gameHud.ts';
import type { KeybindingsPanel } from '../ui/keybindingsPanel.ts';
import { INPUT_DEBOUNCE_MS } from '../core/constants.ts';

export class InputSystem {
  private world: World;
  private camera: Camera;
  private hud: GameHud;
  private keybindingsPanel: KeybindingsPanel;
  private handler: (e: KeyboardEvent) => void;
  private lastInputTime = 0;

  constructor(
    world: World,
    camera: Camera,
    hud: GameHud,
    keybindingsPanel: KeybindingsPanel,
  ) {
    this.world = world;
    this.camera = camera;
    this.hud = hud;
    this.keybindingsPanel = keybindingsPanel;

    this.handler = (e: KeyboardEvent) => this.handleKey(e);
    document.addEventListener('keydown', this.handler);
  }

  private handleKey(e: KeyboardEvent): void {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key;

    // Prevent default for game keys
    if (GAME_KEYS.has(key)) {
      e.preventDefault();
    }

    // Debounce
    const now = Date.now();
    if (now - this.lastInputTime < INPUT_DEBOUNCE_MS) return;
    this.lastInputTime = now;

    const action = resolveAction(key);
    if (!action) return;

    // UI-only actions
    if (action.type === 'toggleKeybindings') {
      this.keybindingsPanel.toggle();
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
    }

    // Update HUD
    this.hud.update(this.world);
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
