/**
 * Projectile system — spawns, advances, and resolves thrown weapons (kunai, shuriken).
 *
 * Projectiles travel tile-by-tile along a Bresenham path each subtick (speed-gated).
 * On arrival at the target tile, hit resolution checks evasion and applies damage.
 */

import type { World } from '../engine/world.ts';
import type { EntityId } from '../types/ecs.ts';
import type { ThrownWeaponType, ProjectileComponent } from '../types/throwing.ts';
import { THROWN_WEAPON_DATA, getThrowCooldown } from '../types/throwing.ts';
import { hasLethalIntent } from '../engine/combatSystem.ts';
import { checkEntityState, applyBleeding, killEntity } from '../engine/entityState.ts';
import { spawnFloatingText } from './floatingTextSystem.ts';
import { computeImprovement, SKILL_IMPROVEMENT_RATES } from '../types/character.ts';
import { sfxMenuClick, sfxProjectileParry, sfxProjectileDummyHit, sfxProjectileFleshHit } from './audioSystem.ts';
import { getMissionXpMultiplier } from '../engine/missions.ts';
import { checkSkillUp } from '../engine/skillFeedback.ts';

// ── Flavor text pools ──

const THROW_SOUNDS = ['Whoosh!', 'Whizz!', 'Fwip!', 'Shing!'];
const HIT_SOUNDS = ['Thunk!', 'Shink!', 'Shlick!'];
const MISS_SOUNDS = ['Clang!', 'Tink!', 'Whiff!'];
const KILL_TEXTS = ['Critical!', 'Lethal strike!'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Bresenham path generation ──

/** Generate a Bresenham line path from (x1,y1) to (x2,y2), excluding the start tile */
function bresenhamPath(x1: number, y1: number, x2: number, y2: number): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  let cx = x1;
  let cy = y1;

  while (cx !== x2 || cy !== y2) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
    path.push({ x: cx, y: cy });
  }

  return path;
}

// ── Spawn ──

/**
 * Spawn a projectile entity that will travel from source to target tile.
 * Consumes 1 ammo from the source entity. Sets throw cooldown.
 * Returns the projectile entity ID, or null if spawn failed.
 */
export function spawnProjectile(
  world: World,
  sourceId: EntityId,
  weaponType: ThrownWeaponType,
  targetX: number,
  targetY: number,
): EntityId | null {
  // Consume ammo
  const ammo = world.thrownAmmo.get(sourceId);
  if (!ammo || ammo[weaponType] <= 0) return null;
  ammo[weaponType]--;

  const sourcePos = world.positions.get(sourceId);
  if (!sourcePos) return null;

  const stats = THROWN_WEAPON_DATA[weaponType];
  const path = bresenhamPath(sourcePos.x, sourcePos.y, targetX, targetY);
  if (path.length === 0) return null;

  // Create projectile entity
  const projId = world.createEntity();

  // Position starts at source (will advance on first tick)
  world.setPosition(projId, { x: sourcePos.x, y: sourcePos.y, facing: 'n' });

  // Renderable — effect layer, will be drawn as projectile sprite
  const dx = targetX - sourcePos.x;
  const dy = targetY - sourcePos.y;
  const spriteDir = getSpriteDirection(dx, dy);
  world.renderables.set(projId, {
    spriteId: `${weaponType}_${spriteDir}`,
    layer: 'effect',
    offsetY: -8,  // slightly above ground
  });

  // Projectile component
  const lethal = hasLethalIntent(world, sourceId);
  const proj: ProjectileComponent = {
    weaponType,
    sourceId,
    targetTile: { x: targetX, y: targetY },
    path,
    pathIndex: 0,
    damage: stats.damage,
    evasionPenalty: stats.evasionPenalty,
    lethal,
    lastMoveSubtick: world.currentSubtick,
    speed: stats.speed,
  };
  world.projectiles.set(projId, proj);

  // Set throw cooldown
  const sheet = world.characterSheets.get(sourceId);
  const bukijutsu = sheet?.skills.bukijutsu ?? 1;
  const cooldownSubticks = getThrowCooldown(bukijutsu);
  world.throwCooldowns.set(sourceId, {
    readyAtSubtick: world.currentSubtick + cooldownSubticks,
    totalSubticks: cooldownSubticks,
  });

  // ── Bukijutsu skill improvement (10× taijutsu punch rate) ──
  if (sheet) {
    const mxp = getMissionXpMultiplier(world.missionLog);
    const oldBuki = sheet.skills.bukijutsu;
    sheet.skills.bukijutsu = computeImprovement(
      oldBuki, SKILL_IMPROVEMENT_RATES.bukijutsu_throw, 2.0, mxp,
    );
    checkSkillUp(world, 'bukijutsu', oldBuki, sheet.skills.bukijutsu);
  }

  // Floating text + sound at source
  spawnFloatingText(sourcePos.x, sourcePos.y, pickRandom(THROW_SOUNDS), '#aaddff');
  sfxMenuClick();

  return projId;
}

/** Determine sprite direction suffix from dx/dy */
function getSpriteDirection(dx: number, dy: number): string {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  if (ax > ay * 2) return dx > 0 ? 'e' : 'w';
  if (ay > ax * 2) return dy > 0 ? 's' : 'n';
  if (dx > 0 && dy > 0) return 'se';
  if (dx > 0 && dy < 0) return 'ne';
  if (dx < 0 && dy > 0) return 'sw';
  return 'nw';
}

// ── Tick ──

/**
 * Advance all active projectiles. Call every subtick from the turn system.
 * Projectiles move along their path based on speed (subticks per tile).
 */
export function tickProjectiles(world: World): void {
  const toRemove: EntityId[] = [];

  for (const [projId, proj] of world.projectiles) {
    // Speed gate — only move if enough subticks have passed
    const elapsed = world.currentSubtick - proj.lastMoveSubtick;
    if (elapsed < proj.speed) continue;

    proj.lastMoveSubtick = world.currentSubtick;

    // Advance along path
    if (proj.pathIndex >= proj.path.length) {
      // Past end of path — remove
      toRemove.push(projId);
      continue;
    }

    const nextTile = proj.path[proj.pathIndex];
    proj.pathIndex++;

    // Move projectile entity
    const oldPos = world.positions.get(projId);
    if (oldPos) {
      world.moveInGrid(projId, oldPos.x, oldPos.y, nextTile.x, nextTile.y);
    }
    world.positions.set(projId, { x: nextTile.x, y: nextTile.y, facing: 'n' });

    // Check if we hit a wall/obstacle
    if (!world.tileMap.isTransparent(nextTile.x, nextTile.y)) {
      spawnFloatingText(nextTile.x, nextTile.y, pickRandom(MISS_SOUNDS), '#888888');
      toRemove.push(projId);
      continue;
    }

    // Check if we hit an entity at this tile
    const entitiesAtTile = world.getEntitiesAt(nextTile.x, nextTile.y);
    for (const eid of entitiesAtTile) {
      if (eid === projId) continue;         // Skip self
      if (eid === proj.sourceId) continue;  // Don't hit thrower
      if (world.projectiles.has(eid)) continue; // Skip other projectiles

      // Only hit things with health that are alive
      const hp = world.healths.get(eid);
      if (!hp || hp.current <= 0) continue;
      if (world.dead.has(eid)) continue;

      // Don't hit allies of the thrower
      if (world.squadMembers.has(proj.sourceId) && world.squadMembers.has(eid)) continue;
      if (world.squadMembers.has(proj.sourceId) && eid === world.playerEntityId) continue;
      if (proj.sourceId === world.playerEntityId && world.squadMembers.has(eid)) continue;

      // Don't hit fellow enemies if thrower is an enemy
      if (world.aggros.has(proj.sourceId) && world.aggros.has(eid) &&
          proj.sourceId !== world.playerEntityId && eid !== world.playerEntityId) continue;

      // Hit resolution
      resolveProjectileHit(world, projId, proj, eid);
      toRemove.push(projId);
      break; // Stop at first entity hit
    }

    // Check if we've reached the target tile (end of path)
    if (proj.pathIndex >= proj.path.length && !toRemove.includes(projId)) {
      // Reached target but didn't hit anything — projectile falls
      spawnFloatingText(nextTile.x, nextTile.y, pickRandom(MISS_SOUNDS), '#888888');
      toRemove.push(projId);
    }
  }

  // Clean up
  for (const projId of toRemove) {
    world.projectiles.delete(projId);
    world.destroyEntity(projId);
  }
}

// ── Hit Resolution ──

function resolveProjectileHit(
  world: World,
  _projId: EntityId,
  proj: ProjectileComponent,
  targetId: EntityId,
): void {
  const targetPos = world.positions.get(targetId);
  if (!targetPos) return;

  // Evasion check: target's taijutsu-based dodge vs weapon's evasion penalty
  const targetSheet = world.characterSheets.get(targetId);
  const baseDodge = targetSheet ? Math.min(50, targetSheet.skills.taijutsu * 0.5) : 10;
  const finalDodge = Math.max(0, baseDodge - proj.evasionPenalty);

  if (Math.random() * 100 < finalDodge) {
    // Dodged / parried!
    spawnFloatingText(targetPos.x, targetPos.y, pickRandom(MISS_SOUNDS), '#ffaa44');
    sfxProjectileParry();
    const targetName = world.names.get(targetId)?.display ?? 'the target';
    const weaponName = proj.weaponType === 'kunai' ? 'kunai' : 'shuriken';
    world.log(`${targetName} dodges the ${weaponName}!`, 'info');
    return;
  }

  // Hit!
  const hp = world.healths.get(targetId);
  if (!hp) return;

  // Calculate damage — base + bukijutsu scaling from thrower
  const sourceSheet = world.characterSheets.get(proj.sourceId);
  const bukijutsu = sourceSheet?.skills.bukijutsu ?? 1;
  let finalDamage = proj.damage + Math.floor(bukijutsu * 0.3);

  // Lethal intent: +20% damage
  if (proj.lethal) {
    finalDamage = Math.round(finalDamage * 1.2);
  }

  hp.current = Math.max(0, hp.current - finalDamage);

  // Floating text + impact sound
  spawnFloatingText(targetPos.x, targetPos.y, pickRandom(HIT_SOUNDS), '#ff4444');
  if (world.destructibles.has(targetId)) {
    sfxProjectileDummyHit();
  } else {
    sfxProjectileFleshHit();
  }

  // Log
  const sourceName = world.names.get(proj.sourceId)?.display ?? 'Someone';
  const targetName = world.names.get(targetId)?.display ?? 'the target';
  const weaponName = proj.weaponType === 'kunai' ? 'kunai' : 'shuriken';
  const category = proj.sourceId === world.playerEntityId ? 'hit_outgoing' : (
    targetId === world.playerEntityId ? 'hit_incoming' : 'info'
  );
  world.log(`${sourceName}'s ${weaponName} strikes ${targetName} for ${finalDamage} damage!`, category as 'hit_outgoing' | 'hit_incoming' | 'info');

  // Blood decal at impact
  spawnBloodDecal(world, targetPos.x, targetPos.y);

  // Bleeding chance with lethal intent
  if (proj.lethal) {
    const bleedChance = 0.25 + bukijutsu / 200;
    if (Math.random() < bleedChance) {
      const intensity = 3 + Math.floor(Math.random() * 5);
      applyBleeding(world, targetId, intensity, true);
    }
  }

  // Kill chance on KO with lethal intent
  if (hp.current <= 0 && proj.lethal) {
    const killChance = 0.30 + bukijutsu / 200;
    if (Math.random() < killChance) {
      spawnFloatingText(targetPos.x, targetPos.y, pickRandom(KILL_TEXTS), '#ff0000');
      const killMsgs = [
        `The ${weaponName} buries itself deep. ${targetName} falls.`,
        `A perfect throw. ${targetName} doesn't get up.`,
        `The ${weaponName} finds its mark. ${targetName} is finished.`,
      ];
      world.log(pickRandom(killMsgs), category as 'hit_outgoing' | 'hit_incoming' | 'info');
      killEntity(world, targetId, proj.sourceId, true);
    }
  }

  // Check entity state (unconscious, etc.)
  checkEntityState(world, targetId);
}

// ── Blood Decals ──

// Blood dot grid: tile area is divided into a grid of cells.
// Each cell can hold one dot. ~80% fill = saturated.
const BLOOD_GRID_COLS = 12;
const BLOOD_GRID_ROWS = 8;
const BLOOD_MAX_DOTS = Math.floor(BLOOD_GRID_COLS * BLOOD_GRID_ROWS * 0.8); // 76 dots = 80% full

/** Spawn blood dots at the given tile (1-3 random pixel dots, placed in empty grid cells) */
export function spawnBloodDecal(world: World, x: number, y: number, dotCount = 0): void {
  const key = `${x}:${y}`;
  const existing = world.bloodDecals.get(key);
  const count = dotCount > 0 ? dotCount : 1 + Math.floor(Math.random() * 3); // 1-3 dots

  const dots = existing?.dots ?? [];
  if (dots.length >= BLOOD_MAX_DOTS) {
    // Already saturated
    if (existing) existing.spawnTick = world.currentTick;
    return;
  }

  // Track occupied grid cells
  const occupied = new Set<number>();
  for (const dot of dots) {
    const col = Math.floor((dot.dx + 0.45) / 0.9 * BLOOD_GRID_COLS);
    const row = Math.floor((dot.dy + 0.45) / 0.9 * BLOOD_GRID_ROWS);
    occupied.add(row * BLOOD_GRID_COLS + col);
  }

  // Place new dots in random empty cells
  const totalCells = BLOOD_GRID_COLS * BLOOD_GRID_ROWS;
  for (let i = 0; i < count && dots.length < BLOOD_MAX_DOTS; i++) {
    // Try to find an empty cell
    let placed = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const cell = Math.floor(Math.random() * totalCells);
      if (occupied.has(cell)) continue;
      occupied.add(cell);

      const col = cell % BLOOD_GRID_COLS;
      const row = Math.floor(cell / BLOOD_GRID_COLS);
      // Map grid cell to tile offset (-0.45 to 0.45) with small jitter
      const dx = (col / BLOOD_GRID_COLS) * 0.9 - 0.45 + (Math.random() * 0.04 - 0.02);
      const dy = (row / BLOOD_GRID_ROWS) * 0.9 - 0.45 + (Math.random() * 0.04 - 0.02);
      dots.push({ dx, dy, shade: Math.random() });
      placed = true;
      break;
    }
    // If all attempts collided, just skip
    if (!placed) break;
  }

  if (existing) {
    existing.dots = dots;
    existing.spawnTick = world.currentTick;
  } else {
    world.bloodDecals.set(key, { x, y, spawnTick: world.currentTick, dots });
  }
}

/** Remove blood decals older than the configured duration */
export function cleanupBloodDecals(world: World): void {
  // 1 in-game hour = 3600 seconds. Each coarse tick = 3 seconds.
  const maxAgeTicks = 3600 / 3; // 1200 coarse ticks
  const toRemove: string[] = [];

  for (const [key, decal] of world.bloodDecals) {
    if (world.currentTick - decal.spawnTick > maxAgeTicks) {
      toRemove.push(key);
    }
  }

  for (const key of toRemove) {
    world.bloodDecals.delete(key);
  }
}

// ── Helpers ──

/** Check if an entity can throw right now (has ammo + cooldown expired) */
export function canThrow(world: World, entityId: EntityId, weaponType?: ThrownWeaponType): boolean {
  const ammo = world.thrownAmmo.get(entityId);
  if (!ammo) return false;

  if (weaponType) {
    if (ammo[weaponType] <= 0) return false;
  } else {
    if (ammo.kunai <= 0 && ammo.shuriken <= 0) return false;
  }

  const cooldown = world.throwCooldowns.get(entityId);
  if (cooldown && world.currentSubtick < cooldown.readyAtSubtick) return false;

  return true;
}

/** Get list of visible enemy targets for a given entity */
export function getThrowableTargets(world: World, entityId: EntityId): EntityId[] {
  const pos = world.positions.get(entityId);
  if (!pos) return [];

  const targets: EntityId[] = [];
  const isPlayer = entityId === world.playerEntityId;
  const isSquad = world.squadMembers.has(entityId);

  for (const [id] of world.aggros) {
    // Skip allies
    if (isPlayer || isSquad) {
      if (id === world.playerEntityId) continue;
      if (world.squadMembers.has(id)) continue;
    }
    // Skip dead/unconscious/restrained
    if (world.dead.has(id) || world.unconscious.has(id) || world.restrained.has(id)) continue;
    // Skip invisible entities the player can't detect
    if (world.isInvisibleToPlayer(id)) continue;

    const targetPos = world.positions.get(id);
    if (!targetPos) continue;

    // Range check (Chebyshev distance)
    const dist = Math.max(Math.abs(pos.x - targetPos.x), Math.abs(pos.y - targetPos.y));
    if (dist > 10 || dist < 1) continue;

    // Visibility check — only throw at visible targets
    if (!world.isVisible(targetPos.x, targetPos.y)) continue;

    targets.push(id);
  }

  // For player/squad, also target destructibles (training dummies etc.)
  if (isPlayer || isSquad) {
    for (const [id] of world.destructibles) {
      if (targets.includes(id)) continue; // already added via aggro
      const targetPos = world.positions.get(id);
      if (!targetPos) continue;
      const dist = Math.max(Math.abs(pos.x - targetPos.x), Math.abs(pos.y - targetPos.y));
      if (dist > 10 || dist < 1) continue;
      if (!world.isVisible(targetPos.x, targetPos.y)) continue;
      targets.push(id);
    }
  }

  // For enemy NPCs, target player and squad
  if (!isPlayer && !isSquad && world.aggros.has(entityId)) {
    // Target player
    const playerPos = world.positions.get(world.playerEntityId);
    if (playerPos && !world.dead.has(world.playerEntityId) && !world.unconscious.has(world.playerEntityId)) {
      const dist = Math.max(Math.abs(pos.x - playerPos.x), Math.abs(pos.y - playerPos.y));
      if (dist <= 10 && dist >= 1) {
        // NPC LOS check (can't use world.isVisible — that's player FOV)
        // Import would create circular dep, so inline a simple check
        targets.push(world.playerEntityId);
      }
    }
    // Target squad members
    for (const [sid] of world.squadMembers) {
      if (world.dead.has(sid) || world.unconscious.has(sid)) continue;
      const spos = world.positions.get(sid);
      if (!spos) continue;
      const dist = Math.max(Math.abs(pos.x - spos.x), Math.abs(pos.y - spos.y));
      if (dist <= 10 && dist >= 1) {
        targets.push(sid);
      }
    }
  }

  return targets;
}
