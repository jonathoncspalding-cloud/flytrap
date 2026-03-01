// ── Office Layout — JSON-driven with backward-compatible API ─────────────────
// Layout data lives in office-layout.json for easy editing by Isabel agent.
// This module reads the JSON and exports the same constants/functions
// that PixelOffice.tsx and engine.ts already consume.

import type { Vec2, FurnitureItem, FloorZone } from "./types";
import { FURNITURE_DEFS } from "./sprites";
import layoutData from "./office-layout.json";

// ── Layout JSON types ───────────────────────────────────────────────────────

interface LayoutFloorZone {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  color: { h: number; s: number; b: number; c: number };
}

interface LayoutFurniture {
  uid: string;
  type: string;
  col: number;
  row: number;
}

interface LayoutJson {
  version: number;
  cols: number;
  rows: number;
  tiles: number[];
  floorZones: LayoutFloorZone[];
  wallColor: { h: number; s: number; b: number; c: number };
  deskAssignments: Record<string, { deskTile: Vec2; chairTile: Vec2 }>;
  furniture: LayoutFurniture[];
}

const layout = layoutData as LayoutJson;

// ── Exported constants (same API as before) ─────────────────────────────────

export const TILE_SIZE = 16;
export const GRID_COLS = layout.cols;
export const GRID_ROWS = layout.rows;
export const WORLD_W = GRID_COLS * TILE_SIZE;
export const WORLD_H = GRID_ROWS * TILE_SIZE;

// ── Tile grid from JSON flat array → 2D ─────────────────────────────────────

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

// ── Floor zones from JSON ───────────────────────────────────────────────────

export const FLOOR_ZONES: FloorZone[] = layout.floorZones.map((z) => ({
  x: z.x,
  y: z.y,
  w: z.w,
  h: z.h,
  type: z.type as FloorZone["type"],
}));

// ── Floor zone colors (for the new renderer) ────────────────────────────────

export interface FloorColor {
  h: number;
  s: number;
  b: number;
  c: number;
}

export const FLOOR_ZONE_COLORS: Map<string, FloorColor> = new Map(
  layout.floorZones.map((z) => [
    `${z.x},${z.y},${z.w},${z.h}`,
    z.color,
  ])
);

/** Get the HSB color for a floor tile based on which zone it falls in */
export function getFloorColor(x: number, y: number): FloorColor | null {
  for (const zone of layout.floorZones) {
    if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
      return zone.color;
    }
  }
  return null;
}

/** Wall color from layout JSON */
export const WALL_HSB: FloorColor = layout.wallColor;

// ── Desk assignments from JSON ──────────────────────────────────────────────

export const DESK_ASSIGNMENTS: Record<string, { deskTile: Vec2; chairTile: Vec2 }> =
  layout.deskAssignments;

// ── Furniture placement from JSON ───────────────────────────────────────────

function makeFurniture(
  type: string,
  tileX: number,
  tileY: number
): FurnitureItem {
  const def = FURNITURE_DEFS[type];
  if (!def) throw new Error(`Unknown furniture: ${type}`);
  return {
    type,
    tileX,
    tileY,
    widthTiles: def.widthTiles,
    heightTiles: def.heightTiles,
    tiles: def.tiles,
    solid: def.solid,
    wallMounted: def.wallMounted,
  };
}

export function buildFurnitureList(): FurnitureItem[] {
  const items: FurnitureItem[] = [];

  // Agent desks, chairs, monitors from desk assignments
  for (const a of Object.values(DESK_ASSIGNMENTS)) {
    items.push(makeFurniture("desk", a.deskTile.x, a.deskTile.y));
    items.push(makeFurniture("chair", a.chairTile.x, a.chairTile.y));
    items.push(makeFurniture("monitor", a.deskTile.x, a.deskTile.y));
  }

  // Decorative furniture from JSON
  for (const f of layout.furniture) {
    if (!FURNITURE_DEFS[f.type]) {
      console.warn(`[office-layout] Unknown furniture type: ${f.type}`);
      continue;
    }
    items.push(makeFurniture(f.type, f.col, f.row));
  }

  return items;
}

// ── Walkable map ────────────────────────────────────────────────────────────

export function buildWalkableMap(furniture: FurnitureItem[]): boolean[][] {
  const map: boolean[][] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    map[y] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      map[y][x] = TILE_MAP[y][x] !== 0; // 0 = wall, 1+ = floor
    }
  }

  for (const f of furniture) {
    if (!f.solid || f.type === "chair" || f.type === "chairGray" || f.type === "chairLeft" || f.type === "chairRight" || f.type === "stool") continue;
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
