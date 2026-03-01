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
  outfits: SpriteSheet[]; // outfit1..6
  suits: SpriteSheet;
  shadow: SpriteSheet;
}

/** Character appearance config for compositing body + hair + outfit layers */
export interface CharacterAppearance {
  /** Row in character-model.png (0-5 = skin tones light→dark) */
  skinRow: number;
  /** Row in hairs.png (0-7 = hair styles) */
  hairRow: number;
  /** Which outfit file (0-5 = outfit1.png through outfit6.png) */
  outfitIndex: number;
}

// ── Floor / room zones ──────────────────────────────────────────────────────

export type FloorType = "wood" | "tile" | "carpet" | "library";

export interface FloorZone {
  x: number;
  y: number;
  w: number;
  h: number;
  type: FloorType;
}

// ── Furniture ───────────────────────────────────────────────────────────────

export interface FurnitureTile {
  dx: number;
  dy: number;
  col: number;
  row: number;
}

export interface FurnitureItem {
  type: string;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
  tiles: FurnitureTile[];
  solid: boolean;
  wallMounted?: boolean;
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
