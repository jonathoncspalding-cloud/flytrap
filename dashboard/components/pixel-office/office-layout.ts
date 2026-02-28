// ── Office Layout & Constants ───────────────────────────────────────────────

import type { Vec2, FurnitureItem } from "./types";
import {
  DESK_SPRITE,
  CHAIR_SPRITE,
  PC_SPRITE,
  PLANT_SPRITE,
  BOOKSHELF_SPRITE,
  COOLER_SPRITE,
  LAMP_SPRITE,
} from "./sprites";

export const TILE_SIZE = 16;
export const GRID_COLS = 20;
export const GRID_ROWS = 12;
export const WORLD_W = GRID_COLS * TILE_SIZE; // 320
export const WORLD_H = GRID_ROWS * TILE_SIZE; // 192

// ── Tile grid (0=floor, 1=wall) ─────────────────────────────────────────────
// Walls on top row + side columns
const W = 1;
const F = 0;

export const TILE_MAP: number[][] = [
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
];

// ── Desk assignments (6 agents, 2 rows × 3 cols) ───────────────────────────
// Each desk is 2 tiles wide. Chair is 1 tile below the desk (agent faces up).
// PC monitor sits on the desk tile.
export const DESK_ASSIGNMENTS: Record<
  string,
  { deskTile: Vec2; chairTile: Vec2; pcTile: Vec2 }
> = {
  sentinel: {
    deskTile: { x: 3, y: 2 },
    chairTile: { x: 4, y: 3 },
    pcTile: { x: 3, y: 2 },
  },
  scout: {
    deskTile: { x: 9, y: 2 },
    chairTile: { x: 10, y: 3 },
    pcTile: { x: 9, y: 2 },
  },
  oracle: {
    deskTile: { x: 15, y: 2 },
    chairTile: { x: 16, y: 3 },
    pcTile: { x: 15, y: 2 },
  },
  architect: {
    deskTile: { x: 3, y: 7 },
    chairTile: { x: 4, y: 8 },
    pcTile: { x: 3, y: 7 },
  },
  optimize: {
    deskTile: { x: 9, y: 7 },
    chairTile: { x: 10, y: 8 },
    pcTile: { x: 9, y: 7 },
  },
  strategist: {
    deskTile: { x: 15, y: 7 },
    chairTile: { x: 16, y: 8 },
    pcTile: { x: 15, y: 7 },
  },
};

// ── Furniture placement ─────────────────────────────────────────────────────
export function buildFurnitureList(): FurnitureItem[] {
  const items: FurnitureItem[] = [];

  // Desks, chairs, and PCs for each agent
  for (const a of Object.values(DESK_ASSIGNMENTS)) {
    items.push({
      type: "desk",
      tileX: a.deskTile.x,
      tileY: a.deskTile.y,
      sprite: DESK_SPRITE,
      widthTiles: 2,
      heightTiles: 1,
    });
    items.push({
      type: "chair",
      tileX: a.chairTile.x,
      tileY: a.chairTile.y,
      sprite: CHAIR_SPRITE,
      widthTiles: 1,
      heightTiles: 1,
    });
    items.push({
      type: "pc",
      tileX: a.pcTile.x,
      tileY: a.pcTile.y,
      sprite: PC_SPRITE,
      widthTiles: 1,
      heightTiles: 1,
    });
  }

  // Decorations
  items.push({ type: "plant", tileX: 1, tileY: 1, sprite: PLANT_SPRITE, widthTiles: 1, heightTiles: 1 });
  items.push({ type: "plant", tileX: 18, tileY: 1, sprite: PLANT_SPRITE, widthTiles: 1, heightTiles: 1 });
  items.push({ type: "bookshelf", tileX: 10, tileY: 1, sprite: BOOKSHELF_SPRITE, widthTiles: 1, heightTiles: 2 });
  items.push({ type: "cooler", tileX: 1, tileY: 10, sprite: COOLER_SPRITE, widthTiles: 1, heightTiles: 1 });
  items.push({ type: "lamp", tileX: 18, tileY: 10, sprite: LAMP_SPRITE, widthTiles: 1, heightTiles: 1 });

  return items;
}

// ── Walkable map ────────────────────────────────────────────────────────────
// Floor tiles that are not occupied by furniture (desks, bookshelves, etc.)
// Chair tiles ARE walkable (the assigned agent sits there)
export function buildWalkableMap(furniture: FurnitureItem[]): boolean[][] {
  const map: boolean[][] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    map[y] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      map[y][x] = TILE_MAP[y][x] === F; // floor = walkable
    }
  }

  // Block furniture tiles (except chairs — agents sit on those)
  for (const f of furniture) {
    if (f.type === "chair") continue;
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
