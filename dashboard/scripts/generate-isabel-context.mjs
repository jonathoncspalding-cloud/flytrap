/**
 * Build-time script: bundles Isabel's pixel-office domain files into a
 * TypeScript module so the agent-chat API can inject them as context.
 *
 * Also converts replaceable furniture PNGs to palette+rows format so
 * Isabel can "see" what existing furniture looks like.
 *
 * Run: node dashboard/scripts/generate-isabel-context.mjs
 * Runs automatically via "prebuild" in package.json.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD = resolve(__dirname, "..");

// Find repo root by walking up from the script directory until we find .claude/agents/
function findRepoRoot() {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    dir = resolve(dir, "..");
    if (existsSync(resolve(dir, ".claude/agents/isabel.md"))) return dir;
  }
  return resolve(__dirname, "../.."); // fallback
}
const ROOT = findRepoRoot();
const SPRITES_DIR = resolve(DASHBOARD, "public/sprites/furniture");

const FILES_TO_BUNDLE = [
  {
    label: "AGENT CONFIG (.claude/agents/isabel.md)",
    // Try repo root first, then fall back to a copy in dashboard/
    path: existsSync(resolve(ROOT, ".claude/agents/isabel.md"))
      ? resolve(ROOT, ".claude/agents/isabel.md")
      : resolve(DASHBOARD, "agents/isabel.md"),
  },
  {
    label: "FURNITURE CATALOG (sprites.ts)",
    path: resolve(DASHBOARD, "components/pixel-office/sprites.ts"),
  },
  {
    label: "OFFICE LAYOUT (office-layout.json)",
    path: resolve(DASHBOARD, "components/pixel-office/office-layout.json"),
  },
  {
    label: "LAYOUT LOADER (office-layout.ts)",
    path: resolve(DASHBOARD, "components/pixel-office/office-layout.ts"),
  },
  {
    label: "TYPE DEFINITIONS (types.ts)",
    path: resolve(DASHBOARD, "components/pixel-office/types.ts"),
  },
];

/**
 * Replaceable furniture — the assets Isabel can swap.
 * Maps asset ID to { file, label, category }.
 */
const REPLACEABLE_ASSETS = {
  ASSET_101:     { file: "PAINTING_LANDSCAPE.png",   label: "Painting 1",        category: "Paintings" },
  ASSET_102:     { file: "PAINTING_LANDSCAPE_2.png",  label: "Painting 2",        category: "Paintings" },
  ASSET_132:     { file: "PLANT_1.png",               label: "Plant 1",           category: "Plants" },
  ASSET_140:     { file: "WHITE_PLANT_2.png",         label: "White Plant 2",     category: "Plants" },
  ASSET_141:     { file: "WHITE_PLANT_3.png",         label: "White Plant 3",     category: "Plants" },
  ASSET_142:     { file: "PLANT_2.png",               label: "Plant 2",           category: "Plants" },
  ASSET_143:     { file: "PLANT_3.png",               label: "Plant 3",           category: "Plants" },
  ASSET_148:     { file: "MAT_CHESS_BOARD.png",       label: "Rug",               category: "Rug" },
  ASSET_17:      { file: "WOODEN_BOOKSHELF_SMALL.png",      label: "Bookshelf (wood)",  category: "Bookcases" },
  ASSET_18:      { file: "FULL_WOODEN_BOOKSHELF_SMALL.png", label: "Bookshelf (full)",  category: "Bookcases" },
  ASSET_NEW_110: { file: "CHAIR_CUSHIONED_LG_RIGHT.png",    label: "Loveseat (right)",  category: "Loveseats" },
  ASSET_NEW_111: { file: "CHAIR_CUSHIONED_LG_LEFT.png",     label: "Loveseat (left)",   category: "Loveseats" },
  ASSET_NEW_112: { file: "COFFEE_TABLE_LG.png",      label: "Coffee Table",      category: "Coffee Table" },
  ASSET_NEW_106: { file: "TABLE_WOOD.png",            label: "Desk",              category: "Desks" },
  ASSET_49:      { file: "STOOL.png",                 label: "Desk Stool",        category: "Desk Stools" },
  ASSET_27_A:    { file: "TABLE_WOOD_LG.png",         label: "Meeting Table",     category: "Meeting Table" },
  ASSET_33:      { file: "CHAIR_CUSHIONED_RIGHT.png", label: "Meeting Chair (R)", category: "Meeting Chairs" },
  ASSET_34:      { file: "CHAIR_CUSHIONED_LEFT.png",  label: "Meeting Chair (L)", category: "Meeting Chairs" },
};

/**
 * Read a PNG and convert to palette+rows text format.
 * Returns { palette: [[r,g,b],...], rows: ["..01..", ...], width, height }
 */
async function pngToRows(pngPath) {
  const { data, info } = await sharp(pngPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const HEX = "0123456789abcdef";
  const palette = [];
  const colorIndex = new Map(); // "r,g,b" → index

  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      if (a < 128) {
        row += ".";
        continue;
      }

      const key = `${r},${g},${b}`;
      let idx = colorIndex.get(key);
      if (idx === undefined) {
        idx = palette.length;
        if (idx >= 16) {
          // More than 16 colors — find closest existing
          let bestDist = Infinity;
          let bestIdx = 0;
          for (let i = 0; i < palette.length; i++) {
            const [pr, pg, pb] = palette[i];
            const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
            if (dist < bestDist) { bestDist = dist; bestIdx = i; }
          }
          idx = bestIdx;
        } else {
          palette.push([r, g, b]);
          colorIndex.set(key, idx);
        }
      }
      row += HEX[idx];
    }
    rows.push(row);
  }

  return { palette, rows, width, height };
}

function escapeForTemplate(str) {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

// ── Main ──────────────────────────────────────────────────────────────────

let context = `\n\nISABEL FILE CONTEXT (read-only reference — current as of last deploy):\n`;

// Bundle source files
for (const { label, path } of FILES_TO_BUNDLE) {
  try {
    const content = readFileSync(path, "utf-8");
    context += `\n=== ${label} ===\n${content}\n`;
  } catch (err) {
    console.warn(`Warning: Could not read ${path}: ${err.message}`);
    context += `\n=== ${label} ===\n(file not found)\n`;
  }
}

// Convert replaceable furniture PNGs to visual format
context += `\n=== CURRENT FURNITURE PIXEL ART (replaceable items) ===\n`;
context += `Format: palette (indexed 0-f) + rows (. = transparent, hex digit = palette index)\n`;
context += `Use these as reference when designing new furniture — match the style and level of detail.\n\n`;

let convertedCount = 0;
for (const [assetId, { file, label, category }] of Object.entries(REPLACEABLE_ASSETS)) {
  const pngPath = resolve(SPRITES_DIR, file);
  try {
    const { palette, rows, width, height } = await pngToRows(pngPath);
    context += `--- ${label} (${assetId}, ${category}, ${width}×${height}px) ---\n`;
    context += `palette: ${JSON.stringify(palette)}\n`;
    context += rows.join("\n") + "\n\n";
    convertedCount++;
  } catch (err) {
    console.warn(`Warning: Could not convert ${file}: ${err.message}`);
  }
}

console.log(`Converted ${convertedCount} furniture PNGs to palette+rows format`);

const output = `/**
 * AUTO-GENERATED by scripts/generate-isabel-context.mjs
 * Do not edit manually. Regenerated on every build.
 */

export const ISABEL_FILE_CONTEXT = \`${escapeForTemplate(context)}\`;
`;

const outPath = resolve(DASHBOARD, "lib/isabel-file-context.ts");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, output, "utf-8");

const chars = context.length;
const estimatedTokens = Math.round(chars / 4);
console.log(
  `Generated isabel-file-context.ts (${chars} chars, ~${estimatedTokens} tokens)`
);
