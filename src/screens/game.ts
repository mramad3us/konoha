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
import { ConditionIndicator } from '../ui/conditionIndicator.ts';
import { setScreenShakeCallback } from '../engine/combatSystem.ts';
import { setPlayerRespawnCallback, killEntity, reviveEntity } from '../engine/entityState.ts';
import { buildContextOptions, getExamineText, TRAINING_GROUNDS_FLAGS } from '../engine/interactionBuilder.ts';
import { ContextMenu } from '../ui/contextMenu.ts';
import { updateParticles } from '../systems/particleSystem.ts';
import { executeRespawn, TRAINING_GROUNDS_RESPAWN, RESPAWN_FADE_MS } from '../engine/respawn.ts';
import { screenManager } from '../systems/screenManager.ts';
import { saveSystem } from '../systems/saveSystem.ts';
import { computeFOV } from '../engine/fov.ts';
import { generateTrainingGrounds } from '../map/mapGenerator.ts';
import { World } from '../engine/world.ts';
import { activeSaveId } from '../engine/session.ts';
import { FOV_RADIUS, AUTO_SAVE_INTERVAL_TURNS } from '../core/constants.ts';
import { formatGameTime, getNightFovReduction } from '../engine/gameTime.ts';

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
  const settings = await saveSystem.loadSettings();
  const devMode = settings.devMode;

  if (saveId) {
    const save = await saveSystem.load(saveId);
    if (save && save.data && Object.keys(save.data).length > 0) {
      // Load existing world
      world = World.deserialize(save.data as Record<string, unknown>);
    } else if (save) {
      // Fresh save from new game — generate world
      world = generateTrainingGrounds(save.playerName, save.playerGender, devMode);
    } else {
      // Fallback
      world = generateTrainingGrounds('Shinobi', 'shinobi', devMode);
    }
  } else {
    // No save ID — shouldn't happen, but handle gracefully
    world = generateTrainingGrounds('Shinobi', 'shinobi', devMode);
  }

  // ── Compute initial FOV ──
  const playerPos = world.positions.get(world.playerEntityId);
  if (playerPos) {
    const nightReduction = getNightFovReduction(world.gameTimeSeconds);
    computeFOV(world, playerPos.x, playerPos.y, Math.max(3, FOV_RADIUS - nightReduction));
  }

  // ── Build layout ──
  const layout = createElement('div', { className: 'game-layout' });

  // ── Top bar ──
  const topbar = createElement('div', { className: 'game-topbar' });

  const topbarLeft = createElement('div', { className: 'game-topbar__left' });
  const zoneLabel = createElement('span', { className: 'game-topbar__zone', text: 'Training Grounds' });
  const timeLabel = createElement('span', { className: 'game-topbar__tick', text: formatGameTime(world.gameTimeSeconds) });
  const saveFlash = createElement('span', { className: 'game-topbar__save-flash', text: 'Saved' });
  topbarLeft.appendChild(zoneLabel);
  topbarLeft.appendChild(timeLabel);
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

  // Screen shake callback for critical hits
  setScreenShakeCallback(() => {
    canvasContainer.classList.add('game-canvas-container--shake');
    canvasContainer.addEventListener('animationend', () => {
      canvasContainer.classList.remove('game-canvas-container--shake');
    }, { once: true });
  });

  // Update tick label on each HUD update
  const origFullRender = hud.fullRender.bind(hud);
  hud.fullRender = (w: World) => {
    origFullRender(w);
    timeLabel.textContent = formatGameTime(w.gameTimeSeconds);
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

  // Tempo beads + condition indicator (in the HUD, after stance indicator)
  const tempoBeads = new TempoBeadsUI();
  const conditionIndicator = new ConditionIndicator();
  hud.insertAfterStance(tempoBeads.element);
  hud.insertAfterStance(conditionIndicator.element);

  const inputSystem = new InputSystem(world, camera, hud, keybindingsPanel, characterSheet, tempoBeads, conditionIndicator);

  // Respawn flow (fade to black → restore → fade back)
  const doRespawn = async () => {
    canvasContainer.classList.add('game-canvas-container--blackout');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    executeRespawn(world, TRAINING_GROUNDS_RESPAWN);
    const pp = world.positions.get(world.playerEntityId);
    if (pp) camera.snapTo(pp.x, pp.y);
    hud.fullRender(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);
    canvasContainer.classList.remove('game-canvas-container--blackout');
    canvasContainer.classList.add('game-canvas-container--fadein');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    canvasContainer.classList.remove('game-canvas-container--fadein');
  };

  setPlayerRespawnCallback(() => { doRespawn(); });

  // Sleep flow (8 hours pass, restore stamina ceiling)
  const doSleep = async () => {
    canvasContainer.classList.add('game-canvas-container--blackout');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    // 8 hours of sleep
    world.gameTimeSeconds += 8 * 3600;
    const res = world.resources.get(world.playerEntityId);
    if (res) {
      res.staminaCeiling = res.maxStamina;
      res.stamina = Math.min(res.maxStamina, res.stamina + res.maxStamina * 0.8);
    }
    const hp = world.healths.get(world.playerEntityId);
    if (hp) hp.current = Math.min(hp.max, hp.current + Math.floor(hp.max * 0.5));
    world.log('You sleep soundly and wake feeling refreshed.', 'system');
    hud.fullRender(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);
    canvasContainer.classList.remove('game-canvas-container--blackout');
    canvasContainer.classList.add('game-canvas-container--fadein');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    canvasContainer.classList.remove('game-canvas-container--fadein');
  };

  inputSystem.setSleepCallback(() => { doSleep(); });

  // Universal context menu for all entity interactions
  const contextMenu = new ContextMenu();
  inputSystem.setContextMenuCallback(async (entityId: number) => {
    const name = world.names.get(entityId)?.display ?? 'Unknown';
    const options = buildContextOptions(world, entityId, TRAINING_GROUNDS_FLAGS);

    if (options.length === 0) {
      world.log('Nothing to do here.', 'info');
      return;
    }

    const choice = await contextMenu.show(name, options);

    if (choice === 'examine') {
      const lines = getExamineText(world, entityId);
      for (const line of lines) {
        world.log(line, 'info');
      }
    } else if (choice === 'revive') {
      reviveEntity(world, entityId, 0.3);
      world.gameTimeSeconds += 6;
      world.currentTick += 1;
    } else if (choice === 'kill') {
      killEntity(world, entityId, world.playerEntityId);
      world.gameTimeSeconds += 2;
      world.currentTick += 1;
    } else if (choice === 'assassinate') {
      killEntity(world, entityId, world.playerEntityId, true);
      world.gameTimeSeconds += 2;
      world.currentTick += 1;
    } else if (choice === 'use_sleep') {
      doSleep();
    }

    hud.update(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);
  });

  // ── Render Loop ──
  let rafId = 0;
  let lastTime = performance.now();
  let lastSaveTick = world.currentTick;

  const renderLoop = (time: number) => {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    camera.update(dt);
    updateParticles(dt);
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
