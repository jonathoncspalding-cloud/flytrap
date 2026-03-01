// ── Sprite Sheet Loader & Compositing System ────────────────────────────────
// Loads PNG sprite sheets and composites character frames from body + hair + outfit layers.
// Furniture uses individual PNG images loaded from /sprites/furniture/.

import type {
  SpriteSheet,
  SpriteSheets,
  CharacterAppearance,
  Direction,
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

// ── Furniture Asset Catalog ─────────────────────────────────────────────────
// Maps ASSET_* IDs (from Pixel Agents editor) to individual PNG metadata.
// These match the exact PNGs that the VS Code extension renders.

export interface FurnitureAsset {
  file: string;         // PNG filename in /sprites/furniture/
  widthPx: number;      // pixel width of the image
  heightPx: number;     // pixel height of the image
  footprintW: number;   // width in tiles (for collision/walkability)
  footprintH: number;   // height in tiles (for collision/walkability)
  solid: boolean;       // blocks walking?
  wallMounted?: boolean; // placed on walls?
  backgroundTiles?: number; // rows drawn behind characters
}

export const FURNITURE_ASSETS: Record<string, FurnitureAsset> = {
  // ── Misc ──
  ASSET_40:  { file: "VENDING_MACHINE.png",    widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_42:  { file: "WATER_COOLER.png",        widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_44:  { file: "BIN.png",                 widthPx: 16, heightPx: 16, footprintW: 1, footprintH: 1, solid: false },
  ASSET_51:  { file: "COFFEE_MUG.png",          widthPx: 16, heightPx: 16, footprintW: 1, footprintH: 1, solid: false },

  // ── Chairs ──
  ASSET_33:  { file: "CHAIR_CUSHIONED_RIGHT.png", widthPx: 16, heightPx: 16, footprintW: 1, footprintH: 1, solid: false },
  ASSET_34:  { file: "CHAIR_CUSHIONED_LEFT.png",  widthPx: 16, heightPx: 16, footprintW: 1, footprintH: 1, solid: false },
  ASSET_49:  { file: "STOOL.png",                 widthPx: 16, heightPx: 16, footprintW: 1, footprintH: 1, solid: false },
  ASSET_NEW_110: { file: "CHAIR_CUSHIONED_LG_RIGHT.png", widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: false },
  ASSET_NEW_111: { file: "CHAIR_CUSHIONED_LG_LEFT.png",  widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: false },

  // ── Desks/Tables ──
  ASSET_7:   { file: "COUNTER_WHITE_SM.png",    widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_27_A: { file: "TABLE_WOOD_LG.png",      widthPx: 32, heightPx: 64, footprintW: 2, footprintH: 4, solid: true,  backgroundTiles: 1 },
  ASSET_NEW_106: { file: "TABLE_WOOD.png",       widthPx: 48, heightPx: 32, footprintW: 3, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_NEW_112: { file: "COFFEE_TABLE_LG.png",  widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: true,  backgroundTiles: 1 },

  // ── Storage ──
  ASSET_17:  { file: "WOODEN_BOOKSHELF_SMALL.png",      widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_18:  { file: "FULL_WOODEN_BOOKSHELF_SMALL.png",  widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_41_0_1: { file: "FRIDGE.png",            widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_139: { file: "CRATES_3.png",             widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: true,  backgroundTiles: 1 },

  // ── Electronics ──
  ASSET_61:  { file: "TELEPHONE.png",           widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: false, wallMounted: true, backgroundTiles: 1 },
  ASSET_90:  { file: "FULL_COMPUTER_COFFEE_OFF.png", widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: false, backgroundTiles: 1 },
  ASSET_99:  { file: "LAPTOP_LEFT.png",          widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: false, backgroundTiles: 1 },
  ASSET_109: { file: "LAPTOP_BACK.png",          widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: false, backgroundTiles: 1 },
  ASSET_123: { file: "SERVER.png",               widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: true,  backgroundTiles: 1 },

  // ── Decor / Plants ──
  ASSET_72:  { file: "BOOK_SINGLE_RED.png",     widthPx: 16, heightPx: 16, footprintW: 1, footprintH: 1, solid: false },
  ASSET_100: { file: "PAPER_SIDE.png",           widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: false, backgroundTiles: 1 },
  ASSET_132: { file: "PLANT_1.png",              widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_140: { file: "WHITE_PLANT_2.png",        widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_141: { file: "WHITE_PLANT_3.png",        widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_142: { file: "PLANT_2.png",              widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_143: { file: "PLANT_3.png",              widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: true,  backgroundTiles: 1 },
  ASSET_148: { file: "MAT_CHESS_BOARD.png",      widthPx: 32, heightPx: 16, footprintW: 2, footprintH: 1, solid: false },

  // ── Wall-mounted ──
  ASSET_83:  { file: "CLOCK_WALL_WHITE.png",     widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: false, wallMounted: true },
  ASSET_84:  { file: "CLOCK_WALL_COLOR.png",     widthPx: 16, heightPx: 32, footprintW: 1, footprintH: 2, solid: false, wallMounted: true },
  ASSET_101: { file: "PAINTING_LANDSCAPE.png",   widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: false, wallMounted: true },
  ASSET_102: { file: "PAINTING_LANDSCAPE_2.png", widthPx: 32, heightPx: 32, footprintW: 2, footprintH: 2, solid: false, wallMounted: true },
};

// ── Furniture Image Loading ─────────────────────────────────────────────────

/** Pre-loaded furniture images keyed by ASSET_* ID */
export const furnitureImages = new Map<string, HTMLImageElement>();

/** Load all furniture PNG images used by the layout */
export async function loadFurnitureImages(): Promise<void> {
  const entries = Object.entries(FURNITURE_ASSETS);
  const results = await Promise.allSettled(
    entries.map(([id, asset]) =>
      loadImage(`/sprites/furniture/${asset.file}`).then((img) => {
        furnitureImages.set(id, img);
      })
    )
  );

  // Log any failures but don't crash
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.warn(`[sprites] Failed to load furniture: ${entries[i][0]} (${entries[i][1].file})`);
    }
  });
}

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
