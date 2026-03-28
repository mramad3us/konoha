/**
 * Pixel pattern system — text-encoded pixel grids with palette mappings.
 * Each character in the pattern maps to a color in the palette.
 * '.' = transparent pixel.
 *
 * This is the core of the retro pixel art look:
 * patterns are rasterized to ImageData (raw RGBA bytes)
 * then drawn to OffscreenCanvas, ensuring zero anti-aliasing.
 */

export type RGB = [number, number, number];

export interface PixelPattern {
  pixels: string[];
  palette: Record<string, RGB>;
  width: number;
  height: number;
}

/** Parse a hex color to RGB tuple */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Rasterize a PixelPattern into an OffscreenCanvas at the given display size.
 * Each pattern pixel becomes a block of (displayWidth/patternWidth) x (displayHeight/patternHeight) screen pixels.
 * No anti-aliasing — pure nearest-neighbor via ImageData.
 */
export function rasterizePattern(pattern: PixelPattern, displayWidth: number, displayHeight: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(displayWidth, displayHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const pw = pattern.width;
  const ph = pattern.height;

  // Scale factors — how many display pixels per pattern pixel
  const sx = displayWidth / pw;
  const sy = displayHeight / ph;

  for (let py = 0; py < ph; py++) {
    const row = pattern.pixels[py];
    if (!row) continue;
    for (let px = 0; px < pw; px++) {
      const ch = row[px];
      if (!ch || ch === '.') continue;

      const color = pattern.palette[ch];
      if (!color) continue;

      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.fillRect(
        Math.floor(px * sx),
        Math.floor(py * sy),
        Math.ceil(sx),
        Math.ceil(sy),
      );
    }
  }

  return canvas;
}

/**
 * Rasterize with auto-outline: adds a 1px dark border around opaque pixels.
 * Used for characters and objects that need to stand out against terrain.
 */
export function rasterizeWithOutline(
  pattern: PixelPattern,
  displayWidth: number,
  displayHeight: number,
  outlineColor: RGB = [10, 10, 12],
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(displayWidth, displayHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const pw = pattern.width;
  const ph = pattern.height;
  const sx = displayWidth / pw;
  const sy = displayHeight / ph;

  // First pass: draw outline (expand opaque pixels by 1 in all directions)
  ctx.fillStyle = `rgb(${outlineColor[0]},${outlineColor[1]},${outlineColor[2]})`;
  for (let py = 0; py < ph; py++) {
    const row = pattern.pixels[py];
    if (!row) continue;
    for (let px = 0; px < pw; px++) {
      const ch = row[px];
      if (!ch || ch === '.') continue;
      if (!pattern.palette[ch]) continue;

      // Draw outline in 4 cardinal directions
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || nx >= pw || ny < 0 || ny >= ph) continue;
        const nch = pattern.pixels[ny]?.[nx];
        if (!nch || nch === '.' || !pattern.palette[nch]) {
          // Neighbor is transparent — draw outline pixel there
          ctx.fillRect(
            Math.floor(nx * sx),
            Math.floor(ny * sy),
            Math.ceil(sx),
            Math.ceil(sy),
          );
        }
      }
    }
  }

  // Second pass: draw actual sprite pixels on top
  for (let py = 0; py < ph; py++) {
    const row = pattern.pixels[py];
    if (!row) continue;
    for (let px = 0; px < pw; px++) {
      const ch = row[px];
      if (!ch || ch === '.') continue;
      const color = pattern.palette[ch];
      if (!color) continue;

      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.fillRect(
        Math.floor(px * sx),
        Math.floor(py * sy),
        Math.ceil(sx),
        Math.ceil(sy),
      );
    }
  }

  return canvas;
}

/**
 * Deterministic hash for procedural tile variation.
 * Same position always gives same variant.
 */
export function cellHash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}
