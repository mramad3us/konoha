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
import { setPlayerRespawnCallback, killEntity, reviveEntity, stopBleeding } from '../engine/entityState.ts';
import { computeImprovement, SKILL_IMPROVEMENT_RATES, STAT_IMPROVEMENT_RATES } from '../types/character.ts';
import { KillIntentToggle } from '../ui/killIntentToggle.ts';
import { buildContextOptions, getExamineText, TRAINING_GROUNDS_FLAGS } from '../engine/interactionBuilder.ts';
import { ContextMenu } from '../ui/contextMenu.ts';
import { MissionBoardUI } from '../ui/missionBoardUI.ts';
import { interactWithEntity } from '../engine/turnSystem.ts';
import { refreshMissionBoard, acceptMission, reportMission, abandonMission, getGameDay, processMissionEvent, getActiveMissionStatus, getMissionXpMultiplier } from '../engine/missions.ts';
import { updateParticles } from '../systems/particleSystem.ts';
import { executeRespawn, TRAINING_GROUNDS_RESPAWN, RESPAWN_FADE_MS } from '../engine/respawn.ts';
import { screenManager } from '../systems/screenManager.ts';
import { saveSystem } from '../systems/saveSystem.ts';
import { computeFOV } from '../engine/fov.ts';
import { generateVillage } from '../map/villageGenerator.ts';
import { World } from '../engine/world.ts';
import { activeSaveId } from '../engine/session.ts';
import { FOV_RADIUS, AUTO_SAVE_INTERVAL_TURNS } from '../core/constants.ts';
import { computeMaxChakra } from '../engine/derivedStats.ts';
import { formatGameTime, getNightFovReduction } from '../engine/gameTime.ts';
import { getZoneName } from '../engine/zones.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';

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
      world = generateVillage(save.playerName, save.playerGender, devMode);
    } else {
      // Fallback
      world = generateVillage('Shinobi', 'shinobi', devMode);
    }
  } else {
    // No save ID — shouldn't happen, but handle gracefully
    world = generateVillage('Shinobi', 'shinobi', devMode);
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
  const playerP = world.positions.get(world.playerEntityId);
  const initialZone = playerP ? getZoneName(playerP.x, playerP.y) : 'Konoha Village';
  const zoneLabel = createElement('span', { className: 'game-topbar__zone', text: initialZone });
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

  // Kill intent toggle
  const killToggle = new KillIntentToggle();
  killToggle.setState(world.playerKillIntent);
  killToggle.setChangeCallback((kill) => {
    world.playerKillIntent = kill;
    world.log(kill ? 'You draw your kunai. Fighting to kill.' : 'You sheathe your weapon. Fighting to subdue.', 'system');
  });
  canvasContainer.appendChild(killToggle.element);

  // Screen shake callback for critical hits
  setScreenShakeCallback(() => {
    canvasContainer.classList.add('game-canvas-container--shake');
    canvasContainer.addEventListener('animationend', () => {
      canvasContainer.classList.remove('game-canvas-container--shake');
    }, { once: true });
  });

  // Update time label on every HUD update (move, combat, etc.)
  const origUpdate = hud.update.bind(hud);
  hud.update = (w: World) => {
    origUpdate(w);
    timeLabel.textContent = formatGameTime(w.gameTimeSeconds);
    const pp = w.positions.get(w.playerEntityId);
    if (pp) zoneLabel.textContent = getZoneName(pp.x, pp.y);
  };
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

  // Meditation flow (4 hours pass, improve ninjutsu + chakra, max 2 productive sessions/day)
  const MEDITATION_HOURS = 4;
  const MEDITATION_NINJUTSU_GAIN = 0.53; // ~50% of level 1→2 per session at low levels
  const MAX_MEDITATION_SESSIONS_PER_DAY = 2;

  const MEDITATION_MESSAGES = [
    'You close your eyes and focus inward. The world melts away as you sense the flow of chakra within you.',
    'Sitting still, you concentrate on the hand seals in your mind. The shapes of chakra become clearer.',
    'You enter a state of deep focus. Chakra circulates through your pathways like a warm current.',
    'Your breathing slows. The subtle movements of chakra through your body feel more natural with practice.',
    'You visualize the tenketsu points along your arms. The flow of energy sharpens with each breath.',
  ];

  const MEDITATION_IMPROVE_MESSAGES = [
    'Your awareness of sign weaving and chakra manipulation has deepened.',
    'You feel a subtle improvement in your ability to mold chakra.',
    'The hand seals feel more intuitive. Your ninjutsu foundation grows stronger.',
    'Something clicks — chakra flows a little easier through your pathways now.',
    'Your chakra control feels noticeably sharper after this session.',
  ];

  const MEDITATION_DIMINISHED_MESSAGES = [
    'You meditate, but your mind wanders. The chakra doesn\'t flow as freely today.',
    'You go through the motions, but the deep focus won\'t come. You\'ve trained enough for one day.',
    'Your body sits still but your mind resists. Additional meditation won\'t help today.',
  ];

  const doMeditate = async () => {
    canvasContainer.classList.add('game-canvas-container--blackout');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));

    // Check productive sessions for today
    const currentDay = getGameDay(world.gameTimeSeconds);
    if (world.meditationLastDay !== currentDay) {
      world.meditationLastDay = currentDay;
      world.meditationSessionsToday = 0;
    }

    // Advance time (always passes 4 hours regardless)
    world.gameTimeSeconds += MEDITATION_HOURS * 3600;

    // Flavor text
    const sessionSeed = cellHash(world.currentTick, currentDay);
    world.log(MEDITATION_MESSAGES[sessionSeed % MEDITATION_MESSAGES.length], 'system');

    const playerSheet = world.characterSheets.get(world.playerEntityId);
    if (playerSheet && world.meditationSessionsToday < MAX_MEDITATION_SESSIONS_PER_DAY) {
      world.meditationSessionsToday++;

      const mxp = getMissionXpMultiplier(world.missionLog);

      // Improve ninjutsu (~50% of a level 1→2 per session)
      const oldNinjutsu = playerSheet.skills.ninjutsu;
      playerSheet.skills.ninjutsu = computeImprovement(
        playerSheet.skills.ninjutsu,
        MEDITATION_NINJUTSU_GAIN,
        2.0,
        mxp,
      );

      // Also improve chakra and mental stats (equivalent of 4 hours of meditation ticks)
      // 4 hours = 14,400 seconds = 7,200 2-second combat passes
      const meditationPasses = 7200;
      playerSheet.stats.cha = computeImprovement(
        playerSheet.stats.cha,
        STAT_IMPROVEMENT_RATES.cha_meditation * meditationPasses,
        2.0,
        mxp,
      );
      playerSheet.stats.men = computeImprovement(
        playerSheet.stats.men,
        STAT_IMPROVEMENT_RATES.men_meditation * meditationPasses,
        2.0,
        mxp,
      );

      // Update chakra reserves
      const res = world.resources.get(world.playerEntityId);
      if (res) {
        const newMaxChakra = computeMaxChakra(playerSheet.stats);
        res.maxChakra = newMaxChakra;
        res.chakra = Math.min(newMaxChakra, res.chakra + Math.floor(newMaxChakra * 0.3));
      }

      const ninjutsuGain = playerSheet.skills.ninjutsu - oldNinjutsu;
      if (ninjutsuGain > 0.01) {
        world.log(MEDITATION_IMPROVE_MESSAGES[sessionSeed % MEDITATION_IMPROVE_MESSAGES.length], 'info');
      }

      world.log(`(Session ${world.meditationSessionsToday}/${MAX_MEDITATION_SESSIONS_PER_DAY} today)`, 'info');
    } else {
      world.log(MEDITATION_DIMINISHED_MESSAGES[sessionSeed % MEDITATION_DIMINISHED_MESSAGES.length], 'info');
    }

    world.currentTick += 1;
    hud.fullRender(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);
    canvasContainer.classList.remove('game-canvas-container--blackout');
    canvasContainer.classList.add('game-canvas-container--fadein');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    canvasContainer.classList.remove('game-canvas-container--fadein');
  };

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
      // Check if this is a search mission collect
      if (world.missionLog.active && !world.missionLog.active.objectiveComplete) {
        const msg = processMissionEvent(world.missionLog, { type: 'collect_entity', entityId }, world);
        if (msg) world.log(msg, 'system');
      }
    } else if (choice === 'talk') {
      // Check if this NPC is a delivery target
      const npcName = world.names.get(entityId)?.display;
      if (npcName && world.missionLog.active && !world.missionLog.active.objectiveComplete) {
        const msg = processMissionEvent(world.missionLog, { type: 'interact_npc', npcName });
        if (msg) world.log(msg, 'system');
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
    } else if (choice === 'patch_up') {
      stopBleeding(world, entityId);
      world.gameTimeSeconds += 2;
      world.currentTick += 1;
      // Improve MED skill
      const playerSheet = world.characterSheets.get(world.playerEntityId);
      if (playerSheet) {
        playerSheet.skills.med = computeImprovement(playerSheet.skills.med, SKILL_IMPROVEMENT_RATES.med);
      }
    } else if (choice === 'first_aid') {
      const targetHp = world.healths.get(entityId);
      const playerSheet = world.characterSheets.get(world.playerEntityId);
      if (targetHp && playerSheet) {
        const healPct = (5 + Math.floor(playerSheet.skills.med / 4)) / 100;
        const healAmount = Math.max(1, Math.floor(targetHp.max * healPct));
        targetHp.current = Math.min(targetHp.max, targetHp.current + healAmount);
        const targetName = world.names.get(entityId)?.display ?? 'them';
        world.log(`You treat ${targetName}'s wounds. (+${healAmount} HP)`, 'info');
        playerSheet.skills.med = computeImprovement(playerSheet.skills.med, SKILL_IMPROVEMENT_RATES.med);
      }
      world.gameTimeSeconds += 6;
      world.currentTick += 1;
    } else if (choice === 'use_sleep') {
      doSleep();
    } else if (choice === 'use_meditate') {
      await doMeditate();
    } else if (choice === 'use_mission_board') {
      await openMissionBoard();
    }

    hud.update(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);
  });

  // Mission board UI
  const missionBoardUI = new MissionBoardUI();
  const missionContextMenu = new ContextMenu();
  const openMissionBoard = async () => {
    // If player has an active mission, show mission status menu first
    if (world.missionLog.active) {
      const active = world.missionLog.active;
      const status = getActiveMissionStatus(world.missionLog) ?? active.mission.title;
      const missionOptions: import('../ui/contextMenu.ts').ContextMenuOption[] = [
        { id: 'status', label: status, disabled: true },
      ];

      if (active.objectiveComplete) {
        missionOptions.push({ id: 'report', label: 'Report Mission', accent: true });
      }
      missionOptions.push({ id: 'abandon', label: 'Abandon Mission', danger: true });
      missionOptions.push({ id: 'browse', label: 'Browse Board' });

      const choice = await missionContextMenu.show('Active Mission', missionOptions);

      if (choice === 'report') {
        const completed = reportMission(world.missionLog);
        if (completed) {
          world.log(`Mission complete: ${completed.title} (${completed.rank}-Rank)`, 'system');
          world.log(`${completed.rank}-Rank missions completed: ${world.missionLog.completed[completed.rank]}`, 'info');
          world.log(`Total missions completed: ${world.missionLog.totalCompleted}`, 'info');
        }
        hud.update(world);
        return;
      } else if (choice === 'abandon') {
        const missionName = active.mission.title;
        abandonMission(world.missionLog, world);
        world.log(`Mission abandoned: ${missionName}`, 'system');
        hud.update(world);
        return;
      } else if (choice !== 'browse') {
        // Cancelled or status — do nothing
        return;
      }
      // If 'browse', fall through to show the board
    }

    // Refresh board for current day
    const playerSheet = world.characterSheets.get(world.playerEntityId);
    const playerRank = playerSheet?.rank ?? 'genin';
    const currentDay = getGameDay(world.gameTimeSeconds);
    refreshMissionBoard(world.missionBoard, currentDay, playerRank, world.missionLog.completed);

    const chosenId = await missionBoardUI.show(
      world.missionBoard, world.missionLog, playerRank, world.gameTimeSeconds,
    );

    if (chosenId) {
      const mission = acceptMission(world.missionLog, world.missionBoard, chosenId, world);
      if (mission) {
        world.log(`Mission accepted: ${mission.title} (${mission.rank}-Rank)`, 'system');
        world.log(`Objective: ${mission.objective}`, 'info');
      }
    }

    hud.update(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);
  };

  // Target selector — when multiple interactables are nearby, pick one first
  const targetMenu = new ContextMenu();
  inputSystem.setTargetSelectCallback(async (candidates: number[]) => {
    const options = candidates.map(eid => {
      const name = world.names.get(eid)?.display ?? 'Unknown';
      const door = world.doors.get(eid);
      const label = door
        ? `${door.isOpen ? 'Close' : 'Open'} door`
        : name;
      return { id: String(eid), label };
    });

    const choice = await targetMenu.show('Interact with...', options);
    if (choice === null) return;

    const chosenId = Number(choice);
    interactWithEntity(world, chosenId, world.playerEntityId);

    // After interacting, check if a context menu was triggered
    if (world._pendingInteraction?.type === 'context_menu') {
      const interaction = world._pendingInteraction;
      world._pendingInteraction = null;
      const name = world.names.get(interaction.entityId)?.display ?? 'Unknown';
      const ctxOptions = buildContextOptions(world, interaction.entityId, TRAINING_GROUNDS_FLAGS);
      if (ctxOptions.length === 0) {
        world.log('Nothing to do here.', 'info');
        return;
      }
      const ctxChoice = await contextMenu.show(name, ctxOptions);
      // Handle context menu choice (reuse same logic)
      if (ctxChoice === 'examine') {
        const lines = getExamineText(world, interaction.entityId);
        for (const line of lines) world.log(line, 'info');
        // Check if this is a search mission collect
        if (world.missionLog.active && !world.missionLog.active.objectiveComplete) {
          const msg = processMissionEvent(world.missionLog, { type: 'collect_entity', entityId: interaction.entityId }, world);
          if (msg) world.log(msg, 'system');
        }
      } else if (ctxChoice === 'talk') {
        // Check if this NPC is a delivery target
        const npcName = world.names.get(interaction.entityId)?.display;
        if (npcName && world.missionLog.active && !world.missionLog.active.objectiveComplete) {
          const msg = processMissionEvent(world.missionLog, { type: 'interact_npc', npcName });
          if (msg) world.log(msg, 'system');
        }
      } else if (ctxChoice === 'revive') {
        reviveEntity(world, interaction.entityId, 0.3);
        world.gameTimeSeconds += 6; world.currentTick += 1;
      } else if (ctxChoice === 'kill') {
        killEntity(world, interaction.entityId, world.playerEntityId);
        world.gameTimeSeconds += 2; world.currentTick += 1;
      } else if (ctxChoice === 'assassinate') {
        killEntity(world, interaction.entityId, world.playerEntityId, true);
        world.gameTimeSeconds += 2; world.currentTick += 1;
      } else if (ctxChoice === 'patch_up') {
        stopBleeding(world, interaction.entityId);
        world.gameTimeSeconds += 2; world.currentTick += 1;
        const playerSheet = world.characterSheets.get(world.playerEntityId);
        if (playerSheet) playerSheet.skills.med = computeImprovement(playerSheet.skills.med, SKILL_IMPROVEMENT_RATES.med);
      } else if (ctxChoice === 'first_aid') {
        const targetHp = world.healths.get(interaction.entityId);
        const playerSheet = world.characterSheets.get(world.playerEntityId);
        if (targetHp && playerSheet) {
          const healPct = (5 + Math.floor(playerSheet.skills.med / 4)) / 100;
          const healAmount = Math.max(1, Math.floor(targetHp.max * healPct));
          targetHp.current = Math.min(targetHp.max, targetHp.current + healAmount);
          const targetName = world.names.get(interaction.entityId)?.display ?? 'them';
          world.log(`You treat ${targetName}'s wounds. (+${healAmount} HP)`, 'info');
          playerSheet.skills.med = computeImprovement(playerSheet.skills.med, SKILL_IMPROVEMENT_RATES.med);
        }
        world.gameTimeSeconds += 6; world.currentTick += 1;
      } else if (ctxChoice === 'use_sleep') {
        doSleep();
      } else if (ctxChoice === 'use_meditate') {
        await doMeditate();
      } else if (ctxChoice === 'use_mission_board') {
        await openMissionBoard();
      }
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
