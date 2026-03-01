// ── Sprite Sheet Loader & Compositing System ────────────────────────────────
// Loads PNG sprite sheets for characters and individual furniture PNGs.
// Furniture sprites are loaded from /sprites/furniture/ by ASSET_* ID.

import type {
  SpriteSheet,
  SpriteSheets,
  CharacterAppearance,
  Direction,
  FurnitureCatalogEntry,
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

const DIR_COL_OFFSET: Record<Direction, number> = {
  down: 0,
  left: 3,
  right: 6,
  up: 9,
};

function charCol(dir: Direction, frame: number): number {
  return DIR_COL_OFFSET[dir] + Math.min(frame, 2);
}

const charSpriteCache = new Map<string, HTMLCanvasElement>();

export function clearSpriteCache(): void {
  charSpriteCache.clear();
}

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

  const outfitSheet = sheets.outfits[appearance.outfitIndex];
  if (outfitSheet) {
    ctx.drawImage(outfitSheet.img, col * 32, 0, 32, 32, 0, 0, 32, 32);
  }

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

// ── Furniture Sprite System (Individual PNGs) ───────────────────────────────

/** Loaded furniture catalog + sprite images */
let furnitureCatalog: FurnitureCatalogEntry[] = [];
const furnitureSprites = new Map<string, HTMLImageElement>();
let furnitureLoaded = false;

/** Load furniture catalog and all sprite PNGs */
export async function loadFurnitureAssets(): Promise<void> {
  try {
    const resp = await fetch("/sprites/furniture/furniture-catalog.json");
    if (!resp.ok) {
      console.warn("[sprites] Failed to load furniture catalog:", resp.status);
      return;
    }
    const data = await resp.json();
    furnitureCatalog = data.assets || [];

    // Load all PNGs in parallel
    const loadPromises = furnitureCatalog.map(async (asset) => {
      try {
        const img = await loadImage(`/sprites/${asset.file}`);
        furnitureSprites.set(asset.id, img);
      } catch {
        console.warn(`[sprites] Failed to load furniture: ${asset.id} (${asset.file})`);
      }
    });

    await Promise.all(loadPromises);
    furnitureLoaded = true;
    console.log(`[sprites] Loaded ${furnitureSprites.size}/${furnitureCatalog.length} furniture sprites`);
  } catch (err) {
    console.warn("[sprites] Error loading furniture assets:", err);
  }
}

/** Whether furniture sprites are loaded */
export function hasFurnitureAssets(): boolean {
  return furnitureLoaded;
}

/** Get the HTMLImageElement for a furniture asset ID */
export function getFurnitureSprite(assetId: string): HTMLImageElement | undefined {
  return furnitureSprites.get(assetId);
}

/** Get catalog entry for a furniture asset ID */
export function getFurnitureCatalogEntry(assetId: string): FurnitureCatalogEntry | undefined {
  return furnitureCatalog.find((e) => e.id === assetId);
}

/** Get the full catalog */
export function getFurnitureCatalog(): FurnitureCatalogEntry[] {
  return furnitureCatalog;
}

// ── Tileset Draw Helpers (still used for fallback) ──────────────────────────

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
