import { createElement } from '../utils/dom.ts';
import { KUNAI_SVG } from '../assets/sprites/pixelArt.ts';
import { spriteCache } from '../rendering/spriteCache.ts';
import { SPRITE_MANIFEST } from '../sprites/manifest.ts';
import { Camera } from '../rendering/camera.ts';
import { IsoRenderer } from '../rendering/isoRenderer.ts';
import { GameHud } from '../ui/gameHud.ts';
import { KeybindingsPanel } from '../ui/keybindingsPanel.ts';
import { InputSystem } from '../systems/inputSystem.ts';
import { CharacterSheetUI } from '../ui/characterSheet.ts';
import { TempoBeadsUI } from '../ui/tempoBeads.ts';
import { screenManager } from '../systems/screenManager.ts';
import { saveSystem } from '../systems/saveSystem.ts';
import { computeFOV } from '../engine/fov.ts';
import { generateTrainingGrounds } from '../map/mapGenerator.ts';
import { World } from '../engine/world.ts';
import { activeSaveId } from '../engine/session.ts';
import { FOV_RADIUS, AUTO_SAVE_INTERVAL_TURNS } from '../core/constants.ts';

export async function renderGame(container: HTMLElement): Promise<void> {
  // ── Loading overlay ──
  const loading = createElement('div', { className: 'game-loading' });
  const spinner = createElement('div', { className: 'game-loading__spinner kunai-spin' });
  spinner.innerHTML = KUNAI_SVG;
  loading.appendChild(spinner);
  loading.appendChild(createElement('div', { className: 'game-loading__text', text: 'Loading...' }));
  container.appendChild(loading);

  // ── Preload sprites ──
  await spriteCache.preload(SPRITE_MANIFEST);

  // ── Load or create world ──
  let world: World;
  let saveId = activeSaveId;

  if (saveId) {
    const save = await saveSystem.load(saveId);
    if (save && save.data && Object.keys(save.data).length > 0) {
      // Load existing world
      world = World.deserialize(save.data as Record<string, unknown>);
    } else if (save) {
      // Fresh save from new game — generate world
      world = generateTrainingGrounds(save.playerName, save.playerGender);
    } else {
      // Fallback
      world = generateTrainingGrounds('Shinobi', 'shinobi');
    }
  } else {
    // No save ID — shouldn't happen, but handle gracefully
    world = generateTrainingGrounds('Shinobi', 'shinobi');
  }

  // ── Compute initial FOV ──
  const playerPos = world.positions.get(world.playerEntityId);
  if (playerPos) {
    computeFOV(world, playerPos.x, playerPos.y, FOV_RADIUS);
  }

  // ── Build layout ──
  const layout = createElement('div', { className: 'game-layout' });

  // ── Top bar ──
  const topbar = createElement('div', { className: 'game-topbar' });

  const topbarLeft = createElement('div', { className: 'game-topbar__left' });
  const zoneLabel = createElement('span', { className: 'game-topbar__zone', text: 'Training Grounds' });
  const tickLabel = createElement('span', { className: 'game-topbar__tick', text: `T:${world.currentTick}` });
  const saveFlash = createElement('span', { className: 'game-topbar__save-flash', text: 'Saved' });
  topbarLeft.appendChild(zoneLabel);
  topbarLeft.appendChild(tickLabel);
  topbarLeft.appendChild(saveFlash);
  topbar.appendChild(topbarLeft);

  const topbarRight = createElement('div', { className: 'game-topbar__right' });

  const settingsBtn = createElement('button', { className: 'game-topbar__btn', text: 'Settings' });
  settingsBtn.addEventListener('click', () => screenManager.navigateTo('settings'));

  const saveBtn = createElement('button', { className: 'game-topbar__btn', text: 'Save' });
  saveBtn.addEventListener('click', async () => {
    if (saveId) {
      const save = await saveSystem.load(saveId);
      if (save) {
        save.data = world.serialize();
        await saveSystem.save(save);
        saveFlash.classList.add('game-topbar__save-flash--visible');
        setTimeout(() => saveFlash.classList.remove('game-topbar__save-flash--visible'), 1500);
      }
    }
  });

  const exitBtn = createElement('button', { className: 'game-topbar__btn game-topbar__btn--exit', text: 'Exit' });
  exitBtn.addEventListener('click', () => screenManager.navigateTo('landing'));

  topbarRight.appendChild(settingsBtn);
  topbarRight.appendChild(createElement('div', { className: 'game-topbar__sep' }));
  topbarRight.appendChild(saveBtn);
  topbarRight.appendChild(createElement('div', { className: 'game-topbar__sep' }));
  topbarRight.appendChild(exitBtn);
  topbar.appendChild(topbarRight);

  layout.appendChild(topbar);

  // ── Game body (canvas + HUD) ──
  const gameBody = createElement('div', { className: 'game-body' });

  // Canvas container
  const canvasContainer = createElement('div', { className: 'game-canvas-container' });
  const canvas = createElement('canvas', {});
  canvasContainer.appendChild(canvas);
  gameBody.appendChild(canvasContainer);

  // HUD
  const hud = new GameHud();
  gameBody.appendChild(hud.element);

  layout.appendChild(gameBody);
  container.appendChild(layout);

  // Keybindings panel (inside canvas container for positioning)
  const keybindingsPanel = new KeybindingsPanel();
  canvasContainer.appendChild(keybindingsPanel.element);

  // Update tick label on each HUD update
  const origFullRender = hud.fullRender.bind(hud);
  hud.fullRender = (w: World) => {
    origFullRender(w);
    tickLabel.textContent = `T:${w.currentTick}`;
  };

  // ── Initialize rendering ──
  const camera = new Camera();

  // Size canvas
  const resizeCanvas = () => {
    const rect = canvasContainer.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
  };

  const renderer = new IsoRenderer(canvas, camera);

  // Snap camera to player
  if (playerPos) {
    camera.snapTo(playerPos.x, playerPos.y);
  }

  // Initial resize
  requestAnimationFrame(() => {
    resizeCanvas();

    // Initial HUD render
    hud.fullRender(world);

    // Fade out loading
    loading.classList.add('game-loading--fade');
    setTimeout(() => loading.remove(), 500);
  });

  // ── Input System ──
  // Character sheet overlay
  const characterSheet = new CharacterSheetUI();
  container.appendChild(characterSheet.element);

  // Tempo beads (in the HUD, after stance indicator)
  const tempoBeads = new TempoBeadsUI();
  hud.insertAfterStance(tempoBeads.element);

  const inputSystem = new InputSystem(world, camera, hud, keybindingsPanel, characterSheet, tempoBeads);

  // ── Render Loop ──
  let rafId = 0;
  let lastTime = performance.now();
  let lastSaveTick = world.currentTick;

  const renderLoop = (time: number) => {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    camera.update(dt);
    renderer.draw(world);

    rafId = requestAnimationFrame(renderLoop);
  };

  rafId = requestAnimationFrame(renderLoop);

  // ── Resize observer ──
  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(canvasContainer);

  // ── Auto-save check (runs on HUD updates via interval) ──
  const autoSaveInterval = setInterval(async () => {
    if (saveId && world.currentTick - lastSaveTick >= AUTO_SAVE_INTERVAL_TURNS) {
      lastSaveTick = world.currentTick;
      const save = await saveSystem.load(saveId!);
      if (save) {
        save.data = world.serialize();
        save.playtime += AUTO_SAVE_INTERVAL_TURNS;
        await saveSystem.save(save);
      }
    }
  }, 5000);

  // ── Cleanup on screen transition ──
  const unsubscribe = screenManager.onTransition(async (transition) => {
    if (transition.from === 'game') {
      cancelAnimationFrame(rafId);
      inputSystem.dispose();
      resizeObserver.disconnect();
      clearInterval(autoSaveInterval);

      // Save on exit
      if (saveId) {
        const save = await saveSystem.load(saveId!);
        if (save) {
          save.data = world.serialize();
          await saveSystem.save(save);
        }
      }

      unsubscribe();
    }
  });
}
