// ── Sprite Sheet Loader & Compositing System ────────────────────────────────
// Loads PNG sprite sheets and composites character frames from body + hair + outfit layers.
// Furniture tiles are referenced by (col, row) coordinates in the office tileset.

import type {
  SpriteSheet,
  SpriteSheets,
  CharacterAppearance,
  Direction,
  FurnitureTile,
} from "./types";

// ── Sheet Loading ───────────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

function makeSheet(
  img: HTMLImageElement,
  cellW: number,
  cellH: number
): SpriteSheet {
  return {
    img,
    cellW,
    cellH,
    cols: Math.floor(img.width / cellW),
    rows: Math.floor(img.height / cellH),
  };
}

export async function loadAllSheets(): Promise<SpriteSheets> {
  const [
    tileset,
    characterModel,
    hairs,
    o1,
    o2,
    o3,
    o4,
    o5,
    o6,
    o7,
    suits,
    shadow,
  ] = await Promise.all([
    loadImage("/sprites/tileset.png"),
    loadImage("/sprites/character-model.png"),
    loadImage("/sprites/hairs.png"),
    loadImage("/sprites/outfit1.png"),
    loadImage("/sprites/outfit2.png"),
    loadImage("/sprites/outfit3.png"),
    loadImage("/sprites/outfit4.png"),
    loadImage("/sprites/outfit5.png"),
    loadImage("/sprites/outfit6.png"),
    loadImage("/sprites/outfit7.png"),
    loadImage("/sprites/suits.png"),
    loadImage("/sprites/shadow.png"),
  ]);

  return {
    tileset: makeSheet(tileset, 16, 16),
    characterModel: makeSheet(characterModel, 32, 32),
    hairs: makeSheet(hairs, 32, 32),
    outfits: [o1, o2, o3, o4, o5, o6, o7].map((img) => makeSheet(img, 32, 32)),
    suits: makeSheet(suits, 32, 32),
    shadow: makeSheet(shadow, 32, 32),
  };
}

// ── Character Frame Compositing ─────────────────────────────────────────────

/**
 * MetroCity sprite sheets use RPG Maker layout:
 * - 24 columns × N rows of 32×32 cells
 * - Each row has 2 character blocks (cols 0-11 and 12-23)
 * - Within each 12-col block: 4 directions × 3 walk frames
 *   - Cols 0-2: Down, Cols 3-5: Left, Cols 6-8: Right, Cols 9-11: Up
 *   - Frame 0: left foot, Frame 1: standing, Frame 2: right foot
 */

const DIR_COL_OFFSET: Record<Direction, number> = {
  down: 0,
  left: 3,
  right: 6,
  up: 9,
};

/** Convert direction + walk frame (0-2) to column index */
function charCol(dir: Direction, frame: number): number {
  return DIR_COL_OFFSET[dir] + Math.min(frame, 2);
}

const charSpriteCache = new Map<string, HTMLCanvasElement>();

export function clearSpriteCache(): void {
  charSpriteCache.clear();
}

/**
 * Composite a character frame from body + outfit + hair layers.
 * Returns a cached 32×32 canvas (at 1x, will be scaled during draw).
 */
export function getCharacterFrame(
  sheets: SpriteSheets,
  appearance: CharacterAppearance,
  dir: Direction,
  frame: number
): HTMLCanvasElement {
  const col = charCol(dir, frame);
  const key = `char_${appearance.skinRow}_${appearance.hairRow}_${appearance.outfitIndex}_${col}`;
  const existing = charSpriteCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;

  // Layer 1: Body (from character-model.png)
  const bodySheet = sheets.characterModel;
  ctx.drawImage(
    bodySheet.img,
    col * 32,
    appearance.skinRow * 32,
    32,
    32,
    0,
    0,
    32,
    32
  );

  // Layer 2: Outfit
  const outfitSheet = sheets.outfits[appearance.outfitIndex];
  if (outfitSheet) {
    ctx.drawImage(outfitSheet.img, col * 32, 0, 32, 32, 0, 0, 32, 32);
  }

  // Layer 3: Hair (from hairs.png)
  const hairSheet = sheets.hairs;
  ctx.drawImage(
    hairSheet.img,
    col * 32,
    appearance.hairRow * 32,
    32,
    32,
    0,
    0,
    32,
    32
  );

  charSpriteCache.set(key, canvas);
  return canvas;
}

// ── Agent Appearance Assignments ────────────────────────────────────────────

export const AGENT_APPEARANCES: Record<string, CharacterAppearance> = {
  sentinel: { skinRow: 3, hairRow: 7, outfitIndex: 0 },
  scout: { skinRow: 2, hairRow: 0, outfitIndex: 1 },
  oracle: { skinRow: 0, hairRow: 1, outfitIndex: 2 },
  architect: { skinRow: 4, hairRow: 3, outfitIndex: 3 },
  optimize: { skinRow: 1, hairRow: 6, outfitIndex: 4 },
  strategist: { skinRow: 5, hairRow: 5, outfitIndex: 5 },
  isabel: { skinRow: 4, hairRow: 2, outfitIndex: 6 },
};

// ── Furniture Tile Catalog ──────────────────────────────────────────────────
// Coordinates reference the office tileset (16×16 grid, 16 cols × 32 rows)

export interface FurnitureDef {
  widthTiles: number;
  heightTiles: number;
  tiles: FurnitureTile[];
  solid: boolean;
  wallMounted?: boolean;
}

export const FURNITURE_DEFS: Record<string, FurnitureDef> = {
  // Brown desk (2×2 tiles)
  desk: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 2, row: 0 },
      { dx: 1, dy: 0, col: 3, row: 0 },
      { dx: 0, dy: 1, col: 2, row: 1 },
      { dx: 1, dy: 1, col: 3, row: 1 },
    ],
    solid: true,
  },

  // Large wood desk variant (2×2)
  deskWood: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 4, row: 0 },
      { dx: 1, dy: 0, col: 5, row: 0 },
      { dx: 0, dy: 1, col: 4, row: 1 },
      { dx: 1, dy: 1, col: 5, row: 1 },
    ],
    solid: true,
  },

  // Pink/maroon chair (1×1)
  chair: {
    widthTiles: 1,
    heightTiles: 1,
    tiles: [{ dx: 0, dy: 0, col: 0, row: 16 }],
    solid: false,
  },

  // Office chair variant
  chairGray: {
    widthTiles: 1,
    heightTiles: 1,
    tiles: [{ dx: 0, dy: 0, col: 4, row: 16 }],
    solid: false,
  },

  // PC/Computer (2×2)
  pc: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 10, row: 24 },
      { dx: 1, dy: 0, col: 11, row: 24 },
      { dx: 0, dy: 1, col: 10, row: 25 },
      { dx: 1, dy: 1, col: 11, row: 25 },
    ],
    solid: true,
  },

  // Desktop monitor (1×1, sits on desk)
  monitor: {
    widthTiles: 1,
    heightTiles: 1,
    tiles: [{ dx: 0, dy: 0, col: 12, row: 22 }],
    solid: false,
  },

  // Bookshelf with colored spines (2×2)
  bookshelf: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 14, row: 4 },
      { dx: 1, dy: 0, col: 15, row: 4 },
      { dx: 0, dy: 1, col: 14, row: 5 },
      { dx: 1, dy: 1, col: 15, row: 5 },
    ],
    solid: true,
  },

  // Tall bookcase (2×2)
  bookcase: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 12, row: 12 },
      { dx: 1, dy: 0, col: 13, row: 12 },
      { dx: 0, dy: 1, col: 12, row: 13 },
      { dx: 1, dy: 1, col: 13, row: 13 },
    ],
    solid: true,
  },

  // Plant (1×2 tall)
  plant: {
    widthTiles: 1,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 2, row: 28 },
      { dx: 0, dy: 1, col: 2, row: 29 },
    ],
    solid: true,
  },

  // Plant variant
  plantB: {
    widthTiles: 1,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 4, row: 28 },
      { dx: 0, dy: 1, col: 4, row: 29 },
    ],
    solid: true,
  },

  // Wall clock (1×2)
  clock: {
    widthTiles: 1,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 0, row: 22 },
      { dx: 0, dy: 1, col: 0, row: 23 },
    ],
    solid: false,
    wallMounted: true,
  },

  // Landscape painting (2×2)
  painting: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 4, row: 24 },
      { dx: 1, dy: 0, col: 5, row: 24 },
      { dx: 0, dy: 1, col: 4, row: 25 },
      { dx: 1, dy: 1, col: 5, row: 25 },
    ],
    solid: false,
    wallMounted: true,
  },

  // Chart/whiteboard (2×2)
  whiteboard: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 2, row: 26 },
      { dx: 1, dy: 0, col: 3, row: 26 },
      { dx: 0, dy: 1, col: 2, row: 27 },
      { dx: 1, dy: 1, col: 3, row: 27 },
    ],
    solid: false,
    wallMounted: true,
  },

  // Vending machine (2×2)
  vending: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 14, row: 16 },
      { dx: 1, dy: 0, col: 15, row: 16 },
      { dx: 0, dy: 1, col: 14, row: 17 },
      { dx: 1, dy: 1, col: 15, row: 17 },
    ],
    solid: true,
  },

  // Water cooler (1×2)
  cooler: {
    widthTiles: 1,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 8, row: 16 },
      { dx: 0, dy: 1, col: 8, row: 17 },
    ],
    solid: true,
  },

  // Long counter (2×2)
  counter: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 4, row: 18 },
      { dx: 1, dy: 0, col: 5, row: 18 },
      { dx: 0, dy: 1, col: 4, row: 19 },
      { dx: 1, dy: 1, col: 5, row: 19 },
    ],
    solid: true,
  },

  // Gray counter variant
  counterGray: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 6, row: 18 },
      { dx: 1, dy: 0, col: 7, row: 18 },
      { dx: 0, dy: 1, col: 6, row: 19 },
      { dx: 1, dy: 1, col: 7, row: 19 },
    ],
    solid: true,
  },

  // Window (2×2)
  window: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 4, row: 20 },
      { dx: 1, dy: 0, col: 5, row: 20 },
      { dx: 0, dy: 1, col: 4, row: 21 },
      { dx: 1, dy: 1, col: 5, row: 21 },
    ],
    solid: false,
    wallMounted: true,
  },

  // Filing cabinet (2×2)
  cabinet: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 12, row: 8 },
      { dx: 1, dy: 0, col: 13, row: 8 },
      { dx: 0, dy: 1, col: 12, row: 9 },
      { dx: 1, dy: 1, col: 13, row: 9 },
    ],
    solid: true,
  },

  // Couch section (2×2)
  couch: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 0, row: 16 },
      { dx: 1, dy: 0, col: 1, row: 16 },
      { dx: 0, dy: 1, col: 0, row: 17 },
      { dx: 1, dy: 1, col: 1, row: 17 },
    ],
    solid: true,
  },

  // Printer (2×2)
  printer: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 10, row: 26 },
      { dx: 1, dy: 0, col: 11, row: 26 },
      { dx: 0, dy: 1, col: 10, row: 27 },
      { dx: 1, dy: 1, col: 11, row: 27 },
    ],
    solid: true,
  },

  // Coffee cup (1×1)
  cup: {
    widthTiles: 1,
    heightTiles: 1,
    tiles: [{ dx: 0, dy: 0, col: 6, row: 16 }],
    solid: false,
  },

  // Lamp (1×1)
  lamp: {
    widthTiles: 1,
    heightTiles: 1,
    tiles: [{ dx: 0, dy: 0, col: 14, row: 20 }],
    solid: false,
  },

  // Boxes (2×2)
  boxes: {
    widthTiles: 2,
    heightTiles: 2,
    tiles: [
      { dx: 0, dy: 0, col: 10, row: 28 },
      { dx: 1, dy: 0, col: 11, row: 28 },
      { dx: 0, dy: 1, col: 10, row: 29 },
      { dx: 1, dy: 1, col: 11, row: 29 },
    ],
    solid: true,
  },

  // Rug/mat (2×1)
  rug: {
    widthTiles: 2,
    heightTiles: 1,
    tiles: [
      { dx: 0, dy: 0, col: 0, row: 30 },
      { dx: 1, dy: 0, col: 1, row: 30 },
    ],
    solid: false,
  },
};

// ── Tileset Draw Helpers ────────────────────────────────────────────────────

/** Draw a single 16×16 tile from the tileset onto the canvas */
export function drawTilesetTile(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  col: number,
  row: number,
  destX: number,
  destY: number,
  zoom: number
): void {
  ctx.drawImage(
    sheet.img,
    col * 16,
    row * 16,
    16,
    16,
    destX,
    destY,
    16 * zoom,
    16 * zoom
  );
}
