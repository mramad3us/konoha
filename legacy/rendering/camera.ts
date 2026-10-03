import { TILE_WIDTH, TILE_HEIGHT, CAMERA_LERP_FACTOR } from '../core/constants.ts';

/**
 * Smooth-follow isometric camera.
 * Stores target position (set instantly on player move) and current position (interpolated).
 */
export class Camera {
  targetX = 0;
  targetY = 0;
  currentX = 0;
  currentY = 0;
  viewportWidth = 0;
  viewportHeight = 0;

  /** Snap camera to a map position immediately (no lerp) */
  snapTo(mapX: number, mapY: number): void {
    const screen = this.mapToScreen(mapX, mapY);
    this.targetX = screen.sx;
    this.targetY = screen.sy;
    this.currentX = this.targetX;
    this.currentY = this.targetY;
  }

  /** Set camera target to follow a map position */
  setTarget(mapX: number, mapY: number): void {
    const screen = this.mapToScreen(mapX, mapY);
    this.targetX = screen.sx;
    this.targetY = screen.sy;
  }

  /** Update camera position with lerp interpolation */
  update(_dt: number): void {
    this.currentX += (this.targetX - this.currentX) * CAMERA_LERP_FACTOR;
    this.currentY += (this.targetY - this.currentY) * CAMERA_LERP_FACTOR;
  }

  /** Set viewport dimensions (call on resize) */
  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Convert map coordinates to screen coordinates (isometric projection) */
  mapToScreen(mapX: number, mapY: number): { sx: number; sy: number } {
    return {
      sx: (mapX - mapY) * (TILE_WIDTH / 2),
      sy: (mapX + mapY) * (TILE_HEIGHT / 2),
    };
  }

  /** Get the screen offset for rendering (centers camera in viewport) */
  getOffset(): { ox: number; oy: number } {
    return {
      ox: this.viewportWidth / 2 - this.currentX,
      oy: this.viewportHeight / 2 - this.currentY,
    };
  }

  /** Get the visible tile range for frustum culling */
  getVisibleTileRange(mapWidth: number, mapHeight: number): {
    minX: number; maxX: number; minY: number; maxY: number;
  } {
    const offset = this.getOffset();
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;

    // Screen corners in world-ish coords (with generous padding)
    const pad = 4;
    const centerMapX = (this.currentX / halfW + this.currentY / halfH) / 2;
    const centerMapY = (this.currentY / halfH - this.currentX / halfW) / 2;

    // Visible radius in tiles based on viewport size
    const tilesWide = Math.ceil(this.viewportWidth / TILE_WIDTH) + pad;
    const tilesHigh = Math.ceil(this.viewportHeight / TILE_HEIGHT) + pad;
    const radius = Math.max(tilesWide, tilesHigh);

    // Use offset to silence lint
    void offset;

    return {
      minX: Math.max(0, Math.floor(centerMapX - radius)),
      maxX: Math.min(mapWidth - 1, Math.ceil(centerMapX + radius)),
      minY: Math.max(0, Math.floor(centerMapY - radius)),
      maxY: Math.min(mapHeight - 1, Math.ceil(centerMapY + radius)),
    };
  }
}
