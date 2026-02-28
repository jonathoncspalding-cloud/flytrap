// ── Office Layout & Constants ───────────────────────────────────────────────
// Multi-room office: main workspace (left), kitchen (top-right), meeting room (bottom-right)

import type { Vec2, FurnitureItem, FloorZone } from "./types";
import { FURNITURE_DEFS } from "./sprites";

export const TILE_SIZE = 16;
export const GRID_COLS = 26;
export const GRID_ROWS = 16;
export const WORLD_W = GRID_COLS * TILE_SIZE; // 416
export const WORLD_H = GRID_ROWS * TILE_SIZE; // 256

// ── Tile grid (0=floor, 1=wall) ─────────────────────────────────────────────
const W = 1;
const F = 0;

// 26 cols × 16 rows
// Left: main office (cols 0-15, rows 0-15)
// Right-top: kitchen (cols 16-25, rows 0-7)
// Right-bottom: meeting room (cols 16-25, rows 8-15)
export const TILE_MAP: number[][] = [
  //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W], // 0
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 1
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 2
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 3
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 4
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 5
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, F, F, F, F, F, F, F, F, F, W], // 6
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, F, F, F, F, F, F, F, F, F, W], // 7
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 8
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 9
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 10
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 11
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 12
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 13
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, W, F, F, F, F, F, F, F, F, W], // 14
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W], // 15
];

// ── Floor zones ─────────────────────────────────────────────────────────────

export const FLOOR_ZONES: FloorZone[] = [
  // Main office — wood floor
  { x: 1, y: 1, w: 14, h: 14, type: "wood" },
  // Kitchen — tile floor
  { x: 17, y: 1, w: 8, h: 8, type: "tile" },
  // Meeting room — carpet floor
  { x: 17, y: 10, w: 8, h: 5, type: "carpet" },
  // Hallway/corridor connecting rooms
  { x: 16, y: 6, w: 1, h: 4, type: "wood" },
  { x: 15, y: 8, w: 2, h: 2, type: "wood" },
];

// ── Desk assignments (6 agents in main office) ─────────────────────────────
// Desks in 2 rows × 3 columns. Chair is 1 tile below desk, agent faces up.
export const DESK_ASSIGNMENTS: Record<
  string,
  { deskTile: Vec2; chairTile: Vec2 }
> = {
  sentinel: { deskTile: { x: 2, y: 2 }, chairTile: { x: 3, y: 4 } },
  scout: { deskTile: { x: 7, y: 2 }, chairTile: { x: 8, y: 4 } },
  oracle: { deskTile: { x: 12, y: 2 }, chairTile: { x: 13, y: 4 } },
  architect: { deskTile: { x: 2, y: 8 }, chairTile: { x: 3, y: 10 } },
  optimize: { deskTile: { x: 7, y: 8 }, chairTile: { x: 8, y: 10 } },
  strategist: { deskTile: { x: 12, y: 8 }, chairTile: { x: 13, y: 10 } },
  isabel: { deskTile: { x: 17, y: 11 }, chairTile: { x: 18, y: 13 } },
};

// ── Furniture placement ─────────────────────────────────────────────────────

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

  // ── Main office: desks, chairs, monitors ──
  for (const a of Object.values(DESK_ASSIGNMENTS)) {
    items.push(makeFurniture("desk", a.deskTile.x, a.deskTile.y));
    items.push(makeFurniture("chair", a.chairTile.x, a.chairTile.y));
    // Monitor on desk surface
    items.push(makeFurniture("monitor", a.deskTile.x, a.deskTile.y));
  }

  // ── Main office: wall decorations ──
  items.push(makeFurniture("bookshelf", 1, 1));
  items.push(makeFurniture("bookshelf", 5, 1));
  items.push(makeFurniture("whiteboard", 9, 1));
  items.push(makeFurniture("bookshelf", 13, 1));
  items.push(makeFurniture("plant", 1, 12));
  items.push(makeFurniture("plantB", 14, 12));
  items.push(makeFurniture("printer", 1, 6));

  // ── Kitchen ──
  items.push(makeFurniture("vending", 23, 1));
  items.push(makeFurniture("cooler", 21, 1));
  items.push(makeFurniture("clock", 19, 1));
  items.push(makeFurniture("counter", 17, 4));
  items.push(makeFurniture("counterGray", 19, 4));
  items.push(makeFurniture("cabinet", 23, 4));
  items.push(makeFurniture("plant", 17, 1));

  // ── Meeting room / Isabel's design studio ──
  // Isabel's desk area (left side)
  items.push(makeFurniture("painting", 17, 10)); // Isabel's inspiration wall
  items.push(makeFurniture("plant", 19, 10));
  // Conference area (right side)
  items.push(makeFurniture("deskWood", 21, 11));
  items.push(makeFurniture("bookcase", 23, 10));
  items.push(makeFurniture("plantB", 24, 13));
  items.push(makeFurniture("chair", 20, 12));
  items.push(makeFurniture("chair", 23, 12));
  items.push(makeFurniture("lamp", 20, 10));

  return items;
}

// ── Walkable map ────────────────────────────────────────────────────────────

export function buildWalkableMap(furniture: FurnitureItem[]): boolean[][] {
  const map: boolean[][] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    map[y] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      map[y][x] = TILE_MAP[y][x] === F;
    }
  }

  for (const f of furniture) {
    if (!f.solid || f.type === "chair") continue;
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
