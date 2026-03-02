// dashboard/lib/isabel-canvas.ts

type RGB = [number, number, number];

type DrawCategory = "Paintings" | "Plants" | "Rug" | "Bookcases" | "Loveseats" | "Coffee Table";

export interface DesignOption {
  label: string;
  description: string;
  colors?: RGB[];      // template mode
  palette?: RGB[];     // pixel mode
  rows?: string[];     // pixel mode — palette-indexed row strings
}

export interface DesignSpec {
  mode?: "template" | "pixel";
  category: DrawCategory;
  footprint: { w: number; h: number };
  options: DesignOption[];
}

/** Render a single design option to a base64 PNG data URI. */
export function renderDesign(
  category: DrawCategory,
  w: number,
  h: number,
  colors: RGB[],
  option?: DesignOption
): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Pixel mode: option has palette + rows
  if (option?.palette && option?.rows) {
    renderPixelDesign(ctx, w, h, option.palette, option.rows);
    return canvas.toDataURL("image/png");
  }

  // Template mode: use category-specific draw functions
  switch (category) {
    case "Paintings": drawPainting(ctx, w, h, colors); break;
    case "Plants": drawPlant(ctx, w, h, colors); break;
    case "Rug": drawRug(ctx, w, h, colors); break;
    case "Bookcases": drawBookcase(ctx, w, h, colors); break;
    case "Loveseats": drawLoveseat(ctx, w, h, colors); break;
    case "Coffee Table": drawCoffeeTable(ctx, w, h, colors); break;
  }

  return canvas.toDataURL("image/png");
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: number, b: number, a = 255) {
  ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
  ctx.fillRect(x, y, 1, 1);
}

function clamp(v: number, lo = 0, hi = 255) { return Math.max(lo, Math.min(hi, v)); }
function noise(v: number, range = 10) { return clamp(v + Math.floor(Math.random() * range * 2) - range); }

/**
 * Render pixel art from a palette-indexed row grid.
 * Each char in a row maps to a palette index (0-f hex) or '.' for transparent.
 */
function renderPixelDesign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: RGB[],
  rows: string[]
) {
  for (let y = 0; y < Math.min(rows.length, h); y++) {
    const row = rows[y];
    for (let x = 0; x < Math.min(row.length, w); x++) {
      const ch = row[x];
      if (ch === ".") continue; // transparent
      const idx = parseInt(ch, 16);
      if (isNaN(idx) || idx >= palette.length) continue;
      const [r, g, b] = palette[idx];
      px(ctx, x, y, r, g, b);
    }
  }
}

function drawPainting(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const frame: RGB = [40, 30, 20];
  for (let x = 0; x < w; x++) { px(ctx, x, 0, ...frame); px(ctx, x, h - 1, ...frame); }
  for (let y = 0; y < h; y++) { px(ctx, 0, y, ...frame); px(ctx, w - 1, y, ...frame); }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const ratio = (x / w) * 0.6 + (y / h) * 0.4;
      const idx = Math.min(Math.floor(ratio * (colors.length - 1)), colors.length - 1);
      const c = colors[idx];
      px(ctx, x, y, noise(c[0]), noise(c[1]), noise(c[2]));
    }
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const potColor = colors[4] || [120, 70, 40];
  const potDark: RGB = [Math.max(0, potColor[0] - 30), Math.max(0, potColor[1] - 30), Math.max(0, potColor[2] - 30)];
  const potTop = Math.floor(h * 2 / 3);
  for (let y = potTop; y < h; y++) {
    const indent = Math.max(0, Math.floor((y - potTop) / 3));
    for (let x = 2 + indent; x < w - 2 - indent; x++) {
      const c = x < w / 2 ? potColor : potDark;
      px(ctx, x, y, ...c);
    }
  }
  for (let x = 1; x < w - 1; x++) {
    px(ctx, x, potTop, ...potColor);
    px(ctx, x, potTop - 1, ...potDark);
  }
  const leafColors = colors.slice(0, 3);
  for (let y = 2; y < potTop - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const centerX = Math.floor(w / 2);
      const dist = Math.abs(x - centerX);
      const maxDist = Math.floor((potTop - y) * w / (2 * potTop)) + 2;
      if (dist <= maxDist && Math.random() > 0.25) {
        const c = leafColors[Math.floor(Math.random() * leafColors.length)];
        px(ctx, x, y, noise(c[0], 8), noise(c[1], 8), noise(c[2], 8));
      }
    }
  }
}

function drawRug(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const base = colors[0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(ctx, x, y, ...base);
  const border = colors[3] || colors[0];
  for (let x = 0; x < w; x++) { px(ctx, x, 0, ...border); px(ctx, x, h - 1, ...border); }
  for (let y = 0; y < h; y++) { px(ctx, 0, y, ...border); px(ctx, w - 1, y, ...border); }
  const a1 = colors[1], a2 = colors[2];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if ((x + y) % 4 === 0) px(ctx, x, y, ...a1);
      else if ((x + y) % 4 === 2) px(ctx, x, y, ...a2);
    }
  }
  const fringe = colors[4] || colors[1];
  for (let x = 1; x < w - 1; x += 2) { px(ctx, x, 0, ...fringe); px(ctx, x, h - 1, ...fringe); }
}

function drawBookcase(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const wood = colors[0], woodLight = colors[1];
  const woodDark: RGB = [Math.max(0, wood[0] - 20), Math.max(0, wood[1] - 20), Math.max(0, wood[2] - 20)];
  for (let y = 0; y < h; y++) { px(ctx, 0, y, ...woodDark); px(ctx, 1, y, ...wood); px(ctx, w - 2, y, ...wood); px(ctx, w - 1, y, ...woodDark); }
  for (let x = 0; x < w; x++) { px(ctx, x, 0, ...woodDark); px(ctx, x, h - 1, ...woodDark); }
  const shelfYs = [Math.floor(h / 4), Math.floor(h / 2), Math.floor(3 * h / 4)];
  for (const sy of shelfYs) {
    for (let x = 1; x < w - 1; x++) { px(ctx, x, sy, ...woodLight); px(ctx, x, sy + 1, ...woodDark); }
  }
  const bookColors = colors.length > 3 ? colors.slice(3) : [[80, 80, 120] as RGB, [150, 50, 50] as RGB];
  for (let s = 0; s < shelfYs.length; s++) {
    const startY = shelfYs[s] + 2;
    const sectionH = s === 0 ? shelfYs[0] : shelfYs[s] - shelfYs[s - 1] - 2;
    let x = 2;
    while (x < w - 3) {
      const bw = 2 + Math.floor(Math.random() * 3);
      const bh = Math.max(2, sectionH - Math.floor(Math.random() * 4));
      const bc = bookColors[Math.floor(Math.random() * bookColors.length)];
      for (let by = startY; by < startY + bh && by < h - 1; by++) {
        for (let bx = x; bx < x + bw && bx < w - 2; bx++) px(ctx, bx, by, ...bc);
      }
      x += bw + 1;
    }
  }
}

function drawLoveseat(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const main = colors[1], dark = colors[0], light = colors[2], accent = colors[3] || colors[2];
  const outline: RGB = [15, 15, 10];
  const backH = Math.floor(h / 2);
  for (let y = 2; y < backH; y++) for (let x = 2; x < w - 2; x++) px(ctx, x, y, ...(y > 3 ? main : dark));
  for (let y = 3; y < h - 6; y++) { px(ctx, 1, y, ...dark); px(ctx, w - 2, y, ...dark); }
  for (let y = backH; y < backH + 5 && y < h; y++) for (let x = 2; x < w - 2; x++) px(ctx, x, y, ...(y === backH ? light : main));
  for (let y = h - 3; y < h; y++) { px(ctx, 2, y, ...accent); px(ctx, w - 3, y, ...accent); }
  for (let y = 2; y < backH; y++) { px(ctx, 1, y, ...outline); px(ctx, w - 2, y, ...outline); }
  for (let x = 1; x < w - 1; x++) px(ctx, x, 2, ...outline);
}

function drawCoffeeTable(ctx: CanvasRenderingContext2D, w: number, h: number, colors: RGB[]) {
  const top = colors[0], topLight = colors[1], leg = colors[3] || colors[2];
  const topDark: RGB = [Math.max(0, top[0] - 20), Math.max(0, top[1] - 20), Math.max(0, top[2] - 20)];
  const topH = Math.floor(h / 2) + 2;
  for (let y = 4; y < topH; y++) for (let x = 2; x < w - 2; x++) px(ctx, x, y, ...(y === 4 ? topLight : top));
  for (let x = 2; x < w - 2; x++) px(ctx, x, topH, ...topDark);
  for (let y = topH + 1; y < h; y++) { px(ctx, 4, y, ...leg); px(ctx, 5, y, ...leg); px(ctx, w - 6, y, ...leg); px(ctx, w - 5, y, ...leg); }
}
