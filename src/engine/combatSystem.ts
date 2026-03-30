/**
 * Combat system — manages melee engagements between entities.
 *
 * 1. NPC picks its move (blind, simultaneous)
 * 2. Both moves resolve via combatResolver (including conditions)
 * 3. Damage applied, tempo updated, conditions applied, flavor text logged
 * 4. Critical hits: screen shake + condition on defender
 */

import type { CombatMove, CombatEngagement, TempoState, ConditionState } from '../types/combat.ts';
import { maxTempoSlots, startingTempo, DUMMY_DESTROY_THRESHOLD, critChance } from '../types/combat.ts';
import { resolveCombat } from './combatResolver.ts';
import { generateCombatFlavor, generateCritFlavor, generateConditionFlavor, generateNpcObservation } from './flavorText.ts';
import { pickNpcMove } from './combatAI.ts';
import { computeImprovement, SKILL_IMPROVEMENT_RATES } from '../types/character.ts';
import { checkEntityState, applyBleeding, tickBleeding, killEntity as killEntityDirect } from './entityState.ts';
import { STAMINA_REST_TICKS, STAMINA_RESTORE_RATE, CHAKRA_REST_TICKS, CHAKRA_RESTORE_RATE, COMBAT_PASS_SUBTICKS } from '../core/constants.ts';
import { getMissionXpMultiplier } from './missions.ts';
import { checkSkillUp } from './skillFeedback.ts';
import { sfxPunchHit, sfxKickHit, sfxBlock, sfxWhiff, sfxCritical, sfxTempoGain, sfxTempoSpend, sfxClash } from '../systems/audioSystem.ts';
import { STAT_IMPROVEMENT_RATES } from '../types/character.ts';
import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import { tryCastJutsu } from './jutsuResolver.ts';
import { spawnFloatingText } from '../systems/floatingTextSystem.ts';
import { SQUAD_COMBAT_LINES } from './squadSystem.ts';

/** Active engagements keyed by "smaller_id:larger_id" */
const engagements = new Map<string, CombatEngagement>();

function engagementKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

const NO_CONDITION: ConditionState = { condition: null, turnsRemaining: 0 };

function getOrCreateEngagement(world: World, entityA: EntityId, entityB: EntityId): CombatEngagement {
  const key = engagementKey(entityA, entityB);
  let eng = engagements.get(key);
  if (eng) return eng;

  const sheetA = world.characterSheets.get(entityA);
  const sheetB = world.characterSheets.get(entityB);
  const skillA = sheetA?.skills.taijutsu ?? 10;
  const skillB = sheetB?.skills.taijutsu ?? 10;

  eng = {
    entityA, entityB,
    tempoA: { current: startingTempo(skillA, skillB), max: maxTempoSlots(skillA) },
    tempoB: { current: startingTempo(skillB, skillA), max: maxTempoSlots(skillB) },
    conditionA: { ...NO_CONDITION },
    conditionB: { ...NO_CONDITION },
    round: 0,
    pendingNpcMove: null,
  };

  engagements.set(key, eng);
  return eng;
}

/** Check if a given entity is adjacent to the player */
export function findAdjacentTarget(world: World): EntityId | null {
  const playerPos = world.positions.get(world.playerEntityId);
  if (!playerPos) return null;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const entities = world.getEntitiesAt(playerPos.x + dx, playerPos.y + dy);
      for (const eid of entities) {
        if (eid === world.playerEntityId) continue;
        // Skip unconscious and dead entities — can't fight them
        if (world.unconscious.has(eid) || world.dead.has(eid)) continue;
        // Skip entities invisible to the player
        if (world.isInvisibleToPlayer(eid)) continue;
        if (world.combatStats.has(eid) || world.healths.has(eid)) return eid;
      }
    }
  }
  return null;
}

/** Callback for screen shake — set by game.ts */
let screenShakeCallback: (() => void) | null = null;
export function setScreenShakeCallback(cb: () => void): void {
  screenShakeCallback = cb;
}

/**
 * Process a player combat move against an adjacent target.
 * Returns true if a turn was consumed.
 */
export function processCombatMove(world: World, playerMove: CombatMove): boolean {
  const playerId = world.playerEntityId;
  const targetId = findAdjacentTarget(world);
  if (targetId === null) {
    world.log('No one within striking distance.', 'info');
    return false;
  }

  // Attacking dispels invisibility
  if (world.invisible.has(playerId)) {
    world.invisible.delete(playerId);
    world.log('Your invisibility fades as you engage in combat.', 'info');
  }

  const eng = getOrCreateEngagement(world, playerId, targetId);
  const isPlayerA = eng.entityA === playerId;

  // Get skills & stats
  const playerSheet = world.characterSheets.get(playerId);
  const targetSheet = world.characterSheets.get(targetId);
  const playerTaijutsu = playerSheet?.skills.taijutsu ?? 10;
  const targetTaijutsu = targetSheet?.skills.taijutsu ?? 10;
  const playerPhy = playerSheet?.stats.phy ?? 10;
  const targetPhy = targetSheet?.stats.phy ?? 10;

  // Conditions for this round
  const playerCond = isPlayerA ? eng.conditionA : eng.conditionB;
  const targetCond = isPlayerA ? eng.conditionB : eng.conditionA;

  // If player is stunned, they can't act — NPC gets a free hit
  if (playerCond.condition === 'stunned') {
    world.log('You\'re stunned and can\'t respond!', 'hit_incoming');
  }

  // If player is downed, log it
  if (playerCond.condition === 'down') {
    world.log('You struggle to recover your footing...', 'combat_neutral');
  }

  // NPC picks its move
  const isDummy = world.destructibles.has(targetId);
  const npcAiType = isDummy ? 'dummy' as const : 'basic' as const;
  const npcTempo = isPlayerA ? eng.tempoB : eng.tempoA;
  const playerTempo = isPlayerA ? eng.tempoA : eng.tempoB;

  // Override moves for stunned entities (stunned = can't act, their move is irrelevant)
  const effectivePlayerMove = playerCond.condition === 'stunned' ? 'q' as CombatMove : playerMove;
  const npcMove = targetCond.condition === 'stunned'
    ? 'q' as CombatMove
    : pickNpcMove(npcAiType, targetTaijutsu, npcTempo.current, playerTempo.current);

  // Resolve combat
  const outcome = isPlayerA
    ? resolveCombat(effectivePlayerMove, npcMove, playerId, targetId, eng.tempoA, eng.tempoB, eng.conditionA, eng.conditionB, playerTaijutsu, targetTaijutsu, playerPhy, targetPhy)
    : resolveCombat(npcMove, effectivePlayerMove, targetId, playerId, eng.tempoB, eng.tempoA, eng.conditionB, eng.conditionA, targetTaijutsu, playerTaijutsu, targetPhy, playerPhy);

  // Apply tempo changes by entity ID
  const tempoForAttacker = outcome.tempoChange.attacker;
  const tempoForDefender = outcome.tempoChange.defender;

  if (outcome.attackerId === eng.entityA) {
    eng.tempoA.current = Math.max(0, Math.min(eng.tempoA.max, eng.tempoA.current + tempoForAttacker));
    eng.tempoB.current = Math.max(0, Math.min(eng.tempoB.max, eng.tempoB.current + tempoForDefender));
  } else {
    eng.tempoB.current = Math.max(0, Math.min(eng.tempoB.max, eng.tempoB.current + tempoForAttacker));
    eng.tempoA.current = Math.max(0, Math.min(eng.tempoA.max, eng.tempoA.current + tempoForDefender));
  }

  // Apply damage (with kill intent modifier)
  // Dummies deal 0 damage — they're wooden posts, not fighters
  const attackerIsDummy = world.destructibles.has(outcome.attackerId);
  if (outcome.damage > 0 && !attackerIsDummy) {
    const defenderIsDummy = world.destructibles.has(outcome.defenderId);
    let finalDamage = outcome.damage;

    // Kill intent: +20% damage when player is attacker with intent
    if (outcome.attackerId === playerId && world.playerKillIntent) {
      finalDamage = Math.round(finalDamage * 1.2);
    }

    if (!defenderIsDummy) {
      const targetHealth = world.healths.get(outcome.defenderId);
      if (targetHealth) {
        targetHealth.current = Math.max(0, targetHealth.current - finalDamage);
      }

      // Bleeding chance with kill intent (kunai)
      if (outcome.attackerId === playerId && world.playerKillIntent) {
        const bleedChance = 0.20 + playerTaijutsu / 200;
        if (Math.random() < bleedChance) {
          const intensity = 3 + Math.floor(Math.random() * 5); // 3-7
          applyBleeding(world, outcome.defenderId, intensity, true); // byWeapon = true
        }
      }

      // Kill chance on KO with kill intent
      if (targetHealth && targetHealth.current <= 0 && world.playerKillIntent) {
        const killChance = 0.20 + playerTaijutsu / 200;
        if (Math.random() < killChance) {
          // Log kunai kill flavor BEFORE the kill (which logs its own generic text)
          const defName = world.names.get(outcome.defenderId)?.display ?? 'the opponent';
          const kunaiKillMsgs = [
            `The kunai finds ${defName}'s throat. It's over in an instant.`,
            `A final thrust of the blade. ${defName} drops, lifeless.`,
            `The kunai sinks deep into ${defName}'s chest. They don't get up.`,
            `${defName} falls with the kunai still buried in their side.`,
            `A merciful strike — ${defName} feels nothing as the blade ends it.`,
            `The killing blow is clean. ${defName} crumples without a sound.`,
            `Steel flashes once. ${defName} is dead before they hit the ground.`,
            `The kunai traces a red arc. ${defName}'s eyes go dark.`,
            `One precise thrust. ${defName}'s fight — and life — is over.`,
            `The blade does what fists could not. ${defName} falls, still.`,
          ];
          world.log(kunaiKillMsgs[Math.floor(Math.random() * kunaiKillMsgs.length)], 'hit_outgoing');
          killEntityDirect(world, outcome.defenderId, playerId, true);
        }
      }

      // ── NPC substitution jutsu reaction ──
      // When a ninja NPC takes a hit and HP is low, they may use substitution to escape
      if (outcome.defenderId !== playerId && targetHealth && targetHealth.current > 0) {
        const defSheet = world.characterSheets.get(outcome.defenderId);
        const defRes = world.resources.get(outcome.defenderId);
        if (defSheet && defRes && defSheet.learnedJutsus.includes('substitution') && defRes.chakra >= 15) {
          const hpPct = targetHealth.current / targetHealth.max;
          if (hpPct < 0.6 && Math.random() < 0.25) {
            const subResult = tryCastJutsu(world, outcome.defenderId, 'substitution', outcome.attackerId);
            if (subResult.success) {
              const npcName = world.names.get(outcome.defenderId)?.display ?? 'The enemy';
              world.log(`${npcName} forms a hand sign — substitution jutsu!`, 'info');
              const subPos = world.positions.get(outcome.defenderId);
              if (subPos) spawnFloatingText(subPos.x, subPos.y, 'Kawarimi!', '#66ccff');
              engagements.delete(engagementKey(playerId, targetId));
            }
          }
        }
      }
    }

    if (outcome.attackerId === playerId) {
      const res = world.resources.get(playerId);
      if (res) res.stamina = Math.max(0, res.stamina - 1);
    }
  }

  // ── Critical hit check ──
  const defenderIsDummy = world.destructibles.has(outcome.defenderId);
  if (outcome.damage > 0 && !defenderIsDummy) {
    const attackerSkill = outcome.attackerId === playerId ? playerTaijutsu : targetTaijutsu;
    const defenderSkill = outcome.defenderId === playerId ? playerTaijutsu : targetTaijutsu;
    const crit = critChance(attackerSkill, defenderSkill);

    if (Math.random() < crit) {
      outcome.isCritical = true;
      const condition = Math.random() < 0.5 ? 'down' as const : 'stunned' as const;
      outcome.conditionApplied = condition;

      // Apply condition to defender
      const defCond = outcome.defenderId === eng.entityA ? eng.conditionA : eng.conditionB;
      defCond.condition = condition;
      defCond.turnsRemaining = 1;

      // Screen shake
      if (screenShakeCallback) screenShakeCallback();
    }
  }

  // ── Sound effects ──
  switch (outcome.type) {
    case 'clean_hit':
    case 'clash_rng':
    case 'clash_tempo_win':
      if (outcome.isCritical) { sfxCritical(); }
      else { Math.random() < 0.5 ? sfxPunchHit() : sfxKickHit(); }
      break;
    case 'imperfect_block':
      sfxPunchHit(); // glancing hit still makes contact
      break;
    case 'perfect_parry':
      sfxWhiff(); // attacker's strike swooshes
      setTimeout(() => sfxBlock(), 30); // then the parry clack
      break;
    case 'tempo_save':
      sfxTempoSpend();
      sfxWhiff();
      break;
    case 'clash_stalemate':
      sfxClash();
      break;
    case 'circling':
    case 'missed':
      sfxWhiff();
      break;
  }

  // Tempo change sounds
  if (outcome.tempoChange.defender > 0 || outcome.tempoChange.attacker > 0) {
    sfxTempoGain();
  }

  // ── Log flavor text ──
  const attackerName = world.names.get(outcome.attackerId)?.display ?? 'Unknown';
  const defenderName = world.names.get(outcome.defenderId)?.display ?? 'Unknown';
  const flavor = generateCombatFlavor(outcome, attackerName, defenderName, playerTaijutsu, targetTaijutsu);

  const playerIsAttacker = outcome.attackerId === playerId;
  const playerIsDefender = outcome.defenderId === playerId;

  let logCategory: import('../types/actions.ts').LogCategory;
  switch (outcome.type) {
    case 'perfect_parry':
      logCategory = playerIsDefender ? 'miss_incoming' : 'miss_outgoing'; break;
    case 'tempo_save':
      logCategory = 'combat_tempo'; break;
    case 'imperfect_block': case 'clean_hit': case 'clash_tempo_win': case 'clash_rng':
      logCategory = outcome.damage > 0
        ? (playerIsAttacker ? 'hit_outgoing' : 'hit_incoming')
        : (playerIsAttacker ? 'miss_outgoing' : 'miss_incoming');
      break;
    case 'clash_stalemate': case 'circling':
      logCategory = 'combat_neutral'; break;
    case 'missed':
      logCategory = playerIsAttacker ? 'miss_outgoing' : 'miss_incoming'; break;
    default:
      logCategory = 'combat_neutral';
  }

  world.log(flavor, logCategory);

  // ── Floating speech bubbles over combatants ──
  {
    const defPos = world.positions.get(outcome.defenderId);
    const atkPos = world.positions.get(outcome.attackerId);
    const defSquad = world.squadMembers.get(outcome.defenderId);
    const atkSquad = world.squadMembers.get(outcome.attackerId);

    // Defender reacts to being hit
    if (outcome.damage > 0 && defPos) {
      const lines = defSquad
        ? SQUAD_COMBAT_LINES[defSquad.personality].hit
        : ['Argh!', 'Tch!', 'Ngh!', 'Gah!', 'Kuh!'];
      spawnFloatingText(defPos.x, defPos.y, lines[Math.floor(Math.random() * lines.length)], defSquad ? '#66aaff' : '#ff6666');
    }

    // Attacker reacts on whiff/parry
    if (outcome.type === 'perfect_parry' && atkPos) {
      const PARRY_REACTIONS = ['What?!', 'Tch!', 'Fast...!'];
      spawnFloatingText(atkPos.x, atkPos.y, PARRY_REACTIONS[Math.floor(Math.random() * PARRY_REACTIONS.length)], '#aaaaaa');
    }

    // Critical hit — attacker exclaims
    if (outcome.isCritical && atkPos) {
      const lines = atkSquad
        ? SQUAD_COMBAT_LINES[atkSquad.personality].kill
        : ['Hah!', 'There!', 'Got you!', 'Take this!'];
      spawnFloatingText(atkPos.x, atkPos.y, lines[Math.floor(Math.random() * lines.length)], '#ffcc44');
    }
  }

  // Log crit and condition separately
  if (outcome.isCritical) {
    const critFlavor = generateCritFlavor(attackerName, defenderName, playerTaijutsu, targetTaijutsu);
    world.log(critFlavor, 'hit_outgoing');

    if (outcome.conditionApplied) {
      const condFlavor = generateConditionFlavor(defenderName, outcome.conditionApplied);
      world.log(condFlavor, outcome.defenderId === playerId ? 'hit_incoming' : 'hit_outgoing');
    }
  }

  // ── Skill improvement ──
  if (playerSheet) {
    const rate = isDummy
      ? SKILL_IMPROVEMENT_RATES.taijutsu_dummy
      : (targetTaijutsu >= playerTaijutsu
        ? SKILL_IMPROVEMENT_RATES.taijutsu_spar
        : SKILL_IMPROVEMENT_RATES.taijutsu_dummy);

    const mxp = getMissionXpMultiplier(world.missionLog);
    const oldTai = playerSheet.skills.taijutsu;
    const oldPhy = playerSheet.stats.phy;
    playerSheet.skills.taijutsu = computeImprovement(oldTai, rate, 2.0, mxp);
    playerSheet.stats.phy = computeImprovement(oldPhy, STAT_IMPROVEMENT_RATES.phy_combat, 2.0, mxp);
    checkSkillUp(world, 'taijutsu', oldTai, playerSheet.skills.taijutsu);
    checkSkillUp(world, 'phy', oldPhy, playerSheet.stats.phy);
  }

  // ── Tick conditions down ──
  if (playerCond.turnsRemaining > 0) {
    playerCond.turnsRemaining--;
    if (playerCond.turnsRemaining <= 0) playerCond.condition = null;
  }
  if (targetCond.turnsRemaining > 0) {
    targetCond.turnsRemaining--;
    if (targetCond.turnsRemaining <= 0) targetCond.condition = null;
  }

  // ── State check (centralized) ──
  const destructible = world.destructibles.get(targetId);
  if (destructible) {
    if (outcome.damage >= DUMMY_DESTROY_THRESHOLD) {
      world.log(destructible.onDestroyMessage, 'system');
      world.destroyEntity(targetId);
      engagements.delete(engagementKey(playerId, targetId));
    }
  } else {
    const stateChange = checkEntityState(world, targetId);
    if (stateChange) {
      engagements.delete(engagementKey(playerId, targetId));
    }
  }

  // Also check player state (damage from NPC attacks)
  checkEntityState(world, playerId);

  // ── Stamina restoration ──
  // If player didn't attack (defended/parried), check rest-based regen
  const res = world.resources.get(playerId);
  if (res) {
    const ticksSinceExertion = world.currentTick - res.lastExertionTick;
    if (ticksSinceExertion >= STAMINA_REST_TICKS && res.stamina < res.staminaCeiling) {
      const regenAmount = res.maxStamina * STAMINA_RESTORE_RATE;
      res.stamina = Math.min(res.staminaCeiling, res.stamina + regenAmount);
    }
    // Chakra restoration (mirrors stamina)
    const ticksSinceChakraUse = world.currentTick - res.lastChakraExertionTick;
    if (ticksSinceChakraUse >= CHAKRA_REST_TICKS && res.chakra < res.chakraCeiling) {
      const chakraRegen = res.maxChakra * CHAKRA_RESTORE_RATE;
      res.chakra = Math.min(res.chakraCeiling, res.chakra + chakraRegen);
    }
  }

  eng.round++;

  // Every 3 passes (1 tick / 6s), log NPC condition observation
  if (eng.round % 3 === 0 && !isDummy) {
    const targetName = world.names.get(targetId)?.display ?? 'Your opponent';
    const targetHp = world.healths.get(targetId);
    if (targetHp) {
      const obs = generateNpcObservation(targetName, targetHp.current, targetHp.max);
      world.log(obs, 'info');
    }
    // Bleeding observation
    const targetBleed = world.bleeding.get(targetId);
    if (targetBleed) {
      const bleedMsg = targetBleed.intensity >= 5
        ? `${targetName} is bleeding profusely — blood spatters with every movement.`
        : `${targetName} is bleeding from open wounds.`;
      world.log(bleedMsg, 'bleed');
    }
    // Blood level observation
    const targetRes = world.resources.get(targetId);
    if (targetRes && targetRes.blood < targetRes.maxBlood * 0.7) {
      const bloodPct = targetRes.blood / targetRes.maxBlood;
      const bloodMsg = bloodPct <= 0.3
        ? `${targetName}'s skin is white as paper. They're fading.`
        : `${targetName} is getting pale from blood loss.`;
      world.log(bloodMsg, 'bleed');
    }
  }

  // Combat pass = 4 subticks (2s). Stays within a coarse tick so NPCs don't react.
  world.advanceTime(COMBAT_PASS_SUBTICKS, 2);

  // Tick bleeding for all entities (always runs in combat)
  tickBleeding(world);

  return true;
}

/** Get the player's current condition if in an engagement */
export function getPlayerCondition(world: World): import('../types/combat.ts').CombatCondition | null {
  const targetId = findAdjacentTarget(world);
  if (targetId === null) return null;
  const key = engagementKey(world.playerEntityId, targetId);
  const eng = engagements.get(key);
  if (!eng) return null;
  const cond = eng.entityA === world.playerEntityId ? eng.conditionA : eng.conditionB;
  return cond.condition;
}

/** Get the player's current tempo state if in an engagement */
export function getPlayerTempo(world: World): TempoState | null {
  const targetId = findAdjacentTarget(world);
  if (targetId === null) return null;
  const key = engagementKey(world.playerEntityId, targetId);
  const eng = engagements.get(key);
  if (!eng) return null;
  return eng.entityA === world.playerEntityId ? eng.tempoA : eng.tempoB;
}

/** Get all active engagement data for rendering overlays */
export function getActiveEngagements(): Map<string, CombatEngagement> {
  return engagements;
}

/** Clear engagements when entities move apart */
export function clearStaleEngagements(world: World): void {
  for (const [key, eng] of engagements) {
    const posA = world.positions.get(eng.entityA);
    const posB = world.positions.get(eng.entityB);
    if (!posA || !posB) { engagements.delete(key); continue; }
    if (Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y - posB.y)) > 1) {
      engagements.delete(key);
    }
  }
}

/** Create a combat engagement initiated by an NPC (e.g. chasing enemy reaches player).
 *  Returns true if the engagement was newly created (first contact). */
export function initiateNpcEngagement(world: World, npcId: EntityId, playerId: EntityId): boolean {
  const key = engagementKey(npcId, playerId);
  if (engagements.has(key)) return false; // already engaged
  getOrCreateEngagement(world, npcId, playerId);
  return true;
}

/** Check if a specific entity is in any active combat engagement */
export function isInCombat(entityId: EntityId): boolean {
  for (const [, eng] of engagements) {
    if (eng.entityA === entityId || eng.entityB === entityId) return true;
  }
  return false;
}

/** Clear ALL engagements involving a specific entity (used on respawn/teleport) */
export function clearEntityEngagements(entityId: EntityId): void {
  for (const [key, eng] of engagements) {
    if (eng.entityA === entityId || eng.entityB === entityId) {
      engagements.delete(key);
    }
  }
}
