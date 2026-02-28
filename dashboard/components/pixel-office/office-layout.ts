// ── Office Layout & Constants ───────────────────────────────────────────────
// Multi-room office: main workspace (left), kitchen (top-right), library (bottom-right)
// Brand: Cornett — venus flytraps, Moss/Rose/Sunset palette, curated maximalism

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
// Left: main office (cols 0-15, rows 0-15) — workspace + lounge
// Right-top: kitchen (cols 16-25, rows 0-7) — break area
// Right-bottom: library (cols 16-25, rows 8-15) — Scout/Strategist research den
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
  // Main office — warm wood floor
  { x: 1, y: 1, w: 14, h: 14, type: "wood" },
  // Kitchen — warm sandstone tile
  { x: 17, y: 1, w: 8, h: 8, type: "tile" },
  // Library — deep moss carpet (Scout & Strategist research den)
  { x: 17, y: 10, w: 8, h: 5, type: "library" },
  // Hallway/corridor connecting rooms
  { x: 16, y: 6, w: 1, h: 4, type: "wood" },
  { x: 15, y: 8, w: 2, h: 2, type: "wood" },
];

// ── Desk assignments (7 agents) ─────────────────────────────────────────────
// Top row: Sentinel, Scout, Oracle (cols 2,7,12 at row 2)
// Bottom row: Architect, Optimize, Strategist (cols 2,7,12 at row 8)
// Isabel: southeast corner of main office (design desk near library)
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
  isabel: { deskTile: { x: 12, y: 12 }, chairTile: { x: 13, y: 14 } },
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

  // ── All agent desks, chairs, monitors ──
  for (const a of Object.values(DESK_ASSIGNMENTS)) {
    items.push(makeFurniture("desk", a.deskTile.x, a.deskTile.y));
    items.push(makeFurniture("chair", a.chairTile.x, a.chairTile.y));
    items.push(makeFurniture("monitor", a.deskTile.x, a.deskTile.y));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN OFFICE — "The Workshop"
  // ══════════════════════════════════════════════════════════════════════════

  // ── North wall: gallery wall with rhythm & variety ──
  items.push(makeFurniture("bookshelf", 1, 1));    // left anchor
  items.push(makeFurniture("painting", 3, 1));      // art break
  items.push(makeFurniture("bookshelf", 5, 1));     // storage
  items.push(makeFurniture("window", 7, 1));         // implied light
  items.push(makeFurniture("whiteboard", 9, 1));     // work tool
  items.push(makeFurniture("clock", 11, 1));         // time (moved from kitchen)
  items.push(makeFurniture("bookshelf", 13, 1));     // right anchor

  // ── Center commons / lounge (rows 5-7) ──
  items.push(makeFurniture("couch", 6, 5));          // statement piece
  items.push(makeFurniture("rug", 5, 6));            // anchors the zone
  items.push(makeFurniture("rug", 7, 6));            // extends the zone
  items.push(makeFurniture("lamp", 8, 5));           // warm light
  items.push(makeFurniture("flytrapB", 9, 5));       // venus flytrap accent

  // ── West wall utility ──
  items.push(makeFurniture("printer", 1, 6));        // supply station
  items.push(makeFurniture("boxes", 3, 6));          // storage vignette

  // ── Desk personality — lived-in touches ──
  items.push(makeFurniture("cup", 4, 2));            // Sentinel's coffee
  items.push(makeFurniture("cup", 9, 2));            // Scout's field mug
  items.push(makeFurniture("lamp", 7, 2));           // Scout's desk lamp
  items.push(makeFurniture("cup", 14, 8));           // Strategist's tea

  // ── South corners — warmth & brand presence ──
  items.push(makeFurniture("flytrap", 1, 12));       // venus flytrap SW corner
  items.push(makeFurniture("lamp", 1, 14));          // floor lamp below plant
  items.push(makeFurniture("rug", 3, 13));           // corner rug anchor
  items.push(makeFurniture("painting", 5, 12));      // south wall art
  items.push(makeFurniture("flytrapB", 10, 12));     // flytrap near Isabel
  items.push(makeFurniture("plantB", 14, 12));       // east greenery

  // ══════════════════════════════════════════════════════════════════════════
  // KITCHEN — "The Canteen"
  // ══════════════════════════════════════════════════════════════════════════

  // ── North wall: warm + functional ──
  items.push(makeFurniture("painting", 17, 1));      // food-themed art (was plant)
  items.push(makeFurniture("window", 19, 1));        // natural light (was clock)
  items.push(makeFurniture("cooler", 21, 1));        // water cooler
  items.push(makeFurniture("vending", 23, 1));       // vending machine

  // ── Counter area ──
  items.push(makeFurniture("counter", 17, 4));       // prep counter
  items.push(makeFurniture("counterGray", 19, 4));   // mix don't match
  items.push(makeFurniture("cup", 21, 4));           // someone's coffee on counter
  items.push(makeFurniture("cabinet", 23, 4));       // storage

  // ── Kitchen accents ──
  items.push(makeFurniture("flytrap", 24, 5));       // venus flytrap east corner
  items.push(makeFurniture("rug", 19, 6));           // kitchen rug — warmth
  items.push(makeFurniture("lamp", 17, 6));          // warm light

  // ══════════════════════════════════════════════════════════════════════════
  // CORRIDOR — "The Gallery Pass"
  // ══════════════════════════════════════════════════════════════════════════

  items.push(makeFurniture("rug", 15, 8));           // threshold rug
  items.push(makeFurniture("lamp", 16, 7));          // warm waypoint

  // ══════════════════════════════════════════════════════════════════════════
  // LIBRARY — "The Research Den" (Scout & Strategist retreat)
  // ══════════════════════════════════════════════════════════════════════════

  // ── North wall: gallery of bookcases + art ──
  items.push(makeFurniture("bookcase", 17, 10));     // tall bookcase left
  items.push(makeFurniture("flytrapB", 19, 10));     // venus flytrap accent
  items.push(makeFurniture("painting", 20, 10));     // inspiration art
  items.push(makeFurniture("bookcase", 22, 10));     // tall bookcase right
  items.push(makeFurniture("lamp", 24, 10));         // reading light

  // ── Reading area: cozy chairs + table ──
  items.push(makeFurniture("deskWood", 19, 12));     // reading table
  items.push(makeFurniture("chairGray", 18, 13));    // reading chair left
  items.push(makeFurniture("chairGray", 21, 13));    // reading chair right
  items.push(makeFurniture("rug", 19, 14));          // rug under reading area
  items.push(makeFurniture("cup", 21, 12));          // someone's tea

  // ── South / corner accents ──
  items.push(makeFurniture("flytrap", 24, 12));      // venus flytrap SE corner
  items.push(makeFurniture("whiteboard", 17, 13));   // idea board

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
    if (!f.solid || f.type === "chair" || f.type === "chairGray") continue;
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
