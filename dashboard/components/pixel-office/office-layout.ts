// ── Office Layout — JSON-driven, Pixel Agents format ────────────────────────
// Layout data lives in office-layout.json (exported from Pixel Agents editor).
// Tile types: 0=wall, 1-7=floor patterns, 8=void
// Furniture uses ASSET_* IDs loaded from furniture-catalog.json

import type { Vec2, FurnitureItem, FloorColor } from "./types";
import { getFurnitureCatalogEntry } from "./sprites";
import layoutData from "./office-layout.json";

// ── Layout JSON types (Pixel Agents format) ─────────────────────────────────

interface PlacedFurniture {
  uid: string;
  type: string;
  col: number;
  row: number;
  color?: FloorColor;
}

interface LayoutJson {
  version: number;
  cols: number;
  rows: number;
  tiles: number[];
  tileColors?: Array<FloorColor | null>;
  furniture: PlacedFurniture[];
}

const layout = layoutData as LayoutJson;

// ── Exported constants ──────────────────────────────────────────────────────

export const TILE_SIZE = 16;
export const GRID_COLS = layout.cols;
export const GRID_ROWS = layout.rows;
export const WORLD_W = GRID_COLS * TILE_SIZE;
export const WORLD_H = GRID_ROWS * TILE_SIZE;

// ── Tile grid from JSON flat array → 2D ─────────────────────────────────────
// Values: 0=wall, 1-7=floor pattern types, 8=void (outside)

export const TILE_MAP: number[][] = (() => {
  const map: number[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      row.push(layout.tiles[r * GRID_COLS + c]);
    }
    map.push(row);
  }
  return map;
})();

// ── Per-tile colors from layout ─────────────────────────────────────────────

const tileColors: Array<FloorColor | null> = layout.tileColors || [];

/** Get the HSB color for a specific tile position */
export function getTileColor(x: number, y: number): FloorColor | null {
  const idx = y * GRID_COLS + x;
  return tileColors[idx] ?? null;
}

// ── Tile type helpers ───────────────────────────────────────────────────────

/** Whether a tile is walkable floor (types 1-7) */
export function isFloor(tileVal: number): boolean {
  return tileVal >= 1 && tileVal <= 7;
}

/** Whether a tile is a wall (type 0) */
export function isWall(tileVal: number): boolean {
  return tileVal === 0;
}

/** Whether a tile is void/outside (type 8) */
export function isVoid(tileVal: number): boolean {
  return tileVal === 8;
}

/** Get floor pattern index (0-6) from tile value (1-7) */
export function getFloorPatternIndex(tileVal: number): number {
  return Math.max(0, tileVal - 1);
}

// ── Wall color (default dark blue-gray) ─────────────────────────────────────

export const WALL_HSB: FloorColor = { h: 220, s: 25, b: -15, c: 5 };

// ── Desk assignments (7 agents) ─────────────────────────────────────────────
// Manually mapped to furniture positions in the stock layout.
// These are chair positions where agents sit + desk positions they face.

export const DESK_ASSIGNMENTS: Record<string, { deskTile: Vec2; chairTile: Vec2 }> = (() => {
  // Find desk-type furniture (ASSET_90 = FULL_COMPUTER_COFFEE_OFF, which are the workstations)
  const desks = layout.furniture.filter((f) => f.type === "ASSET_90");
  // Find chairs near desks
  const agents = ["sentinel", "scout", "architect", "optimize", "oracle", "strategist", "isabel"];
  const assignments: Record<string, { deskTile: Vec2; chairTile: Vec2 }> = {};

  for (let i = 0; i < agents.length; i++) {
    if (i < desks.length) {
      const desk = desks[i];
      // Chair is typically 2 rows below the desk (desk is 2x2, chair at bottom)
      assignments[agents[i]] = {
        deskTile: { x: desk.col, y: desk.row },
        chairTile: { x: desk.col + 1, y: desk.row + 2 },
      };
    } else {
      // Fallback for agents without desks — put them in walkable space
      assignments[agents[i]] = {
        deskTile: { x: 5 + i, y: 5 },
        chairTile: { x: 5 + i, y: 6 },
      };
    }
  }

  return assignments;
})();

// ── Furniture placement from JSON ───────────────────────────────────────────

export function buildFurnitureList(): FurnitureItem[] {
  const items: FurnitureItem[] = [];

  for (const f of layout.furniture) {
    const catalogEntry = getFurnitureCatalogEntry(f.type);
    if (!catalogEntry) {
      console.warn(`[office-layout] Unknown furniture type: ${f.type}`);
      continue;
    }

    items.push({
      type: f.type,
      tileX: f.col,
      tileY: f.row,
      widthTiles: catalogEntry.footprintW,
      heightTiles: catalogEntry.footprintH,
      pixelW: catalogEntry.width,
      pixelH: catalogEntry.height,
      solid: !catalogEntry.canPlaceOnSurfaces && !catalogEntry.canPlaceOnWalls,
      wallMounted: catalogEntry.canPlaceOnWalls,
      color: f.color,
    });
  }

  return items;
}

// ── Walkable map ────────────────────────────────────────────────────────────

export function buildWalkableMap(furniture: FurnitureItem[]): boolean[][] {
  const map: boolean[][] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    map[y] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      const tv = TILE_MAP[y][x];
      map[y][x] = isFloor(tv); // only floor tiles (1-7) are walkable
    }
  }

  for (const f of furniture) {
    if (!f.solid || f.wallMounted) continue;
    // Small items on surfaces don't block
    const entry = getFurnitureCatalogEntry(f.type);
    if (entry?.canPlaceOnSurfaces) continue;

    for (let dy = 0; dy < f.heightTiles; dy++) {
      for (let dx = 0; dx < f.widthTiles; dx++) {
        const fy = f.tileY + dy;
        const fx = f.tileX + dx;
        if (fy >= 0 && fy < GRID_ROWS && fx >= 0 && fx < GRID_COLS) {
          map[fy][fx] = false;
        }
      }
    }
  }

  return map;
}
