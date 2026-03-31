import { TILE_WIDTH, TILE_HEIGHT } from '../core/constants.ts';
import type { World } from '../engine/world.ts';
import type { EntityId } from '../types/ecs.ts';
import { getNightDimFactor } from '../engine/gameTime.ts';
import { getActiveEngagements } from '../engine/combatSystem.ts';
import { drawParticles } from '../systems/particleSystem.ts';
import { drawFloatingTexts } from '../systems/floatingTextSystem.ts';
import { Camera } from './camera.ts';
import { spriteCache } from './spriteCache.ts';
import type { DrawCommand } from './depthSort.ts';
import { sortDrawCommands } from './depthSort.ts';

/**
 * Isometric canvas renderer with FOV fog and depth sorting.
 */
export class IsoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private dpr: number;

  /** Offscreen canvas for shadow tint compositing */
  private shadowCanvas: OffscreenCanvas;
  private shadowCtx: OffscreenCanvasRenderingContext2D;
  /** Offscreen canvas for night overlay with torch light holes */
  private _nightCanvas: OffscreenCanvas | null = null;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = camera;
    this.dpr = window.devicePixelRatio || 1;

    this.ctx.imageSmoothingEnabled = false;

    // Shadow tint buffer (large enough for biggest sprite)
    this.shadowCanvas = new OffscreenCanvas(64, 64);
    this.shadowCtx = this.shadowCanvas.getContext('2d')!;
  }

  /** Resize canvas buffer to match container */
  resize(width: number, height: number): void {
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.camera.setViewport(width, height);
  }

  /** Render a full frame. throwTargetId highlights the selected throw target. */
  draw(world: World, throwTargetId?: EntityId): void {
    const ctx = this.ctx;
    const dpr = this.dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Clear to deep background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight);

    const offset = this.camera.getOffset();
    const { minX, maxX, minY, maxY } = this.camera.getVisibleTileRange(
      world.tileMap.width, world.tileMap.height
    );

    const drawCommands: DrawCommand[] = [];
    const halfTW = TILE_WIDTH / 2;
    const halfTH = TILE_HEIGHT / 2;
    const playerPos = world.positions.get(world.playerEntityId);

    // ── Build draw list ──
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = world.fovKey(x, y);
        const isVisible = world.fovVisible.has(key);
        const isExplored = world.fovExplored.has(key);

        if (!isExplored) continue;

        const sx = (x - y) * halfTW + offset.ox;
        const sy = (x + y) * halfTH + offset.oy;

        // Quick frustum cull
        if (sx < -TILE_WIDTH || sx > this.camera.viewportWidth + TILE_WIDTH) continue;
        if (sy < -TILE_HEIGHT * 3 || sy > this.camera.viewportHeight + TILE_HEIGHT) continue;

        const alpha = isVisible ? 1.0 : 0.35;
        const depth = x + y;

        // Tile
        const tileSpriteId = world.tileMap.getSpriteId(x, y);
        drawCommands.push({
          screenX: sx,
          screenY: sy,
          spriteId: tileSpriteId,
          depth,
          layer: 'floor',
          alpha,
          offsetY: 0,
        });

        // Blood decals (floor layer, above tile)
        const decalKey = `${x}:${y}`;
        const decal = world.bloodDecals.get(decalKey);
        if (decal) {
          drawCommands.push({
            screenX: sx,
            screenY: sy,
            spriteId: `blood_splatter_${decal.variant}`,
            depth,
            layer: 'floor',
            alpha: alpha * 0.8,
            offsetY: 0,
          });
        }

        // Entities at this position
        const entities = world.getEntitiesAt(x, y);
        for (const eid of entities) {
          const renderable = world.renderables.get(eid);
          if (!renderable) continue;

          // Skip entities that are invisible to the player
          if (world.isInvisibleToPlayer(eid)) continue;

          // Skip hidden entities unless player is adjacent (Chebyshev ≤ 1)
          if (world.hiddenUntilAdjacent.has(eid) && playerPos) {
            const dx = Math.abs(x - playerPos.x);
            const dy = Math.abs(y - playerPos.y);
            if (dx > 1 || dy > 1) continue;
          }

          const isShadowed = world.isInvisibleButDetected(eid);

          drawCommands.push({
            screenX: sx,
            screenY: sy,
            spriteId: renderable.spriteId,
            depth,
            layer: renderable.layer,
            alpha: isVisible ? 1.0 : 0.25,
            offsetY: renderable.offsetY,
            shadowTint: isShadowed,
          });
        }
      }
    }

    // ── Sort and draw ──
    sortDrawCommands(drawCommands);

    for (const cmd of drawCommands) {
      const sprite = spriteCache.get(cmd.spriteId);
      if (!sprite) continue;

      ctx.globalAlpha = cmd.alpha;

      if (cmd.layer === 'floor') {
        // Tiles draw at their screen position
        ctx.drawImage(sprite, cmd.screenX, cmd.screenY, TILE_WIDTH, TILE_HEIGHT);
      } else {
        // Objects/characters center horizontally on tile, offset vertically
        const drawX = cmd.screenX + (TILE_WIDTH - sprite.width) / 2;
        const drawY = cmd.screenY + cmd.offsetY;

        if (cmd.shadowTint) {
          // Draw to offscreen buffer, apply dark tint, then composite to main canvas
          const sw = sprite.width;
          const sh = sprite.height;
          if (this.shadowCanvas.width < sw || this.shadowCanvas.height < sh) {
            this.shadowCanvas.width = sw;
            this.shadowCanvas.height = sh;
          }
          const sctx = this.shadowCtx;
          sctx.clearRect(0, 0, sw, sh);
          sctx.drawImage(sprite, 0, 0, sw, sh);
          sctx.globalCompositeOperation = 'source-atop';
          sctx.fillStyle = 'rgba(10, 8, 20, 0.55)';
          sctx.fillRect(0, 0, sw, sh);
          sctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(this.shadowCanvas, 0, 0, sw, sh, drawX, drawY, sw, sh);
        } else {
          ctx.drawImage(sprite, drawX, drawY, sprite.width, sprite.height);
        }
      }
    }

    ctx.globalAlpha = 1.0;

    // ── Combat status indicators above characters ──
    this.drawCombatIndicators(ctx, world, offset);

    // ── Throw target highlight ──
    if (throwTargetId !== undefined) {
      this.drawThrowTargetHighlight(ctx, world, offset, throwTargetId);
    }

    // ── Particles (smoke, chakra flashes) ──
    drawParticles(ctx, offset);

    // ── Floating text (combat speech bubbles) ──
    drawFloatingTexts(ctx, offset);

    // ── Night overlay ──
    // Two-pass: desaturating blue tint + darkness overlay with torch light holes
    const nightDim = getNightDimFactor(world.gameTimeSeconds);
    if (nightDim > 0.01) {
      const w = this.camera.viewportWidth;
      const h = this.camera.viewportHeight;

      // Pass 1: Blue-tinted wash (moonlight feel) — multiply blend
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      const blueLerp = Math.min(1, nightDim * 1.5);
      const r = Math.round(255 - blueLerp * 120);
      const g = Math.round(255 - blueLerp * 110);
      const b = Math.round(255 - blueLerp * 50);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Pass 2: Darkness overlay with torch light holes
      // Build on offscreen canvas so we can use destination-out for lights
      if (!this._nightCanvas || this._nightCanvas.width !== w || this._nightCanvas.height !== h) {
        this._nightCanvas = new OffscreenCanvas(w, h);
      }
      const nctx = this._nightCanvas.getContext('2d')!;
      nctx.clearRect(0, 0, w, h);

      // Fill with darkness
      nctx.fillStyle = `rgba(3, 3, 15, ${nightDim * 0.85})`;
      nctx.fillRect(0, 0, w, h);

      // Punch radial gradient holes for light sources (only visible ones)
      nctx.globalCompositeOperation = 'destination-out';
      for (const [eid, light] of world.lightSources) {
        if (!light.activeAtNight) continue;
        const lpos = world.positions.get(eid);
        if (!lpos) continue;
        if (!world.isVisible(lpos.x, lpos.y)) continue;
        // Convert tile position to screen position
        const sx = (lpos.x - lpos.y) * (TILE_WIDTH / 2) + offset.ox;
        const sy = (lpos.x + lpos.y) * (TILE_HEIGHT / 2) + offset.oy;
        const pixelRadius = light.radius * TILE_WIDTH * 0.6;

        const grad = nctx.createRadialGradient(sx, sy - 8, 0, sx, sy - 8, pixelRadius);
        // Stronger erasure at center, fading to nothing at edge
        const strength = Math.min(1, nightDim * 1.4);
        grad.addColorStop(0, `rgba(0,0,0,${strength})`);
        grad.addColorStop(0.4, `rgba(0,0,0,${strength * 0.6})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        nctx.fillStyle = grad;
        nctx.fillRect(sx - pixelRadius, sy - 8 - pixelRadius, pixelRadius * 2, pixelRadius * 2);
      }
      nctx.globalCompositeOperation = 'source-over';

      // Composite onto main canvas
      ctx.drawImage(this._nightCanvas, 0, 0);

      // Warm glow halos on top for torches (additive orange tint, visible only)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const [eid, light] of world.lightSources) {
        if (!light.activeAtNight) continue;
        const lpos = world.positions.get(eid);
        if (!lpos) continue;
        if (!world.isVisible(lpos.x, lpos.y)) continue;
        const sx = (lpos.x - lpos.y) * (TILE_WIDTH / 2) + offset.ox;
        const sy = (lpos.x + lpos.y) * (TILE_HEIGHT / 2) + offset.oy;
        const glowRadius = light.radius * TILE_WIDTH * 0.35;
        const glowStrength = Math.min(0.15, nightDim * 0.2);

        const grad = ctx.createRadialGradient(sx, sy - 8, 0, sx, sy - 8, glowRadius);
        grad.addColorStop(0, `rgba(255, 160, 60, ${glowStrength})`);
        grad.addColorStop(0.5, `rgba(255, 120, 30, ${glowStrength * 0.3})`);
        grad.addColorStop(1, 'rgba(255, 100, 20, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx - glowRadius, sy - 8 - glowRadius, glowRadius * 2, glowRadius * 2);
      }
      ctx.restore();
    }

    // ── Carry indicator above player (drawn after night overlay so it's always visible) ──
    this.drawCarryIndicator(ctx, world, offset);
  }

  /** Draw carry weight indicator above player when carrying a body */
  private drawCarryIndicator(ctx: CanvasRenderingContext2D, world: World, offset: { ox: number; oy: number }): void {
    const carry = world.carrying.get(world.playerEntityId);
    if (!carry) return;

    const pos = world.positions.get(world.playerEntityId);
    if (!pos) return;
    if (!world.fovVisible.has(world.fovKey(pos.x, pos.y))) return;

    const halfTW = TILE_WIDTH / 2;
    const halfTH = TILE_HEIGHT / 2;
    const sx = (pos.x - pos.y) * halfTW + offset.ox;
    const sy = (pos.x + pos.y) * halfTH + offset.oy;
    const centerX = sx + TILE_WIDTH / 2;
    const aboveY = sy - 28; // above character head

    // Draw a small weight/burden symbol: a down arrow (burden)
    ctx.globalAlpha = 0.85;

    // Body icon — small person silhouette
    ctx.fillStyle = '#8a7a6a';
    // Head
    ctx.fillRect(centerX - 1, aboveY, 3, 2);
    // Body
    ctx.fillRect(centerX - 2, aboveY + 2, 5, 3);
    // Legs
    ctx.fillRect(centerX - 2, aboveY + 5, 2, 2);
    ctx.fillRect(centerX + 1, aboveY + 5, 2, 2);

    ctx.globalAlpha = 1.0;
  }

  /** Draw pulsing highlight on the throw target tile */
  private drawThrowTargetHighlight(
    ctx: CanvasRenderingContext2D,
    world: World,
    offset: { ox: number; oy: number },
    targetId: EntityId,
  ): void {
    const pos = world.positions.get(targetId);
    if (!pos) return;
    if (!world.fovVisible.has(world.fovKey(pos.x, pos.y))) return;

    const halfTW = TILE_WIDTH / 2;
    const halfTH = TILE_HEIGHT / 2;
    const sx = (pos.x - pos.y) * halfTW + offset.ox;
    const sy = (pos.x + pos.y) * halfTH + offset.oy;

    // Pulsing red diamond outline on the tile
    const pulse = 0.4 + 0.3 * Math.sin(Date.now() / 200);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;

    const cx = sx + halfTW;
    const cy = sy + halfTH;
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfTH);
    ctx.lineTo(cx + halfTW, cy);
    ctx.lineTo(cx, cy + halfTH);
    ctx.lineTo(cx - halfTW, cy);
    ctx.closePath();
    ctx.stroke();

    // Target name above
    const name = world.names.get(targetId)?.display ?? 'Target';
    ctx.globalAlpha = pulse + 0.2;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.fillText(name, cx, sy - 4);
    ctx.textAlign = 'start';

    ctx.globalAlpha = 1.0;
  }

  /** Draw tempo beads and condition icons above characters in combat */
  private drawCombatIndicators(ctx: CanvasRenderingContext2D, world: World, offset: { ox: number; oy: number }): void {
    const engagements = getActiveEngagements();
    const halfTW = TILE_WIDTH / 2;
    const halfTH = TILE_HEIGHT / 2;

    for (const eng of engagements.values()) {
      // Draw for each combatant
      for (const [entityId, tempo, cond] of [
        [eng.entityA, eng.tempoA, eng.conditionA] as const,
        [eng.entityB, eng.tempoB, eng.conditionB] as const,
      ]) {
        const pos = world.positions.get(entityId);
        if (!pos) continue;
        if (!world.fovVisible.has(world.fovKey(pos.x, pos.y))) continue;

        const sx = (pos.x - pos.y) * halfTW + offset.ox;
        const sy = (pos.x + pos.y) * halfTH + offset.oy;

        // Center above character sprite
        const centerX = sx + TILE_WIDTH / 2;
        const aboveY = sy - 20; // above the character head

        // ── Tempo beads ──
        if (tempo.max > 0) {
          const beadSize = 4;
          const beadGap = 2;
          const totalWidth = tempo.max * (beadSize + beadGap) - beadGap;
          const startX = centerX - totalWidth / 2;

          for (let i = 0; i < tempo.max; i++) {
            const bx = startX + i * (beadSize + beadGap);
            if (i < tempo.current) {
              // Filled bead — gold
              ctx.fillStyle = '#c9a84c';
              ctx.fillRect(bx, aboveY, beadSize, beadSize);
            } else {
              // Empty bead — dark outline
              ctx.fillStyle = '#2a2a2a';
              ctx.fillRect(bx, aboveY, beadSize, beadSize);
              ctx.fillStyle = '#444';
              ctx.fillRect(bx + 1, aboveY + 1, beadSize - 2, beadSize - 2);
            }
          }
        }

        // ── Condition icon ──
        if (cond.condition) {
          const iconY = aboveY - 8;
          if (cond.condition === 'down') {
            // Down arrow — orange/gold
            ctx.fillStyle = '#c9a84c';
            ctx.fillRect(centerX - 1, iconY, 2, 4);
            ctx.fillRect(centerX - 3, iconY + 3, 6, 2);
            ctx.fillRect(centerX - 2, iconY + 5, 4, 1);
            ctx.fillRect(centerX - 1, iconY + 6, 2, 1);
          } else {
            // Stunned spiral — red
            ctx.fillStyle = '#d4364a';
            ctx.fillRect(centerX - 2, iconY, 4, 1);
            ctx.fillRect(centerX + 2, iconY + 1, 1, 2);
            ctx.fillRect(centerX, iconY + 2, 2, 1);
            ctx.fillRect(centerX - 2, iconY + 1, 1, 2);
            ctx.fillRect(centerX - 1, iconY + 3, 3, 1);
            ctx.fillRect(centerX + 2, iconY + 3, 1, 2);
            ctx.fillRect(centerX - 2, iconY + 4, 4, 1);
          }
        }
      }
    }
  }
}
