// ── Pixel Office Types ──────────────────────────────────────────────────────

export type Direction = "down" | "up" | "left" | "right";
export type CharState = "idle" | "walk" | "type";

export interface Vec2 {
  x: number;
  y: number;
}

/** Props passed from CommandCenter (unchanged from current interface) */
export interface AgentData {
  id: string;
  label: string;
  emoji: string;
  color: string;
  status: string;
  isActive: boolean;
}

/** Per-agent color palette resolved from agent.color */
export interface CharacterPalette {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  accent: string;
}

/** 2D pixel array — hex color strings, '' = transparent */
export type SpriteFrame = string[][];

/** Template using single-char keys resolved against a palette */
export type SpriteTemplate = string[][];

/** Runtime character state for the game engine */
export interface Character {
  id: string;
  label: string;
  palette: CharacterPalette;
  state: CharState;
  facing: Direction;
  pos: Vec2; // pixel coords (sub-tile for smooth interpolation)
  path: Vec2[]; // remaining path (tile coords)
  deskTile: Vec2; // assigned seat tile
  animFrame: number;
  animTimer: number;
  idleTimer: number;
  bubble: string | null;
  bubbleTimer: number;
  isActive: boolean;
  status: string;
}

/** Static furniture placed in the office */
export interface FurnitureItem {
  type: string;
  tileX: number;
  tileY: number;
  sprite: SpriteFrame;
  widthTiles: number;
  heightTiles: number;
}

/** A z-sortable renderable entity */
export interface Renderable {
  bottomY: number;
  draw: (ctx: CanvasRenderingContext2D, zoom: number) => void;
}
