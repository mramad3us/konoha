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
import { MissionLogUI } from '../ui/missionLogUI.ts';
import { TempoBeadsUI } from '../ui/tempoBeads.ts';
import { ConditionIndicator } from '../ui/conditionIndicator.ts';
import { setScreenShakeCallback } from '../engine/combatSystem.ts';
import { setPlayerRespawnCallback, killEntity, reviveEntity, stopBleeding } from '../engine/entityState.ts';
import { executeSurpriseAttack } from '../engine/surpriseAttack.ts';
import { restrainEntity, releaseEntity, startCarrying, stopCarrying } from '../engine/restraintCarry.ts';
import { computeImprovement, SKILL_IMPROVEMENT_RATES, STAT_IMPROVEMENT_RATES } from '../types/character.ts';
import { KillIntentToggle } from '../ui/killIntentToggle.ts';
import { buildContextOptions, getExamineText, TRAINING_GROUNDS_FLAGS } from '../engine/interactionBuilder.ts';
import { ContextMenu } from '../ui/contextMenu.ts';
import { MissionBoardUI } from '../ui/missionBoardUI.ts';
import { interactWithEntity, dispelInvisibilityOnInteract } from '../engine/turnSystem.ts';
import { refreshMissionBoard, acceptMission, reportMission, abandonMission, getGameDay, processMissionEvent, getActiveMissionStatus, getMissionXpMultiplier, getCRankData } from '../engine/missions.ts';
import { updateParticles } from '../systems/particleSystem.ts';
import { updateFloatingTexts } from '../systems/floatingTextSystem.ts';
import { executeRespawn, TRAINING_GROUNDS_RESPAWN, RESPAWN_FADE_MS } from '../engine/respawn.ts';
import { screenManager } from '../systems/screenManager.ts';
import { saveSystem } from '../systems/saveSystem.ts';
import { computeFOV } from '../engine/fov.ts';
import { generateVillage } from '../map/villageGenerator.ts';
import { World } from '../engine/world.ts';
import { activeSaveId } from '../engine/session.ts';
import { FOV_RADIUS, AUTO_SAVE_INTERVAL_TICKS, COMBAT_PASS_TICKS, MAX_THROWN_AMMO, TICK_SECONDS, SLOW_SYSTEM_INTERVAL, EXAMINE_TICKS } from '../core/constants.ts';
import { getPatchUpTime, getFirstAidTime } from '../engine/reactionSystem.ts';
import { computeMaxChakra } from '../engine/derivedStats.ts';
import { formatGameTime, getNightFovReduction } from '../engine/gameTime.ts';
import { getZoneName } from '../engine/zones.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import { reshuffleWanderingNpcs, tickDuskTransition, tickDawnTransition } from '../engine/npcLifecycleSystem.ts';
import { checkSkillUp } from '../engine/skillFeedback.ts';
import type { EntityId } from '../types/ecs.ts';
import { OvermapRenderer } from '../overmap/overmapRenderer.ts';
import { tickTravel } from '../overmap/overmapTravel.ts';
import { beginAwayMission, createMissionWorld, beginReturnTrip } from '../engine/awayMissionFlow.ts';
import { computeCRankRewards, applyMissionRewards } from '../engine/missionRewards.ts';
import { OVERMAP_WALK_SPEED_KMH } from '../core/constants.ts';
import { autoAssignSquad, deploySquad, returnSquadFromMission, getSquadMember, toggleROE, getCurrentROE } from '../engine/squadSystem.ts';
import { ROEIndicator } from '../ui/roeIndicator.ts';
import type { SquadMember } from '../types/squad.ts';

const MEDIC_HEAL_MESSAGES = [
  '{medic} examines your injuries with practiced hands. "Hold still." Green chakra glows at their fingertips.',
  '"Let me take a look at that." {medic}\'s hands glow with healing chakra as they work.',
  '{medic} places a warm hand on your shoulder. You feel chakra flowing into the wound.',
  '"You should be more careful out there." {medic} channels healing energy into your injuries.',
  '{medic} runs a diagnostic jutsu over your body, then begins treating the worst of it.',
];

/** Apply healing from a medical NPC to the player */
function applyMedicHealing(world: World, medicId: EntityId): void {
  const medicSheet = world.characterSheets.get(medicId);
  const medicName = world.names.get(medicId)?.display ?? 'The medic';
  const playerHp = world.healths.get(world.playerEntityId);
  if (!playerHp || !medicSheet) return;

  // Heal based on medic's skill: 30-80% of max HP
  const medSkill = medicSheet.skills.med;
  const healPct = Math.min(0.8, 0.3 + medSkill / 200);
  const healAmount = Math.max(5, Math.floor(playerHp.max * healPct));
  playerHp.current = Math.min(playerHp.max, playerHp.current + healAmount);

  // Also stop bleeding if any
  const bleeding = world.bleeding.get(world.playerEntityId);
  if (bleeding) {
    world.bleeding.delete(world.playerEntityId);
    world.log(`${medicName} cleans and closes the wound. The bleeding stops.`, 'info');
  }

  // Flavor
  const msg = MEDIC_HEAL_MESSAGES[Math.floor(Math.random() * MEDIC_HEAL_MESSAGES.length)]
    .replace(/\{medic\}/g, medicName);
  world.log(msg, 'info');
  world.log(`(+${healAmount} HP)`, 'system');

  // Takes time — 6 seconds (60 ticks)
  world.currentTick += Math.round(6 / TICK_SECONDS);
}

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

  // Hide mouse cursor on keyboard input, restore on mouse move
  document.addEventListener('keydown', () => {
    document.body.classList.add('cursor-hidden');
  });
  document.addEventListener('mousemove', () => {
    document.body.classList.remove('cursor-hidden');
  });

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

  // ROE indicator (shown when squad is active on mission)
  const roeIndicator = new ROEIndicator();
  roeIndicator.setChangeCallback((roe) => {
    toggleROE(world.squadRoster);
    const label = roe === 'aggressive' ? 'AGGRESSIVE — squad engages on sight' : 'DEFENSIVE — squad holds formation';
    world.log(`Squad ROE: ${label}`, 'system');
  });
  canvasContainer.appendChild(roeIndicator.element);

  // Screen shake callback for critical hits
  setScreenShakeCallback(() => {
    canvasContainer.classList.add('game-canvas-container--shake');
    canvasContainer.addEventListener('animationend', () => {
      canvasContainer.classList.remove('game-canvas-container--shake');
    }, { once: true });
  });

  // Update time label on every HUD update (move, combat, etc.)
  const origUpdate = hud.update.bind(hud);
  hud.update = (...args: Parameters<typeof origUpdate>) => {
    origUpdate(...args);
    const w = args[0];
    timeLabel.textContent = formatGameTime(w.gameTimeSeconds);
    const pp = w.positions.get(w.playerEntityId);
    if (pp) {
      if (gamePhase === 'mission') {
        const data = w.missionLog.active ? getCRankData(w.missionLog.active.mission) : null;
        zoneLabel.textContent = data?.targetLocationName ?? 'Mission Area';
      } else {
        zoneLabel.textContent = getZoneName(pp.x, pp.y);
      }
    }
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

  // ── Away Mission Phase System ──
  // Tracks whether we're in village, overmap, or mission map
  type GamePhase = 'village' | 'overmap_out' | 'mission' | 'overmap_back';
  let gamePhase: GamePhase = 'village';
  let villageWorld: World | null = null;      // cached village world during away missions

  // Restore gamePhase if loading a save taken during an away mission
  if (world.awayMissionState) {
    const phase = world.awayMissionState.phase;
    if (phase === 'on_mission') {
      gamePhase = 'mission';
    }
    // If saved during travel phases, restore to village and let them re-depart
    // (overmap travel state is ephemeral — can't resume mid-animation)
  }
  let overmapRenderer: OvermapRenderer | null = null;
  let overmapCanvas: HTMLCanvasElement | null = null;

  // Create overmap canvas (hidden until needed)
  overmapCanvas = document.createElement('canvas');
  overmapCanvas.style.display = 'none';
  overmapCanvas.style.position = 'absolute';
  overmapCanvas.style.top = '0';
  overmapCanvas.style.left = '0';
  overmapCanvas.style.width = '100%';
  overmapCanvas.style.height = '100%';
  overmapCanvas.style.imageRendering = 'pixelated';
  overmapCanvas.style.zIndex = '10';
  canvasContainer.appendChild(overmapCanvas);

  /** Start overmap travel phase */
  const startOvermapPhase = (phase: 'overmap_out' | 'overmap_back') => {
    gamePhase = phase;
    overmapCanvas!.style.display = 'block';
    keybindingsPanel.element.style.display = 'none';
    killToggle.element.style.display = 'none';
    roeIndicator.hide();
    inputSystem.setPaused(true);
    if (!overmapRenderer) {
      overmapRenderer = new OvermapRenderer(overmapCanvas!);
    }
  };

  /** End overmap travel phase */
  const endOvermapPhase = () => {
    overmapCanvas!.style.display = 'none';
    keybindingsPanel.element.style.display = '';
    killToggle.element.style.display = '';
    inputSystem.setPaused(false);
  };

  /** Depart on an away mission — serialize village, start overmap travel */
  const departOnMission = async () => {
    const active = world.missionLog.active;
    if (!active) return;

    const data = getCRankData(active.mission);
    if (!data) return;

    // Blackout transition
    canvasContainer.classList.add('game-canvas-container--blackout');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));

    // Auto-assign squad for C-rank+ missions
    const missionRank = active.mission.rank;
    if (missionRank !== 'D') {
      const squad = autoAssignSquad(world.squadRoster, missionRank, world.gameTimeSeconds);
      if (squad && squad.memberIds.length > 0) {
        deploySquad(world.squadRoster, squad);
        const names = squad.memberIds
          .map(id => getSquadMember(world.squadRoster, id)?.name ?? 'Unknown')
          .join(', ');
        world.log(`Squad assigned: ${names}`, 'system');
      }
    }

    // Begin away mission — serializes village world
    const awayState = beginAwayMission(world, active);
    if (!awayState) {
      world.log('Unable to find a route to the destination.', 'system');
      canvasContainer.classList.remove('game-canvas-container--blackout');
      return;
    }

    world.awayMissionState = awayState;
    world.log(`You depart Konohagakure, heading for ${data.targetLocationName}.`, 'system');

    // Cache village world reference
    villageWorld = world;

    // Start overmap
    startOvermapPhase('overmap_out');

    canvasContainer.classList.remove('game-canvas-container--blackout');
    canvasContainer.classList.add('game-canvas-container--fadein');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    canvasContainer.classList.remove('game-canvas-container--fadein');
  };

  /** Arrive at mission destination — generate mission map */
  const arriveAtMission = async () => {
    const awayState = world.awayMissionState;
    if (!awayState) return;

    const active = world.missionLog.active;
    if (!active) return;

    const data = getCRankData(active.mission);
    if (!data) return;

    // Guard: immediately leave overmap phase so the render loop can't re-enter
    gamePhase = 'mission';
    canvasContainer.classList.add('game-canvas-container--blackout');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));

    // Get player info from village world
    const playerSheet = villageWorld?.characterSheets.get(villageWorld.playerEntityId);
    const playerName = villageWorld?.names.get(villageWorld.playerEntityId)?.display ?? 'Shinobi';
    const playerRenderable = villageWorld?.renderables.get(villageWorld.playerEntityId);
    const playerGender: 'shinobi' | 'kunoichi' = playerRenderable?.spriteId.includes('kunoichi') ? 'kunoichi' : 'shinobi';

    if (!playerSheet) return;

    // Resolve squad members from roster
    const squadMembers: SquadMember[] = [];
    const activeSquad = villageWorld?.squadRoster.activeSquad;
    if (activeSquad) {
      for (const memberId of activeSquad.memberIds) {
        const member = getSquadMember(villageWorld!.squadRoster, memberId);
        if (member) squadMembers.push(member);
      }
    }

    // Generate mission map
    const result = createMissionWorld(awayState, data, playerName, playerGender, playerSheet, world.gameTimeSeconds, squadMembers);

    // Swap world reference
    world = result.world;
    world.awayMissionState = awayState;
    world.missionLog = villageWorld!.missionLog;
    world.squadRoster = villageWorld!.squadRoster;

    // End overmap, enter mission phase
    endOvermapPhase();

    // Reset camera and rendering for new world
    const pp = world.positions.get(world.playerEntityId);
    if (pp) {
      camera.snapTo(pp.x, pp.y);
      const nr = getNightFovReduction(world.gameTimeSeconds);
      computeFOV(world, pp.x, pp.y, Math.max(3, FOV_RADIUS - nr));
    }

    // Update input system to use new world
    inputSystem.swapWorld(world);
    renderer.draw(world);
    hud.fullRender(world);

    world.log(`You arrive near ${data.targetLocationName}. The forest stretches before you.`, 'system');

    // Show ROE indicator if squad is deployed
    if (world.squadRoster.activeSquad && world.squadMembers.size > 0) {
      roeIndicator.setState(getCurrentROE(world.squadRoster));
      roeIndicator.show();
      const squadNames = world.squadRoster.activeSquad.memberIds
        .map(id => getSquadMember(world.squadRoster, id)?.name ?? '?')
        .join(', ');
      world.log(`Your squad is with you: ${squadNames}. Press [R] to toggle ROE.`, 'system');
    }

    canvasContainer.classList.remove('game-canvas-container--blackout');
    canvasContainer.classList.add('game-canvas-container--fadein');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    canvasContainer.classList.remove('game-canvas-container--fadein');
  };

  /** Extract from mission map — begin return trip */
  const extractFromMission = async (abandon: boolean) => {
    const awayState = world.awayMissionState;
    if (!awayState) return;

    const active = world.missionLog.active;
    if (!active) return;

    const data = getCRankData(active.mission);
    if (!data) return;

    if (abandon) {
      world.log('You abandon the mission and retreat.', 'system');
    } else {
      world.log('You extract from the area and head back to Konoha.', 'system');
    }

    // Process squad casualties before leaving the mission map
    if (world.squadRoster.activeSquad) {
      const casualties = new Map<string, 'dead' | 'injured'>();
      for (const sqEntityId of (awayState.squadEntityIds ?? [])) {
        const tag = world.squadMembers.get(sqEntityId);
        if (!tag) continue;
        if (world.dead.has(sqEntityId)) {
          casualties.set(tag.rosterId, 'dead');
          const name = world.names.get(sqEntityId)?.display ?? 'A squad member';
          world.log(`${name} was killed in action.`, 'system');
        } else if (world.unconscious.has(sqEntityId)) {
          casualties.set(tag.rosterId, 'injured');
          const name = world.names.get(sqEntityId)?.display ?? 'A squad member';
          world.log(`${name} was injured during the mission.`, 'system');
        } else {
          const health = world.healths.get(sqEntityId);
          if (health && health.current < health.max * 0.3) {
            casualties.set(tag.rosterId, 'injured');
            const name = world.names.get(sqEntityId)?.display ?? 'A squad member';
            world.log(`${name} took heavy injuries.`, 'system');
          }
        }
      }
      returnSquadFromMission(world.squadRoster, casualties, world.gameTimeSeconds);
    }

    canvasContainer.classList.add('game-canvas-container--blackout');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));

    // Begin return overmap travel
    beginReturnTrip(awayState, data, world.gameTimeSeconds);
    startOvermapPhase('overmap_back');

    canvasContainer.classList.remove('game-canvas-container--blackout');
    canvasContainer.classList.add('game-canvas-container--fadein');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    canvasContainer.classList.remove('game-canvas-container--fadein');
  };

  /** Return to village after overmap travel back */
  const returnToVillage = async () => {
    const awayState = world.awayMissionState;
    if (!awayState || !villageWorld) return;

    // Guard: immediately leave overmap phase so the render loop can't re-enter
    gamePhase = 'village';
    canvasContainer.classList.add('game-canvas-container--blackout');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));

    endOvermapPhase();

    // Restore village world
    world = villageWorld;
    villageWorld = null;

    // Advance village time to match travel time
    if (awayState.overmapState) {
      const totalKm = awayState.overmapState.totalDistanceKm;
      const travelHours = totalKm / OVERMAP_WALK_SPEED_KMH;
      // Add camping time estimate
      const campHours = (travelHours / 14) * 10;
      world.currentTick += Math.round((travelHours + campHours) * 3600 / TICK_SECONDS);
    }

    // Clear away state
    world.awayMissionState = null;
    roeIndicator.hide();

    // Apply mission rewards if objective was completed
    const active = world.missionLog.active;
    // Sync: objective completion is tracked on the mission log, not awayState
    const objectiveComplete = active?.objectiveComplete || awayState.objectiveComplete;
    if (active && objectiveComplete) {
      const playerSheet = world.characterSheets.get(world.playerEntityId);
      if (playerSheet) {
        const rewards = computeCRankRewards(playerSheet, active.mission.rank, (active.mission.templateData as any).missionType ?? 'gang_elimination');
        const changes = applyMissionRewards(playerSheet, rewards);
        // Log reward summary
        for (const [stat, delta] of Object.entries(changes)) {
          world.log(`[Mission XP] ${stat}: ${delta.before.toFixed(1)} → ${delta.after.toFixed(1)}`, 'system');
        }
      }
      world.log('Mission objective complete! Report to the Mission Desk for final confirmation.', 'system');
    } else {
      world.log('You return to the village.', 'system');
    }

    // Reset camera and rendering for village world
    const pp = world.positions.get(world.playerEntityId);
    if (pp) {
      camera.snapTo(pp.x, pp.y);
      const nr = getNightFovReduction(world.gameTimeSeconds);
      computeFOV(world, pp.x, pp.y, Math.max(3, FOV_RADIUS - nr));
    }

    inputSystem.swapWorld(world);
    renderer.draw(world);
    hud.fullRender(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);

    canvasContainer.classList.remove('game-canvas-container--blackout');
    canvasContainer.classList.add('game-canvas-container--fadein');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    canvasContainer.classList.remove('game-canvas-container--fadein');
  };

  // ── Input System ──
  // Character sheet overlay
  const characterSheet = new CharacterSheetUI();
  container.appendChild(characterSheet.element);

  const missionLogUI = new MissionLogUI();
  container.appendChild(missionLogUI.element);

  // Tempo beads + condition indicator (in the HUD, after stance indicator)
  const tempoBeads = new TempoBeadsUI();
  const conditionIndicator = new ConditionIndicator();
  hud.insertAfterStance(tempoBeads.element);
  hud.insertAfterStance(conditionIndicator.element);

  const inputSystem = new InputSystem(world, camera, hud, keybindingsPanel, characterSheet, missionLogUI, tempoBeads, conditionIndicator);

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
    // 8 hours of sleep (advance tick directly — worldTick loop not needed during sleep)
    world.currentTick += Math.round(8 * 3600 / TICK_SECONDS);
    const res = world.resources.get(world.playerEntityId);
    if (res) {
      res.staminaCeiling = res.maxStamina;
      res.stamina = Math.min(res.maxStamina, res.stamina + res.maxStamina * 0.8);
      res.chakraCeiling = res.maxChakra;
      res.chakra = Math.min(res.maxChakra, res.chakra + res.maxChakra * 0.8);
    }
    const hp = world.healths.get(world.playerEntityId);
    if (hp) hp.current = Math.min(hp.max, hp.current + Math.floor(hp.max * 0.5));
    world.log('You sleep soundly and wake feeling refreshed.', 'system');
    // Process day/night transitions that may have occurred during sleep
    tickDuskTransition(world);
    tickDawnTransition(world);
    reshuffleWanderingNpcs(world);
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
    world.currentTick += Math.round(MEDITATION_HOURS * 3600 / TICK_SECONDS);

    // Flavor text
    const sessionSeed = cellHash(world.currentTick, currentDay);
    world.log(MEDITATION_MESSAGES[sessionSeed % MEDITATION_MESSAGES.length], 'system');

    const playerSheet = world.characterSheets.get(world.playerEntityId);
    if (playerSheet && world.meditationSessionsToday < MAX_MEDITATION_SESSIONS_PER_DAY) {
      world.meditationSessionsToday++;

      const mxp = getMissionXpMultiplier(world.missionLog);

      // Improve ninjutsu (~50% of a level 1→2 per session)
      const oldNinjutsu = playerSheet.skills.ninjutsu;
      playerSheet.skills.ninjutsu = computeImprovement(oldNinjutsu, MEDITATION_NINJUTSU_GAIN, 2.0, mxp);

      // Also improve chakra and mental stats (equivalent of 4 hours of meditation ticks)
      // 4 hours = 14,400 seconds = 7,200 2-second combat passes
      const meditationPasses = 7200;
      const oldCha = playerSheet.stats.cha;
      const oldMen = playerSheet.stats.men;
      playerSheet.stats.cha = computeImprovement(oldCha, STAT_IMPROVEMENT_RATES.cha_meditation * meditationPasses, 2.0, mxp);
      playerSheet.stats.men = computeImprovement(oldMen, STAT_IMPROVEMENT_RATES.men_meditation * meditationPasses, 2.0, mxp);

      // Update chakra reserves
      const res = world.resources.get(world.playerEntityId);
      if (res) {
        const newMaxChakra = computeMaxChakra(playerSheet.stats);
        res.maxChakra = newMaxChakra;
        res.chakra = Math.min(newMaxChakra, res.chakra + Math.floor(newMaxChakra * 0.3));
      }

      // Level-up checks
      checkSkillUp(world, 'ninjutsu', oldNinjutsu, playerSheet.skills.ninjutsu);
      checkSkillUp(world, 'cha', oldCha, playerSheet.stats.cha);
      checkSkillUp(world, 'men', oldMen, playerSheet.stats.men);

      const ninjutsuGain = playerSheet.skills.ninjutsu - oldNinjutsu;
      if (ninjutsuGain > 0.01) {
        world.log(MEDITATION_IMPROVE_MESSAGES[sessionSeed % MEDITATION_IMPROVE_MESSAGES.length], 'info');
      }

      world.log(`(Session ${world.meditationSessionsToday}/${MAX_MEDITATION_SESSIONS_PER_DAY} today)`, 'info');
    } else {
      world.log(MEDITATION_DIMINISHED_MESSAGES[sessionSeed % MEDITATION_DIMINISHED_MESSAGES.length], 'info');
    }

    world.currentTick += SLOW_SYSTEM_INTERVAL;  // advance 1 slow-system interval (3s)
    // Process day/night transitions that may have occurred during meditation
    tickDuskTransition(world);
    tickDawnTransition(world);
    reshuffleWanderingNpcs(world);
    hud.fullRender(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);
    canvasContainer.classList.remove('game-canvas-container--blackout');
    canvasContainer.classList.add('game-canvas-container--fadein');
    await new Promise(r => setTimeout(r, RESPAWN_FADE_MS));
    canvasContainer.classList.remove('game-canvas-container--fadein');
  };

  // ── Shared context menu choice handler ──
  const handleContextChoice = async (choice: string | null, entityId: number) => {
    if (!choice) return;

    // Committing to a context menu action dispels invisibility
    dispelInvisibilityOnInteract(world);

    if (choice === 'examine') {
      const lines = getExamineText(world, entityId);
      for (const line of lines) {
        world.log(line, 'info');
      }
      world.currentTick += EXAMINE_TICKS;  // 0.5 seconds to look
      // Check if this is a search mission collect (D-rank)
      if (world.missionLog.active && !world.missionLog.active.objectiveComplete) {
        const msg = processMissionEvent(world.missionLog, { type: 'collect_entity', entityId }, world);
        if (msg) world.log(msg, 'system');
      }
    } else if (choice === 'search') {
      const targetName = world.names.get(entityId)?.display ?? 'the body';
      world.log(`You search ${targetName}...`, 'info');
      world.currentTick += Math.round(3 / TICK_SECONDS);  // 3 seconds to search

      // Check for mission trophy (C-rank away missions)
      if (world.awayMissionState && world.missionLog.active) {
        const away = world.awayMissionState;
        const isTarget = away.targetEntityId === entityId || away.banditEntityIds.includes(entityId);
        if (isTarget && !away.hasTrophy) {
          away.hasTrophy = true;
          const data = getCRankData(world.missionLog.active.mission);
          const trophyName = data?.trophyItem ?? 'proof';
          world.log(`Found: ${trophyName}.`, 'info');
          const missionMsg = processMissionEvent(world.missionLog, { type: 'trophy_collected' });
          if (missionMsg) world.log(missionMsg, 'system');
        } else {
          world.log('Nothing useful.', 'info');
        }
      } else {
        // Generic search — placeholder for future loot system
        world.log('Nothing useful.', 'info');
      }
    } else if (choice === 'talk') {
      // Delivery mission interaction
      const npcName = world.names.get(entityId)?.display;
      if (npcName && world.missionLog.active && !world.missionLog.active.objectiveComplete) {
        const msg = processMissionEvent(world.missionLog, { type: 'interact_npc', npcName });
        if (msg) world.log(msg, 'system');
      }
    } else if (choice === 'request_healing') {
      applyMedicHealing(world, entityId);
    } else if (choice === 'revive') {
      reviveEntity(world, entityId, 0.3);
      world.currentTick += Math.round(6 / TICK_SECONDS);  // 6 seconds to revive
    } else if (choice === 'kill' || choice === 'execute') {
      killEntity(world, entityId, world.playerEntityId, true);
      world.currentTick += COMBAT_PASS_TICKS;  // 2 seconds
    } else if (choice === 'assassinate') {
      killEntity(world, entityId, world.playerEntityId, true);
      world.currentTick += COMBAT_PASS_TICKS;  // 2 seconds
    } else if (choice === 'surprise_subdue') {
      executeSurpriseAttack(world, world.playerEntityId, entityId, false);
    } else if (choice === 'surprise_assassinate') {
      executeSurpriseAttack(world, world.playerEntityId, entityId, true);
    } else if (choice === 'restrain') {
      restrainEntity(world, entityId, world.playerEntityId);
      // Fire mission capture event for away missions
      if (world.awayMissionState && world.missionLog.active) {
        const away = world.awayMissionState;
        if (away.targetEntityId === entityId || away.banditEntityIds.includes(entityId)) {
          const missionMsg = processMissionEvent(
            world.missionLog,
            { type: 'target_captured', entityId },
            world,
          );
          if (missionMsg) world.log(missionMsg, 'system');
        }
      }
    } else if (choice === 'release') {
      releaseEntity(world, entityId);
    } else if (choice === 'carry') {
      startCarrying(world, world.playerEntityId, entityId);
    } else if (choice === 'drop_carried') {
      stopCarrying(world, world.playerEntityId);
    } else if (choice === 'patch_up') {
      stopBleeding(world, entityId);
      world.currentTick += getPatchUpTime(world, world.playerEntityId);  // med-skill-scaled (60s→10s)
      const playerSheet = world.characterSheets.get(world.playerEntityId);
      if (playerSheet) {
        const oldMed = playerSheet.skills.med;
        playerSheet.skills.med = computeImprovement(oldMed, SKILL_IMPROVEMENT_RATES.med);
        checkSkillUp(world, 'med', oldMed, playerSheet.skills.med);
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
        const oldMed2 = playerSheet.skills.med;
        playerSheet.skills.med = computeImprovement(oldMed2, SKILL_IMPROVEMENT_RATES.med);
        checkSkillUp(world, 'med', oldMed2, playerSheet.skills.med);
      }
      world.currentTick += getFirstAidTime(world, world.playerEntityId);  // med-skill-scaled (12s→2s)
    } else if (choice === 'restock_weapons') {
      // Restock thrown weapons from weapons rack
      const playerId = world.playerEntityId;
      let ammo = world.thrownAmmo.get(playerId);
      if (!ammo) {
        ammo = { kunai: 0, shuriken: 0 };
        world.thrownAmmo.set(playerId, ammo);
      }
      const kunaiAdded = MAX_THROWN_AMMO - ammo.kunai;
      const shurikenAdded = MAX_THROWN_AMMO - ammo.shuriken;
      ammo.kunai = MAX_THROWN_AMMO;
      ammo.shuriken = MAX_THROWN_AMMO;
      if (kunaiAdded > 0 || shurikenAdded > 0) {
        world.log(`Restocked: +${kunaiAdded} kunai, +${shurikenAdded} shuriken.`, 'system');
      }
    } else if (choice === 'use_sleep') {
      doSleep();
    } else if (choice === 'use_meditate') {
      await doMeditate();
    } else if (choice === 'use_mission_board') {
      await openMissionBoard();
    } else if (choice === 'depart_mission') {
      await departOnMission();
    } else if (choice === 'extract_complete' || choice === 'extract_abandon') {
      await extractFromMission(choice === 'extract_abandon');
    }
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
    await handleContextChoice(choice, entityId);

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
    refreshMissionBoard(world.missionBoard, currentDay, playerRank, world.missionLog.completed, world.missionSalt);

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
      await handleContextChoice(ctxChoice, interaction.entityId);
    }

    hud.update(world);
    timeLabel.textContent = formatGameTime(world.gameTimeSeconds);
  });

  // Edge extraction — player reached map boundary on mission map
  const extractionMenu = new ContextMenu();
  inputSystem.setROEToggleCallback((roe) => {
    roeIndicator.setState(roe);
  });

  inputSystem.setEdgeExtractionCallback(async () => {
    if (gamePhase !== 'mission') return;

    const active = world.missionLog.active;
    if (!active) return;

    const objectiveComplete = active.objectiveComplete;
    const options: { id: string; label: string }[] = [];

    if (objectiveComplete) {
      options.push({ id: 'extract_complete', label: 'Extract — Mission Complete' });
    }
    options.push({ id: 'extract_abandon', label: objectiveComplete ? 'Extract — Skip Reward' : 'Abandon Mission' });
    options.push({ id: 'retreat', label: 'Retreat (Come back later)' });

    const choice = await extractionMenu.show('Map Edge', options);
    if (!choice) return;

    if (choice === 'extract_complete' || choice === 'extract_abandon') {
      await extractFromMission(choice === 'extract_abandon');
    } else if (choice === 'retreat') {
      // Retreat: leave map but don't fail mission — can return if not expired
      await extractFromMission(false);
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

    if (gamePhase === 'overmap_out' || gamePhase === 'overmap_back') {
      // Overmap travel animation
      if (overmapRenderer && world.awayMissionState?.overmapState) {
        const travelState = world.awayMissionState.overmapState;
        const hour = Math.floor((world.gameTimeSeconds % 86400) / 3600);
        const isNight = hour >= 20 || hour < 6;

        const { result, gameSecondsElapsed } = tickTravel(travelState, world.gameTimeSeconds);
        world.currentTick += Math.round(gameSecondsElapsed / TICK_SECONDS);
        timeLabel.textContent = formatGameTime(world.gameTimeSeconds);

        overmapRenderer.draw(travelState, dt, isNight);

        if (result.type === 'arrived') {
          if (gamePhase === 'overmap_out') {
            arriveAtMission();
          } else {
            returnToVillage();
          }
        }
      }
    } else {
      // Normal game rendering (village or mission map)
      camera.update(dt);
      updateParticles(dt);
      updateFloatingTexts(dt);
      const throwTarget = inputSystem.throwingMode ? inputSystem.throwTargets[inputSystem.throwTargetIndex] : undefined;
      const shadowCursor = inputSystem.shadowStepMode
        ? { x: inputSystem.shadowStepCursor.x, y: inputSystem.shadowStepCursor.y, range: inputSystem.shadowStepRange }
        : undefined;
      renderer.draw(world, throwTarget, shadowCursor);
    }

    rafId = requestAnimationFrame(renderLoop);
  };

  rafId = requestAnimationFrame(renderLoop);

  // ── Resize observer ──
  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(canvasContainer);

  // ── Auto-save check (runs on HUD updates via interval) ──
  const autoSaveInterval = setInterval(async () => {
    if (saveId && world.currentTick - lastSaveTick >= AUTO_SAVE_INTERVAL_TICKS) {
      lastSaveTick = world.currentTick;
      const save = await saveSystem.load(saveId!);
      if (save) {
        save.data = world.serialize();
        save.playtime += AUTO_SAVE_INTERVAL_TICKS;
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
