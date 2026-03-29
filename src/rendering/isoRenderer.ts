import { TILE_WIDTH, TILE_HEIGHT } from '../core/constants.ts';
import type { World } from '../engine/world.ts';
import { getNightDimFactor } from '../engine/gameTime.ts';
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

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = camera;
    this.dpr = window.devicePixelRatio || 1;

    this.ctx.imageSmoothingEnabled = false;
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

  /** Render a full frame */
  draw(world: World): void {
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

        // Entities at this position
        const entities = world.getEntitiesAt(x, y);
        for (const eid of entities) {
          const renderable = world.renderables.get(eid);
          if (!renderable) continue;

          drawCommands.push({
            screenX: sx,
            screenY: sy,
            spriteId: renderable.spriteId,
            depth,
            layer: renderable.layer,
            alpha: isVisible ? 1.0 : 0.25,
            offsetY: renderable.offsetY,
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
        ctx.drawImage(sprite, drawX, drawY, sprite.width, sprite.height);
      }
    }

    ctx.globalAlpha = 1.0;

    // ── Night overlay ──
    const nightDim = getNightDimFactor(world.gameTimeSeconds);
    if (nightDim > 0.01) {
      ctx.fillStyle = `rgba(5, 5, 20, ${nightDim})`;
      ctx.fillRect(0, 0, this.camera.viewportWidth, this.camera.viewportHeight);

      // TODO: Draw torch light circles here (bright spots at light source positions)
    }
  }
}
