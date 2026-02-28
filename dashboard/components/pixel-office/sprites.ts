// ── Pixel Art Sprite Data ────────────────────────────────────────────────────
// All sprites are original pixel art. No external assets.
// Format: 2D string arrays. '' = transparent, hex string = color.
// Character templates use keys: H=hair, K=skin, S=shirt, A=accent, P=pants, O=shoes, W=white(eye), E=eye(dark)

import type { SpriteFrame, SpriteTemplate, CharacterPalette } from "./types";

// ── Color Helpers ───────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function darken(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - amount * 100));
}

// ── Palette Builder ─────────────────────────────────────────────────────────

export function buildPalette(agentColor: string): CharacterPalette {
  return {
    skin: "#f4c89a",
    hair: darken(agentColor, 0.25),
    shirt: agentColor,
    pants: "#374151",
    shoes: "#1f2937",
    accent: darken(agentColor, 0.15),
  };
}

// ── Template Resolution ─────────────────────────────────────────────────────

const TEMPLATE_MAP: Record<string, keyof CharacterPalette | null> = {
  H: "hair",
  K: "skin",
  S: "shirt",
  A: "accent",
  P: "pants",
  O: "shoes",
  W: null, // white
  E: null, // eye dark
  "": null, // transparent
};

export function resolveTemplate(
  tmpl: SpriteTemplate,
  palette: CharacterPalette
): SpriteFrame {
  return tmpl.map((row) =>
    row.map((key) => {
      if (key === "") return "";
      if (key === "W") return "#ffffff";
      if (key === "E") return "#1a1a2e";
      const prop = TEMPLATE_MAP[key];
      return prop ? palette[prop] : key; // pass through hex colors
    })
  );
}

// ── Sprite Flipping ─────────────────────────────────────────────────────────

function flipH(tmpl: SpriteTemplate): SpriteTemplate {
  return tmpl.map((row) => [...row].reverse());
}

// ── Character Templates (16×16) ─────────────────────────────────────────────
// Template key shorthand constants
const _ = ""; // transparent
const H = "H"; // hair
const K = "K"; // skin
const S = "S"; // shirt
const A = "A"; // accent
const P = "P"; // pants
const O = "O"; // shoes
const W = "W"; // white (eye)
const E = "E"; // eye (dark)

// ── Walk Down frames (facing viewer) ────────────────────────────────────────
const WALK_DOWN_0: SpriteTemplate = [
  [_, _, _, _, _, H, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, W, E, K, K, W, E, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, A, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _],
];

const WALK_DOWN_1: SpriteTemplate = [
  [_, _, _, _, _, H, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, W, E, K, K, W, E, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, A, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, _, _, _, _, _, _],
  [_, _, _, _, O, O, _, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, O, _, _, _, _, _, O, _, _, _, _, _],
];

const WALK_DOWN_2: SpriteTemplate = WALK_DOWN_0; // neutral stance repeated

const WALK_DOWN_3: SpriteTemplate = [
  [_, _, _, _, _, H, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, W, E, K, K, W, E, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, A, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, O, _, _, _, _, O, _, _, _, _, _],
];

// ── Walk Up frames (facing away) ────────────────────────────────────────────
const WALK_UP_0: SpriteTemplate = [
  [_, _, _, _, _, H, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, A, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _],
];

const WALK_UP_1: SpriteTemplate = [
  [_, _, _, _, _, H, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, A, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, _, _, _, _, _, _],
  [_, _, _, _, O, O, _, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, O, _, _, _, _, _, O, _, _, _, _, _],
];

const WALK_UP_2: SpriteTemplate = WALK_UP_0;

const WALK_UP_3: SpriteTemplate = [
  [_, _, _, _, _, H, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, A, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, O, _, _, _, _, O, _, _, _, _, _],
];

// ── Walk Right frames (profile view) ────────────────────────────────────────
const WALK_RIGHT_0: SpriteTemplate = [
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, W, E, K, _, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, _, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, _, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, O, _, O, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, O, _, O, _, _, _, _, _, _, _],
];

const WALK_RIGHT_1: SpriteTemplate = [
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, W, E, K, _, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, P, _, _, P, _, _, _, _, _, _, _],
  [_, _, _, _, O, _, _, _, _, O, _, _, _, _, _, _],
  [_, _, _, _, O, _, _, _, _, _, _, _, _, _, _, _],
];

const WALK_RIGHT_2: SpriteTemplate = WALK_RIGHT_0;

const WALK_RIGHT_3: SpriteTemplate = [
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, W, E, K, _, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, _, _, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, O, _, _, _, _, _],
];

// Left = flipped right
const WALK_LEFT_0 = flipH(WALK_RIGHT_0);
const WALK_LEFT_1 = flipH(WALK_RIGHT_1);
const WALK_LEFT_2 = flipH(WALK_RIGHT_2);
const WALK_LEFT_3 = flipH(WALK_RIGHT_3);

// ── Type frames (facing up, at desk) ────────────────────────────────────────
const TYPE_0: SpriteTemplate = [
  [_, _, _, _, _, H, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, A, A, S, S, S, S, S, A, A, _, _, _, _],
  [_, _, _, A, _, S, S, S, S, S, _, A, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _],
];

const TYPE_1: SpriteTemplate = [
  [_, _, _, _, _, H, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, H, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, A, S, S, S, S, S, A, _, _, _, _, _],
  [_, _, A, A, _, S, S, S, S, S, _, A, A, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _],
];

// ── Collected Walk Templates ────────────────────────────────────────────────

export const WALK_TEMPLATES: Record<string, SpriteTemplate[]> = {
  down: [WALK_DOWN_0, WALK_DOWN_1, WALK_DOWN_2, WALK_DOWN_3],
  up: [WALK_UP_0, WALK_UP_1, WALK_UP_2, WALK_UP_3],
  right: [WALK_RIGHT_0, WALK_RIGHT_1, WALK_RIGHT_2, WALK_RIGHT_3],
  left: [WALK_LEFT_0, WALK_LEFT_1, WALK_LEFT_2, WALK_LEFT_3],
};

export const TYPE_TEMPLATES: SpriteTemplate[] = [TYPE_0, TYPE_1];

// ── Furniture Sprites (fixed colors) ────────────────────────────────────────

// Desk: 32×16 (2 tiles wide × 1 tile tall)
const DK = "#5c3d2e"; // dark wood
const DL = "#7a5540"; // light wood
const DE = "#4a2f22"; // edge

export const DESK_SPRITE: SpriteFrame = (() => {
  const s: SpriteFrame = Array.from({ length: 16 }, () =>
    new Array(32).fill("")
  );
  // Surface
  for (let y = 2; y < 10; y++)
    for (let x = 1; x < 31; x++) s[y][x] = y < 4 ? DL : DK;
  // Front edge
  for (let y = 10; y < 13; y++)
    for (let x = 1; x < 31; x++) s[y][x] = DE;
  // Legs
  for (let y = 13; y < 16; y++) {
    s[y][2] = DE;
    s[y][3] = DE;
    s[y][28] = DE;
    s[y][29] = DE;
  }
  return s;
})();

// Chair: 16×16
export const CHAIR_SPRITE: SpriteFrame = (() => {
  const s: SpriteFrame = Array.from({ length: 16 }, () =>
    new Array(16).fill("")
  );
  // Seat
  for (let y = 8; y < 12; y++)
    for (let x = 4; x < 12; x++) s[y][x] = "#374151";
  // Backrest
  for (let y = 3; y < 9; y++)
    for (let x = 5; x < 11; x++) s[y][x] = "#4b5563";
  // Legs
  s[12][5] = "#6b7280";
  s[12][10] = "#6b7280";
  s[13][4] = "#6b7280";
  s[13][11] = "#6b7280";
  return s;
})();

// PC Monitor: 16×16
export const PC_SPRITE: SpriteFrame = (() => {
  const s: SpriteFrame = Array.from({ length: 16 }, () =>
    new Array(16).fill("")
  );
  // Screen frame
  for (let y = 1; y < 10; y++)
    for (let x = 3; x < 13; x++) s[y][x] = "#1f2937";
  // Screen (glow)
  for (let y = 2; y < 9; y++)
    for (let x = 4; x < 12; x++) s[y][x] = "#1e3a5f";
  // Screen highlight
  for (let y = 2; y < 5; y++)
    for (let x = 4; x < 8; x++) s[y][x] = "#264d73";
  // Stand
  s[10][7] = "#4b5563";
  s[10][8] = "#4b5563";
  s[11][6] = "#4b5563";
  s[11][7] = "#4b5563";
  s[11][8] = "#4b5563";
  s[11][9] = "#4b5563";
  return s;
})();

// Plant: 16×24 (draws above its tile)
export const PLANT_SPRITE: SpriteFrame = (() => {
  const s: SpriteFrame = Array.from({ length: 24 }, () =>
    new Array(16).fill("")
  );
  const G1 = "#22c55e",
    G2 = "#16a34a",
    G3 = "#15803d";
  const PT = "#92400e",
    PB = "#78350f";
  // Leaves
  for (let y = 2; y < 12; y++)
    for (let x = 3; x < 13; x++) {
      if (Math.abs(x - 8) + Math.abs(y - 6) < 7) s[y][x] = G1;
    }
  for (let y = 3; y < 10; y++)
    for (let x = 5; x < 11; x++) s[y][x] = G2;
  s[4][7] = G3;
  s[5][8] = G3;
  s[6][6] = G3;
  // Stem
  s[12][7] = G3;
  s[12][8] = G3;
  s[13][7] = G3;
  s[13][8] = G3;
  // Pot
  for (let y = 14; y < 20; y++)
    for (let x = 5; x < 11; x++) s[y][x] = y < 16 ? PT : PB;
  // Pot rim
  for (let x = 4; x < 12; x++) s[14][x] = PT;
  return s;
})();

// Bookshelf: 16×32 (draws above its tile, 2 tiles tall)
export const BOOKSHELF_SPRITE: SpriteFrame = (() => {
  const s: SpriteFrame = Array.from({ length: 32 }, () =>
    new Array(16).fill("")
  );
  const WD = "#5c4033",
    SH = "#7a5540";
  // Frame
  for (let y = 0; y < 32; y++) {
    s[y][1] = WD;
    s[y][14] = WD;
  }
  // Top
  for (let x = 1; x < 15; x++) s[0][x] = WD;
  // Shelves
  for (const sy of [0, 8, 16, 24, 31]) {
    for (let x = 1; x < 15; x++) s[sy][x] = SH;
  }
  // Books (rows of colored spines)
  const bookColors = ["#ef4444", "#3b82f6", "#22c55e", "#fbbf24", "#a855f7"];
  for (const [rowStart, rowEnd] of [
    [1, 8],
    [9, 16],
    [17, 24],
    [25, 31],
  ] as [number, number][]) {
    for (let x = 2; x < 14; x++) {
      const c = bookColors[(x + rowStart) % bookColors.length];
      for (let y = rowStart + 1; y < rowEnd; y++) s[y][x] = c;
    }
  }
  return s;
})();

// Cooler: 16×24
export const COOLER_SPRITE: SpriteFrame = (() => {
  const s: SpriteFrame = Array.from({ length: 24 }, () =>
    new Array(16).fill("")
  );
  // Jug (top)
  for (let y = 2; y < 10; y++)
    for (let x = 5; x < 11; x++) s[y][x] = "#bfdbfe";
  for (let y = 3; y < 8; y++)
    for (let x = 6; x < 10; x++) s[y][x] = "#93c5fd";
  // Body
  for (let y = 10; y < 22; y++)
    for (let x = 4; x < 12; x++) s[y][x] = "#e5e7eb";
  // Front panel
  for (let y = 14; y < 18; y++)
    for (let x = 5; x < 11; x++) s[y][x] = "#d1d5db";
  // Spigot
  s[18][7] = "#6b7280";
  s[18][8] = "#6b7280";
  // Legs
  s[22][5] = "#6b7280";
  s[22][10] = "#6b7280";
  s[23][5] = "#6b7280";
  s[23][10] = "#6b7280";
  return s;
})();

// Lamp: 16×16
export const LAMP_SPRITE: SpriteFrame = (() => {
  const s: SpriteFrame = Array.from({ length: 16 }, () =>
    new Array(16).fill("")
  );
  // Shade
  for (let y = 1; y < 6; y++)
    for (let x = 4; x < 12; x++) s[y][x] = "#fbbf24";
  // Glow highlight
  s[2][6] = "#fde68a";
  s[2][7] = "#fde68a";
  s[3][7] = "#fde68a";
  // Pole
  for (let y = 6; y < 14; y++) {
    s[y][7] = "#9ca3af";
    s[y][8] = "#9ca3af";
  }
  // Base
  for (let x = 5; x < 11; x++) {
    s[14][x] = "#6b7280";
    s[15][x] = "#6b7280";
  }
  return s;
})();

// ── Sprite Cache (OffscreenCanvas at zoom) ──────────────────────────────────

const cache = new Map<string, HTMLCanvasElement>();

export function clearSpriteCache(): void {
  cache.clear();
}

export function getCachedSprite(
  key: string,
  sprite: SpriteFrame,
  zoom: number
): HTMLCanvasElement {
  const cacheKey = `${key}_${zoom}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const h = sprite.length;
  const w = sprite[0].length;
  const canvas = document.createElement("canvas");
  canvas.width = w * zoom;
  canvas.height = h * zoom;
  const ctx = canvas.getContext("2d")!;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = sprite[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }
  }

  cache.set(cacheKey, canvas);
  return canvas;
}
