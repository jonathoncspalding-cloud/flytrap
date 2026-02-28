"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { AgentData, Character, FurnitureItem, SpriteFrame } from "./types";
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  WORLD_W,
  WORLD_H,
  TILE_MAP,
  DESK_ASSIGNMENTS,
  buildFurnitureList,
  buildWalkableMap,
} from "./office-layout";
import {
  buildPalette,
  resolveTemplate,
  WALK_TEMPLATES,
  TYPE_TEMPLATES,
  getCachedSprite,
  clearSpriteCache,
} from "./sprites";
import {
  createGameLoop,
  updateCharacter,
  buildRenderList,
  tileCenter,
} from "./engine";

// ── Constants ───────────────────────────────────────────────────────────────

const BASE_ZOOM = 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const CANVAS_W = WORLD_W * BASE_ZOOM; // 640
const CANVAS_H = WORLD_H * BASE_ZOOM; // 384

// Floor colors
const FLOOR_A = "#1a1d2e";
const FLOOR_B = "#1e2133";
const WALL_COLOR = "#13151f";
const WALL_ACCENT = "#2a2d3e";

// ── Component ───────────────────────────────────────────────────────────────

export default function PixelOffice({
  agents,
  selectedAgent,
  onSelectAgent,
}: {
  agents: AgentData[];
  selectedAgent: string | null;
  onSelectAgent: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    characters: Character[];
    furniture: FurnitureItem[];
    walkable: boolean[][];
    zoom: number;
  } | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const selectedRef = useRef(selectedAgent);
  const hoveredRef = useRef(hoveredAgent);

  // Keep refs in sync for render closure
  selectedRef.current = selectedAgent;
  hoveredRef.current = hoveredAgent;

  // ── Initialize state ────────────────────────────────────────────────────

  useEffect(() => {
    const furniture = buildFurnitureList();
    const walkable = buildWalkableMap(furniture);

    const characters: Character[] = agents.map((agent) => {
      const assignment = DESK_ASSIGNMENTS[agent.id];
      if (!assignment) {
        // Fallback for unknown agents
        return createCharacter(agent, { x: 5, y: 5 });
      }
      const char = createCharacter(agent, assignment.chairTile);
      if (agent.isActive) {
        char.state = "type";
        char.facing = "up";
      }
      return char;
    });

    stateRef.current = { characters, furniture, walkable, zoom: BASE_ZOOM };

    // Start game loop
    const loop = createGameLoop(
      (dt) => {
        const s = stateRef.current;
        if (!s) return;
        for (const c of s.characters) {
          updateCharacter(c, dt, s.walkable);
        }
      },
      () => render()
    );
    loop.start();

    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync agent props into state ─────────────────────────────────────────

  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    for (const agent of agents) {
      const char = s.characters.find((c) => c.id === agent.id);
      if (!char) continue;
      char.isActive = agent.isActive;
      if (agent.status && agent.status !== "idle" && agent.status !== char.status) {
        char.bubble = agent.status.length > 25 ? agent.status.slice(0, 24) + "…" : agent.status;
        char.bubbleTimer = 5;
        char.status = agent.status;
      }
    }
  }, [agents]);

  // ── Render ──────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const s = stateRef.current;
    if (!ctx || !s || !canvas) return;

    const z = s.zoom;
    canvas.width = WORLD_W * z;
    canvas.height = WORLD_H * z;
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Floor
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (TILE_MAP[y][x] === 0) {
          ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B;
          ctx.fillRect(x * TILE_SIZE * z, y * TILE_SIZE * z, TILE_SIZE * z, TILE_SIZE * z);
        } else {
          ctx.fillStyle = WALL_COLOR;
          ctx.fillRect(x * TILE_SIZE * z, y * TILE_SIZE * z, TILE_SIZE * z, TILE_SIZE * z);
          // Baseboard accent on bottom edge of top wall
          if (y === 0) {
            ctx.fillStyle = WALL_ACCENT;
            ctx.fillRect(
              x * TILE_SIZE * z,
              (y + 1) * TILE_SIZE * z - 2 * z,
              TILE_SIZE * z,
              2 * z
            );
          }
        }
      }
    }

    // 2. Z-sorted scene
    const renderList = buildRenderList(
      s.characters,
      s.furniture,
      drawCharacter,
      drawFurniture
    );
    for (const item of renderList) {
      item.draw(ctx, z);
    }

    // 3. Speech bubbles (always on top)
    for (const c of s.characters) {
      if (c.bubble) drawBubble(ctx, c, z);
    }

    // 4. Selection / hover highlight
    const sel = selectedRef.current;
    const hov = hoveredRef.current;
    if (sel) {
      const c = s.characters.find((ch) => ch.id === sel);
      if (c) drawHighlight(ctx, c, z, 0.5);
    }
    if (hov && hov !== sel) {
      const c = s.characters.find((ch) => ch.id === hov);
      if (c) drawHighlight(ctx, c, z, 0.25);
    }

    // 5. Agent name labels
    ctx.textAlign = "center";
    for (const c of s.characters) {
      ctx.font = `bold ${Math.max(7, 4 * z)}px monospace`;
      ctx.fillStyle =
        c.id === sel
          ? c.palette.shirt
          : "rgba(255,255,255,0.5)";
      ctx.fillText(
        c.label,
        c.pos.x * z,
        (c.pos.y + TILE_SIZE + 6) * z
      );
    }

    // 6. Scanline overlay
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let y = 0; y < canvas.height; y += 3 * z) {
      ctx.fillRect(0, y, canvas.width, z);
    }

    // 7. Corner text
    ctx.font = `bold ${Math.max(6, 3.5 * z)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillText("FLYTRAP COMMAND CENTER", 4 * z, 8 * z);
  }, []);

  // ── Draw Helpers ────────────────────────────────────────────────────────

  function drawFurniture(
    ctx: CanvasRenderingContext2D,
    item: FurnitureItem,
    z: number
  ) {
    const cached = getCachedSprite(
      `furn_${item.type}_${item.tileX}_${item.tileY}`,
      item.sprite,
      z
    );
    const spriteH = item.sprite.length;
    const offsetY = (spriteH - item.heightTiles * TILE_SIZE) * z;
    ctx.drawImage(
      cached,
      item.tileX * TILE_SIZE * z,
      item.tileY * TILE_SIZE * z - offsetY,
      cached.width,
      cached.height
    );
  }

  function drawCharacter(
    ctx: CanvasRenderingContext2D,
    char: Character,
    z: number
  ) {
    let tmpl;
    if (char.state === "type") {
      tmpl = TYPE_TEMPLATES[char.animFrame % TYPE_TEMPLATES.length];
    } else if (char.state === "walk") {
      const dirFrames = WALK_TEMPLATES[char.facing] || WALK_TEMPLATES.down;
      tmpl = dirFrames[char.animFrame % dirFrames.length];
    } else {
      // idle: use walk frame 0 for current facing
      const dirFrames = WALK_TEMPLATES[char.facing] || WALK_TEMPLATES.down;
      tmpl = dirFrames[0];
    }

    const resolved = resolveTemplate(tmpl, char.palette);
    const cacheKey = `char_${char.id}_${char.state}_${char.facing}_${char.animFrame}`;
    const cached = getCachedSprite(cacheKey, resolved, z);

    // Center sprite on character position
    const spriteW = tmpl[0].length;
    const spriteH = tmpl.length;
    const drawX = (char.pos.x - spriteW / 2) * z;
    const drawY = (char.pos.y - spriteH + TILE_SIZE / 2) * z;

    ctx.drawImage(cached, drawX, drawY, cached.width, cached.height);

    // Active indicator dot
    if (char.isActive && char.state === "type") {
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(
        (char.pos.x + spriteW / 2 - 2) * z,
        (char.pos.y - spriteH + TILE_SIZE / 2 + 2) * z,
        2 * z,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  function drawBubble(
    ctx: CanvasRenderingContext2D,
    char: Character,
    z: number
  ) {
    if (!char.bubble) return;
    const text = char.bubble;
    const fontSize = Math.max(5, 3 * z);
    ctx.font = `${fontSize}px monospace`;
    const metrics = ctx.measureText(text);
    const bw = metrics.width + 6 * z;
    const bh = fontSize + 4 * z;
    const bx = char.pos.x * z - bw / 2;
    const by = (char.pos.y - 20) * z;

    // Alpha fade near end
    const alpha = Math.min(1, char.bubbleTimer / 1);

    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, bx, by, bw, bh, 3 * z);
    ctx.fill();

    // Pointer
    ctx.beginPath();
    ctx.moveTo(char.pos.x * z - 3 * z, by + bh);
    ctx.lineTo(char.pos.x * z, by + bh + 3 * z);
    ctx.lineTo(char.pos.x * z + 3 * z, by + bh);
    ctx.fill();

    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    ctx.fillText(text, char.pos.x * z, by + bh - 2 * z);
    ctx.globalAlpha = 1;
  }

  function drawHighlight(
    ctx: CanvasRenderingContext2D,
    char: Character,
    z: number,
    baseAlpha: number
  ) {
    const t = performance.now() / 1000;
    const pulse = baseAlpha + Math.sin(t * 3) * 0.15;
    ctx.strokeStyle = char.palette.shirt;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = z;
    const hw = 8 * z;
    const hh = 10 * z;
    ctx.strokeRect(
      char.pos.x * z - hw,
      (char.pos.y - 4) * z - hh,
      hw * 2,
      hh * 2
    );
    ctx.globalAlpha = 1;
  }

  // ── Click / Hover ─────────────────────────────────────────────────────

  const worldFromEvent = useCallback(
    (e: React.MouseEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      const s = stateRef.current;
      if (!canvas || !s) return null;
      const rect = canvas.getBoundingClientRect();
      const z = s.zoom;
      const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
      return { x: cx / z, y: cy / z };
    },
    []
  );

  const hitTest = useCallback(
    (wx: number, wy: number): string | null => {
      const s = stateRef.current;
      if (!s) return null;
      for (let i = s.characters.length - 1; i >= 0; i--) {
        const c = s.characters[i];
        const dx = Math.abs(wx - c.pos.x);
        const dy = Math.abs(wy - (c.pos.y - 4));
        if (dx < 8 && dy < 10) return c.id;
      }
      return null;
    },
    []
  );

  function handleClick(e: React.MouseEvent) {
    const w = worldFromEvent(e);
    if (!w) return;
    const id = hitTest(w.x, w.y);
    if (id) onSelectAgent(id);
  }

  function handleMove(e: React.MouseEvent) {
    const w = worldFromEvent(e);
    if (!w) return;
    const id = hitTest(w.x, w.y);
    setHoveredAgent(id);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = id ? "pointer" : "default";
  }

  function handleWheel(e: React.WheelEvent) {
    e.stopPropagation();
    const s = stateRef.current;
    if (!s) return;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom - e.deltaY * 0.005));
    s.zoom = next;
    clearSpriteCache();
  }

  // ── JSX ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: "#0c0f1a",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={handleClick}
        onMouseMove={handleMove}
        onWheel={handleWheel}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          imageRendering: "pixelated",
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          borderRadius: 10,
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────

function createCharacter(agent: AgentData, tile: { x: number; y: number }): Character {
  const center = tileCenter(tile);
  return {
    id: agent.id,
    label: agent.label,
    palette: buildPalette(agent.color),
    state: "idle",
    facing: "down",
    pos: { x: center.x, y: center.y },
    path: [],
    deskTile: { x: tile.x, y: tile.y },
    animFrame: 0,
    animTimer: 0,
    idleTimer: 1 + Math.random() * 3,
    bubble: null,
    bubbleTimer: 0,
    isActive: agent.isActive,
    status: agent.status,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
