/**
 * Surprise Attack System — handles sneak attacks (subdue / assassinate).
 *
 * When the player approaches an NPC from behind (NPC facing away),
 * they can perform a surprise attack: 2 rounds of amplified damage.
 *
 * Damage multiplier tiers:
 *   taijutsu <  41 → x3
 *   taijutsu 41-60 → x5
 *   taijutsu >= 61 → x7
 *
 * Tempo dampening: the target's initial tempo beads absorb 1x damage each,
 * meaning a skilled opponent may partially or fully parry the surprise attack
 * even when caught off-guard (their instincts kick in).
 */

import type { World } from './world.ts';
import type { EntityId } from '../types/ecs.ts';
import type { Direction } from '../types/ecs.ts';
import { calculateDamage, startingTempo } from '../types/combat.ts';
import { checkEntityState, killEntity } from './entityState.ts';
import { applyBleeding } from './entityState.ts';
import { getSubdueTime } from './reactionSystem.ts';
import { cellHash } from '../sprites/pixelPatterns.ts';
import { sfxPunchHit, sfxKickHit, sfxCritical } from '../systems/audioSystem.ts';

// ── TYPES ──

export interface SurpriseAttackResult {
  success: boolean;
  targetKO: boolean;        // true if target went to 0 HP
  targetDead: boolean;       // true if target died (kill intent)
  totalDamage: number;
  damagePercent: number;     // percent of max HP dealt
  tempoAbsorbed: number;     // how many hits were absorbed by tempo
  message: string;
}

// ── DIRECTION HELPERS ──

/** Get the opposite direction */
function oppositeDirection(dir: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
    'n': 's', 's': 'n', 'e': 'w', 'w': 'e',
    'ne': 'sw', 'sw': 'ne', 'nw': 'se', 'se': 'nw',
  };
  return opposites[dir];
}

/** Check if an NPC is facing away from a position (player can approach from behind) */
export function isFacingAway(npcFacing: Direction, npcX: number, npcY: number, approachX: number, approachY: number): boolean {
  const dx = approachX - npcX;
  const dy = approachY - npcY;

  // Determine the direction FROM the NPC TO the approaching entity
  const approachDir = vectorToApproachDirection(dx, dy);
  if (!approachDir) return false;

  // The NPC's "back" is the opposite of where they're facing
  // If the player approaches from the direction the NPC is facing, the NPC sees them
  // If the player approaches from behind (opposite of NPC facing), it's a surprise

  // NPC facing north means their back is south — player approaching from south = behind
  const npcBack = oppositeDirection(npcFacing);
  return approachDir === npcBack || isAdjacentDirection(approachDir, npcBack);
}

/** Check if two directions are adjacent (e.g., n and ne, or n and nw) */
function isAdjacentDirection(a: Direction, b: Direction): boolean {
  const adjacency: Record<Direction, Direction[]> = {
    'n': ['nw', 'ne'],
    's': ['sw', 'se'],
    'e': ['ne', 'se'],
    'w': ['nw', 'sw'],
    'ne': ['n', 'e'],
    'nw': ['n', 'w'],
    'se': ['s', 'e'],
    'sw': ['s', 'w'],
  };
  return adjacency[a]?.includes(b) ?? false;
}

function vectorToApproachDirection(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === 0) return null;
  if (dx === 0 && dy < 0) return 'n';
  if (dx === 0 && dy > 0) return 's';
  if (dx > 0 && dy === 0) return 'e';
  if (dx < 0 && dy === 0) return 'w';
  if (dx > 0 && dy < 0) return 'ne';
  if (dx < 0 && dy < 0) return 'nw';
  if (dx > 0 && dy > 0) return 'se';
  if (dx < 0 && dy > 0) return 'sw';
  return null;
}

// ── DAMAGE MULTIPLIER ──

function getSurpriseDamageMultiplier(taijutsu: number): number {
  if (taijutsu >= 61) return 7;
  if (taijutsu >= 41) return 5;
  return 3;
}

// ── MAIN SURPRISE ATTACK ──

/**
 * Execute a surprise attack (subdue or assassinate) on a target.
 * 2 rounds of amplified clean hits, dampened by target's tempo beads.
 */
export function executeSurpriseAttack(
  world: World,
  attackerId: EntityId,
  targetId: EntityId,
  isLethal: boolean,
): SurpriseAttackResult {
  const attackerSheet = world.characterSheets.get(attackerId);
  const targetSheet = world.characterSheets.get(targetId);
  const attackerTaijutsu = attackerSheet?.skills.taijutsu ?? 10;
  const targetTaijutsu = targetSheet?.skills.taijutsu ?? 10;
  const attackerPhy = attackerSheet?.stats.phy ?? 10;
  const targetHp = world.healths.get(targetId);
  const attackerName = world.names.get(attackerId)?.display ?? 'You';
  const targetName = world.names.get(targetId)?.display ?? 'the target';

  if (!targetHp) {
    return { success: false, targetKO: false, targetDead: false, totalDamage: 0, damagePercent: 0, tempoAbsorbed: 0, message: 'Invalid target.' };
  }

  const maxHp = targetHp.max;
  const multiplier = getSurpriseDamageMultiplier(attackerTaijutsu);

  // Calculate tempo dampening (target's defensive instinct)
  const targetStartingTempo = startingTempo(targetTaijutsu, attackerTaijutsu);
  let tempoBeadsRemaining = targetStartingTempo;

  // 2 rounds of strikes
  let totalDamage = 0;
  let tempoAbsorbed = 0;
  const seed = cellHash(world.currentTick, targetId);

  for (let round = 0; round < 2; round++) {
    const baseDmg = calculateDamage(attackerTaijutsu, attackerPhy);
    const amplifiedDmg = baseDmg * multiplier;

    if (tempoBeadsRemaining > 0) {
      // Tempo absorbs 1x base damage worth per bead
      tempoBeadsRemaining--;
      tempoAbsorbed++;
      // Partial damage: amplified minus 1x base absorbed
      const absorbed = baseDmg;
      const actualDmg = Math.max(0, amplifiedDmg - absorbed);
      totalDamage += actualDmg;

      if (actualDmg > 0) {
        // Partial parry flavor
        const partialFlavor = pickParryFlavor(targetName, round, false, seed + round);
        world.log(partialFlavor, 'combat_neutral');
      } else {
        // Full parry — this bead absorbed everything
        const fullParryFlavor = pickParryFlavor(targetName, round, true, seed + round);
        world.log(fullParryFlavor, 'miss_outgoing');
      }
    } else {
      // Clean amplified hit
      totalDamage += amplifiedDmg;
      sfxCritical();
    }
  }

  // Apply damage
  targetHp.current = Math.max(0, targetHp.current - totalDamage);
  const damagePercent = totalDamage / maxHp;

  // Bleeding on lethal attempts
  if (isLethal && totalDamage > 0) {
    const bleedIntensity = 4 + Math.floor(Math.random() * 4); // 4-7
    applyBleeding(world, targetId, bleedIntensity, true);
  }

  // Log the strike flavor
  if (totalDamage > 0) {
    const strikeFlavor = isLethal
      ? pickAssassinateFlavor(attackerName, targetName, damagePercent, seed)
      : pickSubdueFlavor(attackerName, targetName, damagePercent, seed);
    world.log(strikeFlavor, 'hit_outgoing');
  }

  // Check if target goes down
  let targetKO = false;
  let targetDead = false;
  const stateChange = checkEntityState(world, targetId);

  if (stateChange?.type === 'unconscious') {
    targetKO = true;
    if (isLethal) {
      // Lethal intent + KO = kill
      killEntity(world, targetId, attackerId, true);
      targetDead = true;
    }
  } else if (stateChange?.type === 'dead') {
    targetDead = true;
    targetKO = true;
  }

  // Damage assessment flavor
  if (!targetKO && totalDamage > 0) {
    const assessFlavor = pickDamageAssessment(targetName, damagePercent, seed);
    world.log(assessFlavor, targetDead ? 'hit_outgoing' : 'combat_neutral');
  }

  // Time cost: taijutsu-scaled (counts as a free combat move)
  world.currentTick += getSubdueTime(world, attackerId);

  // Sound
  if (totalDamage > 0 && tempoAbsorbed < 2) {
    Math.random() < 0.5 ? sfxPunchHit() : sfxKickHit();
  }

  return {
    success: true,
    targetKO,
    targetDead,
    totalDamage,
    damagePercent,
    tempoAbsorbed,
    message: '',
  };
}

// ── NPC PERCEPTION ──

/**
 * Check if an NPC can perceive the player at a given distance.
 * Returns true if the NPC is aware of the player's presence.
 * For now: all conscious, non-invisible NPCs perceive the player within 2 tiles
 * unless the player is invisible/stealthy (to be expanded later).
 */
export function canNpcPerceivePlayer(world: World, npcId: EntityId): boolean {
  // Unconscious/dead NPCs can't perceive
  if (world.unconscious.has(npcId) || world.dead.has(npcId)) return false;
  // Restrained NPCs can't react
  if (world.restrained.has(npcId)) return false;

  // If player is invisible, NPC can't detect
  if (world.invisible.has(world.playerEntityId)) {
    const inv = world.invisible.get(world.playerEntityId)!;
    const npcSheet = world.characterSheets.get(npcId);
    const npcNinjutsu = npcSheet?.skills.ninjutsu ?? 0;
    if (npcNinjutsu < inv.casterNinjutsu + 5) return false;
  }

  return true;
}

/**
 * Make an NPC face toward the player if within perception range (2 tiles).
 * Returns true if the NPC turned to face the player.
 */
export function npcFaceTowardPlayer(world: World, npcId: EntityId): boolean {
  if (!canNpcPerceivePlayer(world, npcId)) return false;

  const npcPos = world.positions.get(npcId);
  const playerPos = world.positions.get(world.playerEntityId);
  if (!npcPos || !playerPos) return false;

  const dist = Math.max(Math.abs(npcPos.x - playerPos.x), Math.abs(npcPos.y - playerPos.y));
  if (dist > 2) return false;

  // Calculate direction to player
  const dx = playerPos.x - npcPos.x;
  const dy = playerPos.y - npcPos.y;
  const dir = vectorToApproachDirection(dx, dy);
  if (!dir) return false;

  // Already facing player
  if (npcPos.facing === dir) return false;

  // Turn to face
  npcPos.facing = dir;

  // Update sprite
  const anchor = world.anchors.get(npcId);
  const renderable = world.renderables.get(npcId);
  if (renderable && anchor) {
    const cardinal = dirToCardinal(dir);
    renderable.spriteId = `${anchor.spritePrefix}_${cardinal}`;
  }

  return true;
}

function dirToCardinal(dir: Direction): 'n' | 's' | 'e' | 'w' {
  switch (dir) {
    case 'n': case 'nw': case 'ne': return 'n';
    case 's': case 'sw': case 'se': return 's';
    case 'e': return 'e';
    case 'w': return 'w';
  }
}

/**
 * Check if the player can perform a surprise attack on an adjacent NPC.
 * The NPC must be facing away from the player.
 */
export function canSurpriseAttack(world: World, targetId: EntityId): boolean {
  const playerPos = world.positions.get(world.playerEntityId);
  const targetPos = world.positions.get(targetId);
  if (!playerPos || !targetPos) return false;

  // Must be adjacent
  const dist = Math.max(Math.abs(playerPos.x - targetPos.x), Math.abs(playerPos.y - targetPos.y));
  if (dist !== 1) return false;

  // Target must be alive and conscious
  if (world.unconscious.has(targetId) || world.dead.has(targetId)) return false;

  // Must be facing away from player
  return isFacingAway(targetPos.facing, targetPos.x, targetPos.y, playerPos.x, playerPos.y);
}

// ── FLAVOR TEXT POOLS ──

// -- Subdue flavor (non-lethal) --

const SUBDUE_CRITICAL: string[] = [
  '{attacker} slams a palm strike into the base of {target}\'s skull. A devastating blow.',
  'A vicious combination — elbow to the temple, knee to the gut. {target} folds.',
  '{attacker} locks {target}\'s arm behind their back and drives them face-first into the ground.',
  'A precise strike to the nerve cluster at {target}\'s neck. Their body goes limp.',
  '{attacker} catches {target} in a chokehold from behind. Legs kick, then go still.',
  'Two rapid blows — solar plexus, then jaw. {target} crumples like a puppet with cut strings.',
];

const SUBDUE_HEAVY: string[] = [
  '{attacker} drives a fist into {target}\'s kidney from behind. A sickening sound.',
  'A sharp elbow to {target}\'s spine sends them staggering forward.',
  '{attacker} sweeps {target}\'s legs and follows with a hammerfist to the chest.',
  'A heavy combination rattles {target} — two body blows from their blind spot.',
  '{attacker} locks an arm around {target}\'s throat. They thrash, but the grip holds.',
];

const SUBDUE_LIGHT: string[] = [
  '{attacker} shoves {target} from behind, but they stumble forward and catch themselves.',
  'A clumsy grab — {target} twists free before {attacker} can get a proper hold.',
  '{attacker}\'s strike grazes {target}\'s shoulder. Barely a scratch.',
  'The surprise blow glances off. {target} staggers but stays upright.',
  '{attacker} catches {target} off-guard, but the strike lacks real force.',
];

// -- Assassinate flavor (lethal) --

const ASSASSINATE_CRITICAL: string[] = [
  '{attacker}\'s kunai finds the gap between {target}\'s shoulder blades. A killing strike.',
  'Steel flashes in the dim light. {target}\'s throat opens in a red arc.',
  '{attacker} drives the kunai deep into {target}\'s back. They never saw it coming.',
  'A silent thrust beneath the ribs. {target}\'s legs buckle as the blade does its work.',
  'Two precise stabs — kidney, then liver. {target} drops without a sound.',
  'The kunai traces a lethal arc across {target}\'s neck. It\'s over before they know.',
];

const ASSASSINATE_HEAVY: string[] = [
  '{attacker} plunges the kunai into {target}\'s back. Dark blood wells up immediately.',
  'A savage slash across {target}\'s side opens a deep wound. They gasp.',
  'The blade sinks into {target}\'s shoulder — deep, but not deep enough.',
  '{attacker} stabs twice in rapid succession. {target} lurches forward, bleeding badly.',
  'A vicious kunai strike from behind — the wound is serious but not immediately fatal.',
];

const ASSASSINATE_LIGHT: string[] = [
  'The kunai catches {target}\'s clothing more than flesh. A shallow cut at best.',
  '{attacker}\'s blade skids off something — armor, bone, luck. A graze.',
  'The strike was clean but the angle was wrong. {target} takes a nick, nothing more.',
  '{attacker} lunges with the kunai but {target} shifts at the last moment. Barely a scratch.',
];

// -- Parry flavor (tempo absorption) --

const PARTIAL_PARRY: string[] = [
  '{target} senses something at the last instant — their body shifts, absorbing part of the blow.',
  'Instinct kicks in. {target}\'s training takes over and they twist away from the worst of it.',
  '{target}\'s reflexes are sharp — even caught off-guard, they deflect part of the strike.',
  'A flicker of awareness — {target} moves just enough to reduce the impact.',
  '{target}\'s body reacts before their mind does. The blow lands, but not cleanly.',
];

const FULL_PARRY: string[] = [
  '{target}\'s hand snaps up and catches {attacker}\'s wrist mid-strike. The ease of it is terrifying.',
  'Before the blow lands, {target} has already sidestepped. They felt it coming.',
  '{target} deflects the attack with casual precision. The skill gap is overwhelming.',
  'The strike never connects. {target} moves like smoke — there and then not.',
  '{target} turns with supernatural speed and blocks everything. Their instincts are on another level.',
  'It\'s like hitting air. {target}\'s combat sense is so refined, surprise barely matters.',
];

// -- Damage assessment --

const DAMAGE_GRAZE: string[] = [
  '{target} barely seems to notice. That was nothing.',
  'A scratch at best. {target} shakes it off.',
  '{target} flinches but recovers immediately. Barely felt.',
];

const DAMAGE_LIGHT: string[] = [
  '{target} stumbles but stays on their feet, surprised and alert.',
  'Not enough to bring them down, but {target} is hurting.',
  '{target} grunts in pain and spins around, guard up.',
];

const DAMAGE_HEAVY: string[] = [
  '{target} staggers badly, bleeding and barely keeping their feet.',
  'A devastating strike — {target} is reeling, one more hit could finish it.',
  '{target}\'s legs shake. They\'re hurt badly but still conscious through sheer will.',
];

function pickSubdueFlavor(attacker: string, target: string, damagePct: number, seed: number): string {
  const pool = damagePct >= 0.8 ? SUBDUE_CRITICAL : damagePct >= 0.3 ? SUBDUE_HEAVY : SUBDUE_LIGHT;
  return pool[seed % pool.length].replace(/\{attacker\}/g, attacker).replace(/\{target\}/g, target);
}

function pickAssassinateFlavor(attacker: string, target: string, damagePct: number, seed: number): string {
  const pool = damagePct >= 0.8 ? ASSASSINATE_CRITICAL : damagePct >= 0.3 ? ASSASSINATE_HEAVY : ASSASSINATE_LIGHT;
  return pool[seed % pool.length].replace(/\{attacker\}/g, attacker).replace(/\{target\}/g, target);
}

function pickParryFlavor(target: string, _round: number, fullParry: boolean, seed: number): string {
  const pool = fullParry ? FULL_PARRY : PARTIAL_PARRY;
  return pool[seed % pool.length].replace(/\{target\}/g, target).replace(/\{attacker\}/g, 'you');
}

function pickDamageAssessment(target: string, damagePct: number, seed: number): string {
  const pool = damagePct >= 0.6 ? DAMAGE_HEAVY : damagePct >= 0.15 ? DAMAGE_LIGHT : DAMAGE_GRAZE;
  return pool[seed % pool.length].replace(/\{target\}/g, target);
}
