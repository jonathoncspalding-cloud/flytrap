// ── Tile Renderer — Sprite-based walls + colorized floors ────────────────────
// Loads walls.png (auto-tiling 16×32 wall sprites) and floor-patterns.png
// (grayscale 16×16 patterns), colorizes them at render time, caches results.
// Walls participate in z-sorting with furniture for proper occlusion.

import type { Renderable, FurnitureItem, FloorZone } from "./types";
import { TILE_SIZE, TILE_MAP, GRID_COLS, GRID_ROWS, FLOOR_ZONES, getFloorColor } from "./office-layout";
import type { FloorColor } from "./office-layout";

// ── Sprite data types ───────────────────────────────────────────────────────

/** 2D array of hex color strings ('' = transparent) */
type SpriteData = string[][];

// ── Image loading ───────────────────────────────────────────────────────────

let wallsImg: HTMLImageElement | null = null;
let floorPatternsImg: HTMLImageElement | null = null;
let wallSprites: SpriteData[] | null = null;
let floorSprites: SpriteData[] | null = null;

const WALL_PIECE_W = 16;
const WALL_PIECE_H = 32;
const WALL_GRID_COLS = 4;
const FLOOR_PATTERN_SIZE = 16;

/** Load tile rendering assets. Call once on init. */
export async function loadTileAssets(): Promise<void> {
  const [wImg, fImg] = await Promise.all([
    loadImg("/sprites/walls.png"),
    loadImg("/sprites/floor-patterns.png"),
  ]);
  wallsImg = wImg;
  floorPatternsImg = fImg;

  // Extract wall sprites from walls.png (4×4 grid of 16×32 pieces)
  wallSprites = extractWallSprites(wImg);

  // Extract floor patterns from floor-patterns.png (horizontal strip of 16×16 tiles)
  floorSprites = extractFloorSprites(fImg);
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

// ── Sprite extraction (PNG → SpriteData) ────────────────────────────────────

function imgToPixels(img: HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

function extractRegion(
  data: ImageData,
  sx: number,
  sy: number,
  w: number,
  h: number
): SpriteData {
  const sprite: SpriteData = [];
  for (let r = 0; r < h; r++) {
    const row: string[] = [];
    for (let c = 0; c < w; c++) {
      const idx = ((sy + r) * data.width + (sx + c)) * 4;
      const rv = data.data[idx];
      const gv = data.data[idx + 1];
      const bv = data.data[idx + 2];
      const av = data.data[idx + 3];
      if (av < 10) {
        row.push("");
      } else {
        row.push(
          `#${rv.toString(16).padStart(2, "0")}${gv.toString(16).padStart(2, "0")}${bv.toString(16).padStart(2, "0")}`
        );
      }
    }
    sprite.push(row);
  }
  return sprite;
}

function extractWallSprites(img: HTMLImageElement): SpriteData[] {
  const data = imgToPixels(img);
  const sprites: SpriteData[] = [];
  for (let mask = 0; mask < 16; mask++) {
    const col = mask % WALL_GRID_COLS;
    const row = Math.floor(mask / WALL_GRID_COLS);
    sprites.push(
      extractRegion(data, col * WALL_PIECE_W, row * WALL_PIECE_H, WALL_PIECE_W, WALL_PIECE_H)
    );
  }
  return sprites;
}

function extractFloorSprites(img: HTMLImageElement): SpriteData[] {
  const data = imgToPixels(img);
  const count = Math.floor(img.width / FLOOR_PATTERN_SIZE);
  const sprites: SpriteData[] = [];
  for (let i = 0; i < count; i++) {
    sprites.push(
      extractRegion(data, i * FLOOR_PATTERN_SIZE, 0, FLOOR_PATTERN_SIZE, FLOOR_PATTERN_SIZE)
    );
  }
  return sprites;
}

// ── Colorization (Photoshop-style Colorize) ─────────────────────────────────

const colorizeCache = new Map<string, HTMLCanvasElement>();

function colorizeSprite(
  sprite: SpriteData,
  color: FloorColor,
  zoom: number,
  cacheKey: string
): HTMLCanvasElement {
  const existing = colorizeCache.get(cacheKey);
  if (existing) return existing;

  const rows = sprite.length;
  const cols = sprite[0].length;
  const canvas = document.createElement("canvas");
  canvas.width = cols * zoom;
  canvas.height = rows * zoom;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const { h, s, b, c } = color;

  for (let r = 0; r < rows; r++) {
    for (let ci = 0; ci < cols; ci++) {
      const pixel = sprite[r][ci];
      if (pixel === "") continue;

      // Parse pixel luminance
      const rv = parseInt(pixel.slice(1, 3), 16);
      const gv = parseInt(pixel.slice(3, 5), 16);
      const bv = parseInt(pixel.slice(5, 7), 16);
      let lightness = (0.299 * rv + 0.587 * gv + 0.114 * bv) / 255;

      // Apply contrast
      if (c !== 0) {
        const factor = (100 + c) / 100;
        lightness = 0.5 + (lightness - 0.5) * factor;
      }

      // Apply brightness
      if (b !== 0) {
        lightness = lightness + b / 200;
      }

      lightness = Math.max(0, Math.min(1, lightness));

      // HSL → RGB
      const satFrac = s / 100;
      const ch = (1 - Math.abs(2 * lightness - 1)) * satFrac;
      const hp = h / 60;
      const x = ch * (1 - Math.abs((hp % 2) - 1));
      let r1 = 0,
        g1 = 0,
        b1 = 0;

      if (hp < 1) { r1 = ch; g1 = x; }
      else if (hp < 2) { r1 = x; g1 = ch; }
      else if (hp < 3) { g1 = ch; b1 = x; }
      else if (hp < 4) { g1 = x; b1 = ch; }
      else if (hp < 5) { r1 = x; b1 = ch; }
      else { r1 = ch; b1 = x; }

      const m = lightness - ch / 2;
      const fr = Math.max(0, Math.min(255, Math.round((r1 + m) * 255)));
      const fg = Math.max(0, Math.min(255, Math.round((g1 + m) * 255)));
      const fb = Math.max(0, Math.min(255, Math.round((b1 + m) * 255)));

      ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
      ctx.fillRect(ci * zoom, r * zoom, zoom, zoom);
    }
  }

  colorizeCache.set(cacheKey, canvas);
  return canvas;
}

/** Clear sprite cache (call on zoom change) */
export function clearTileCache(): void {
  colorizeCache.clear();
}

// ── Wall auto-tiling ────────────────────────────────────────────────────────

/**
 * Get wall sprite for a tile based on its 4 cardinal neighbors.
 * Bitmask: N=1, E=2, S=4, W=8
 */
/** Check if a tile is a wall (0) or void (8) — both are non-floor */
function isWallOrVoid(col: number, row: number): boolean {
  const t = TILE_MAP[row]?.[col];
  return t === 0 || t === 8 || t === undefined;
}

function getWallMask(col: number, row: number): number {
  let mask = 0;
  if (row > 0 && isWallOrVoid(col, row - 1)) mask |= 1; // N
  if (col < GRID_COLS - 1 && isWallOrVoid(col + 1, row)) mask |= 2; // E
  if (row < GRID_ROWS - 1 && isWallOrVoid(col, row + 1)) mask |= 4; // S
  if (col > 0 && isWallOrVoid(col - 1, row)) mask |= 8; // W
  return mask;
}

// ── Public rendering API ────────────────────────────────────────────────────

/** Whether tile assets are loaded and ready */
export function hasTileAssets(): boolean {
  return wallSprites !== null && floorSprites !== null;
}

/**
 * Draw all floor tiles with colorized patterns.
 * Call BEFORE z-sorted scene.
 */
export function drawFloors(
  ctx: CanvasRenderingContext2D,
  zoom: number
): void {
  if (!floorSprites || floorSprites.length === 0) return;

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const tileType = TILE_MAP[y][x];
      if (tileType === 0 || tileType === 8) continue; // wall or void, skip

      const color = getFloorColor(x, y);
      if (!color) continue;

      // Pick pattern from tile value (1-7) or fall back to zone type
      const patternIdx = (tileType >= 1 && tileType <= 7) ? tileType - 1 : (FLOOR_PATTERN_MAP[getZoneType(x, y)] ?? 0);
      const sprite = floorSprites[patternIdx];
      if (!sprite) continue;

      const key = `floor-${patternIdx}-${color.h}-${color.s}-${color.b}-${color.c}-z${zoom}`;
      const cached = colorizeSprite(sprite, color, zoom, key);
      ctx.drawImage(cached, x * TILE_SIZE * zoom, y * TILE_SIZE * zoom);
    }
  }
}

/** Map floor zone types to pattern indices */
const FLOOR_PATTERN_MAP: Record<string, number> = {
  wood: 1,    // wood plank pattern
  tile: 2,    // grid tile pattern
  carpet: 4,  // carpet dots pattern
  library: 3, // diamond pattern
};

function getZoneType(x: number, y: number): string {
  for (const zone of FLOOR_ZONES) {
    if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
      return zone.type;
    }
  }
  return "wood";
}

/**
 * Draw wall base color (flat fill behind wall sprites).
 * Wall sprites have transparent areas — the base color shows through.
 */
export function drawWallBases(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  wallColor: FloorColor
): void {
  // Compute wall base hex from HSB
  const hex = hsbToHex(wallColor);

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (TILE_MAP[y][x] !== 0) continue; // only draw on actual walls (not void)
      ctx.fillStyle = hex;
      ctx.fillRect(x * TILE_SIZE * zoom, y * TILE_SIZE * zoom, TILE_SIZE * zoom, TILE_SIZE * zoom);
    }
  }
}

/**
 * Build wall Renderable objects for z-sorting with furniture/characters.
 * Walls are 16×32 sprites (2 tiles tall), anchored at the bottom of their tile.
 */
export function buildWallRenderables(zoom: number, wallColor: FloorColor): Renderable[] {
  if (!wallSprites) return [];

  const items: Renderable[] = [];

  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (TILE_MAP[y][x] !== 0) continue; // only walls get wall sprites (not void)

      const mask = getWallMask(x, y);
      const sprite = wallSprites[mask];
      if (!sprite) continue;

      const key = `wall-${mask}-${wallColor.h}-${wallColor.s}-${wallColor.b}-${wallColor.c}-z${zoom}`;
      const cached = colorizeSprite(sprite, wallColor, zoom, key);

      // Wall sprite is 16×32 (2 tiles tall), anchored at bottom of tile
      const drawX = x * TILE_SIZE * zoom;
      const drawY = y * TILE_SIZE * zoom + TILE_SIZE * zoom - cached.height;
      const bottomY = (y + 1) * TILE_SIZE; // z-sort by bottom edge of tile

      items.push({
        bottomY,
        draw: (ctx, _z) => {
          ctx.drawImage(cached, drawX, drawY);
        },
      });
    }
  }

  return items;
}

// ── HSB → Hex helper ────────────────────────────────────────────────────────

function hsbToHex(color: FloorColor): string {
  const { h, s, b, c } = color;
  let lightness = 0.5;

  if (c !== 0) {
    const factor = (100 + c) / 100;
    lightness = 0.5 + (lightness - 0.5) * factor;
  }
  if (b !== 0) {
    lightness = lightness + b / 200;
  }
  lightness = Math.max(0, Math.min(1, lightness));

  const satFrac = s / 100;
  const ch = (1 - Math.abs(2 * lightness - 1)) * satFrac;
  const hp = h / 60;
  const x = ch * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;

  if (hp < 1) { r1 = ch; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = ch; }
  else if (hp < 3) { g1 = ch; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = ch; }
  else if (hp < 5) { r1 = x; b1 = ch; }
  else { r1 = ch; b1 = x; }

  const m = lightness - ch / 2;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));

  return `#${clamp(r1).toString(16).padStart(2, "0")}${clamp(g1).toString(16).padStart(2, "0")}${clamp(b1).toString(16).padStart(2, "0")}`;
}
