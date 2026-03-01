// ── Shared types for the pixel office ────────────────────────────────────────

export type Direction = "down" | "up" | "left" | "right";
export type CharState = "idle" | "walk" | "type";

export interface Vec2 {
  x: number;
  y: number;
}

// ── Sprite sheet system ─────────────────────────────────────────────────────

export interface SpriteSheet {
  img: HTMLImageElement;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
}

export interface SpriteSheets {
  tileset: SpriteSheet;
  characterModel: SpriteSheet;
  hairs: SpriteSheet;
  outfits: SpriteSheet[]; // outfit1..7
  suits: SpriteSheet;
  shadow: SpriteSheet;
}

/** Character appearance config for compositing body + hair + outfit layers */
export interface CharacterAppearance {
  /** Row in character-model.png (0-5 = skin tones light→dark) */
  skinRow: number;
  /** Row in hairs.png (0-7 = hair styles) */
  hairRow: number;
  /** Which outfit file (0-6 = outfit1.png through outfit7.png) */
  outfitIndex: number;
}

// ── Floor / tile colors ─────────────────────────────────────────────────────

export type FloorType = "wood" | "tile" | "carpet" | "library";

export interface FloorZone {
  x: number;
  y: number;
  w: number;
  h: number;
  type: FloorType;
}

/** HSB color with contrast — matches Pixel Agents FloorColor */
export interface FloorColor {
  h: number;
  s: number;
  b: number;
  c: number;
}

// ── Furniture ───────────────────────────────────────────────────────────────

/** Catalog entry loaded from furniture-catalog.json */
export interface FurnitureCatalogEntry {
  id: string;
  name: string;
  label: string;
  category: string;
  file: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  canPlaceOnWalls?: boolean;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
}

/** A placed furniture item in the scene */
export interface FurnitureItem {
  type: string;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
  /** Pixel dimensions of the sprite */
  pixelW: number;
  pixelH: number;
  solid: boolean;
  wallMounted?: boolean;
  /** Color override from layout */
  color?: FloorColor;
}

// ── Characters ──────────────────────────────────────────────────────────────

export interface Character {
  id: string;
  label: string;
  color: string;
  appearance: CharacterAppearance;
  state: CharState;
  facing: Direction;
  pos: Vec2;
  path: Vec2[];
  deskTile: Vec2;
  animFrame: number;
  animTimer: number;
  idleTimer: number;
  bubble: string | null;
  bubbleTimer: number;
  greetTimer: number;
  isActive: boolean;
  status: string;
}

// ── Renderable (for z-sorting) ──────────────────────────────────────────────

export interface Renderable {
  bottomY: number;
  draw: (ctx: CanvasRenderingContext2D, z: number) => void;
}

// ── Agent data from parent ──────────────────────────────────────────────────

export interface AgentData {
  id: string;
  label: string;
  emoji: string;
  color: string;
  status: string;
  isActive: boolean;
}
