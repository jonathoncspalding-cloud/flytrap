"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type {
  AgentData,
  Character,
  FurnitureItem,
  SpriteSheets,
  FloorType,
} from "./types";
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  WORLD_W,
  WORLD_H,
  TILE_MAP,
  FLOOR_ZONES,
  DESK_ASSIGNMENTS,
  buildFurnitureList,
  buildWalkableMap,
} from "./office-layout";
import {
  loadAllSheets,
  getCharacterFrame,
  drawTilesetTile,
  AGENT_APPEARANCES,
  clearSpriteCache,
} from "./sprites";
import {
  createGameLoop,
  updateCharacter,
  stopCharacter,
  buildRenderList,
  tileCenter,
} from "./engine";
import {
  loadTileAssets,
  hasTileAssets,
  drawFloors,
  drawWallBases,
  buildWallRenderables,
  clearTileCache,
} from "./tile-renderer";
import { WALL_HSB } from "./office-layout";

// ── Agent Greetings ─────────────────────────────────────────────────────────

const AGENT_GREETINGS: Record<string, { emoji: string; role: string; greeting: string }> = {
  sentinel: {
    emoji: "👁️",
    role: "Oversight & QA",
    greeting: "Eyes up. I'm watching everything so you don't have to.",
  },
  scout: {
    emoji: "🔭",
    role: "Source Intelligence",
    greeting: "Psst! You won't BELIEVE what I just found on Reddit...",
  },
  oracle: {
    emoji: "🧠",
    role: "Prediction Engine",
    greeting: "Ah... I sensed you'd click on me. The patterns suggested it.",
  },
  architect: {
    emoji: "🎨",
    role: "UX & Design",
    greeting: "OMG hi!! Wait till you see what I've been sketching!",
  },
  optimize: {
    emoji: "⚡",
    role: "Efficiency & Ops",
    greeting: "Fun fact: you took 3.2 seconds to click me. I timed it.",
  },
  strategist: {
    emoji: "📝",
    role: "Cultural Intelligence",
    greeting: "Good timing. I was just synthesizing today's cultural signals.",
  },
  isabel: {
    emoji: "🎨",
    role: "Interior Designer",
    greeting: "Darling! This office needs MORE COLOR. Help me redecorate?",
  },
};

// ── Constants ───────────────────────────────────────────────────────────────

const BASE_ZOOM = 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

// Floor colors per zone type — Cornett brand palette
// Sunset #FF8200, Moss #004F22, Rose #E8127A, Birch #F2EFED, Black #000000
const FLOOR_COLORS: Record<FloorType, { a: string; b: string }> = {
  wood: { a: "#8a6210", b: "#7a570e" },
  tile: { a: "#c4a882", b: "#b89b78" },
  carpet: { a: "#2d4a3a", b: "#253f32" },
  library: { a: "#1a3828", b: "#152e21" },
};

const WALL_COLOR = "#1e2738";
const WALL_COLOR_B = "#242e42";
const WALL_ACCENT = "#354560";

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
  const sheetsRef = useRef<SpriteSheets | null>(null);
  const stateRef = useRef<{
    characters: Character[];
    furniture: FurnitureItem[];
    walkable: boolean[][];
    zoom: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [greetingAgent, setGreetingAgent] = useState<string | null>(null);
  const [greetingPos, setGreetingPos] = useState<{ x: number; y: number } | null>(null);
  const selectedRef = useRef(selectedAgent);
  const hoveredRef = useRef(hoveredAgent);

  selectedRef.current = selectedAgent;
  hoveredRef.current = hoveredAgent;

  // Trigger greeting when selectedAgent changes (from any source: canvas click or terminal list)
  useEffect(() => {
    if (!selectedAgent) {
      setGreetingAgent(null);
      setGreetingPos(null);
      return;
    }
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!s || !canvas) return;

    const char = s.characters.find((c) => c.id === selectedAgent);
    if (!char) return;

    stopCharacter(char);
    setGreetingAgent(selectedAgent);

    const rect = canvas.getBoundingClientRect();
    const z = s.zoom;
    const scaleX = rect.width / (WORLD_W * z);
    const scaleY = rect.height / (WORLD_H * z);
    setGreetingPos({
      x: char.pos.x * z * scaleX,
      y: (char.pos.y - 32) * z * scaleY,
    });

    // Auto-dismiss after 6 seconds
    const timer = setTimeout(() => {
      setGreetingAgent(null);
      setGreetingPos(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [selectedAgent]);

  // ── Load sprite sheets + initialize ───────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [sheets] = await Promise.all([
        loadAllSheets(),
        loadTileAssets().catch((e) => console.warn("Tile assets not loaded:", e)),
      ]);
      if (cancelled) return;
      sheetsRef.current = sheets;

      const furniture = buildFurnitureList();
      const walkable = buildWalkableMap(furniture);

      const characters: Character[] = agents.map((agent) => {
        const assignment = DESK_ASSIGNMENTS[agent.id];
        const appearance =
          AGENT_APPEARANCES[agent.id] || AGENT_APPEARANCES.sentinel;
        const tile = assignment?.chairTile || { x: 5, y: 5 };
        const char = createCharacter(agent, tile, appearance);
        if (agent.isActive && assignment) {
          char.state = "type";
          char.facing = "up";
        }
        return char;
      });

      stateRef.current = { characters, furniture, walkable, zoom: BASE_ZOOM };
      setLoading(false);

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
    }

    const cleanup = init();
    return () => {
      cancelled = true;
      cleanup.then((stop) => stop?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync agent props ──────────────────────────────────────────────────

  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    for (const agent of agents) {
      const char = s.characters.find((c) => c.id === agent.id);
      if (!char) continue;
      char.isActive = agent.isActive;
      if (
        agent.status &&
        agent.status !== "idle" &&
        agent.status !== char.status
      ) {
        char.bubble =
          agent.status.length > 25
            ? agent.status.slice(0, 24) + "…"
            : agent.status;
        char.bubbleTimer = 5;
        char.status = agent.status;
      }
    }
  }, [agents]);

  // ── Render ────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const s = stateRef.current;
    const sheets = sheetsRef.current;
    if (!ctx || !s || !canvas || !sheets) return;

    const z = s.zoom;
    canvas.width = WORLD_W * z;
    canvas.height = WORLD_H * z;
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Floor + Walls
    drawFloorAndWalls(ctx, z);

    // 2. Z-sorted scene (walls + furniture + characters)
    const wallRenderables = hasTileAssets() ? buildWallRenderables(z, WALL_HSB) : [];
    const renderList = buildRenderList(
      s.characters,
      s.furniture,
      (c, char, zoom) => drawCharacter(c, char, zoom, sheets),
      (c, item, zoom) => drawFurniture(c, item, zoom, sheets)
    );
    // Merge wall renderables into the z-sorted list
    const allRenderables = [...wallRenderables, ...renderList].sort(
      (a, b) => a.bottomY - b.bottomY
    );
    for (const item of allRenderables) {
      item.draw(ctx, z);
    }

    // 3. Speech bubbles
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
        c.id === sel ? c.color : "rgba(255,255,255,0.5)";
      ctx.fillText(
        c.label,
        c.pos.x * z,
        (c.pos.y + TILE_SIZE + 8) * z
      );
    }

    // 6. Scanline overlay
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    for (let y = 0; y < canvas.height; y += 3 * z) {
      ctx.fillRect(0, y, canvas.width, z);
    }

    // 7. Corner text
    ctx.font = `bold ${Math.max(6, 3.5 * z)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillText("FLYTRAP COMMAND CENTER", 4 * z, 8 * z);
  }, []);

  // ── Draw Helpers ──────────────────────────────────────────────────────

  function drawFloorAndWalls(ctx: CanvasRenderingContext2D, z: number) {
    if (hasTileAssets()) {
      // New renderer: sprite-based walls + colorized floor patterns
      drawWallBases(ctx, z, WALL_HSB);
      drawFloors(ctx, z);
    } else {
      // Fallback: flat colored rectangles (old renderer)
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          if (TILE_MAP[y][x] === 0) {
            ctx.fillStyle = (x + y) % 2 === 0 ? WALL_COLOR : WALL_COLOR_B;
            ctx.fillRect(x * TILE_SIZE * z, y * TILE_SIZE * z, TILE_SIZE * z, TILE_SIZE * z);
          } else {
            let floorType: FloorType = "wood";
            for (const zone of FLOOR_ZONES) {
              if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
                floorType = zone.type;
                break;
              }
            }
            const colors = FLOOR_COLORS[floorType];
            ctx.fillStyle = (x + y) % 2 === 0 ? colors.a : colors.b;
            ctx.fillRect(x * TILE_SIZE * z, y * TILE_SIZE * z, TILE_SIZE * z, TILE_SIZE * z);
          }
        }
      }
    }
  }

  function drawFurniture(
    ctx: CanvasRenderingContext2D,
    item: FurnitureItem,
    z: number,
    sheets: SpriteSheets
  ) {
    for (const tile of item.tiles) {
      drawTilesetTile(
        ctx,
        sheets.tileset,
        tile.col,
        tile.row,
        (item.tileX + tile.dx) * TILE_SIZE * z,
        (item.tileY + tile.dy) * TILE_SIZE * z,
        z
      );
    }
  }

  function drawCharacter(
    ctx: CanvasRenderingContext2D,
    char: Character,
    z: number,
    sheets: SpriteSheets
  ) {
    const dir = char.facing;
    // For typing, use "up" direction frame 1 (standing)
    const frame =
      char.state === "type"
        ? 1
        : char.state === "walk"
          ? char.animFrame % 3
          : 1; // idle = standing frame

    const charCanvas = getCharacterFrame(
      sheets,
      char.appearance,
      char.state === "type" ? "up" : dir,
      frame
    );

    // Draw shadow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(
      char.pos.x * z,
      (char.pos.y + 4) * z,
      8 * z,
      3 * z,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.globalAlpha = 1;

    // Character sprite is 32×32, centered on pos.x, bottom aligned to pos.y + TILE_SIZE/2
    const drawW = 32 * z;
    const drawH = 32 * z;
    const drawX = (char.pos.x - 16) * z;
    const drawY = (char.pos.y - 24) * z;

    ctx.drawImage(charCanvas, drawX, drawY, drawW, drawH);

    // Active indicator dot
    if (char.isActive && char.state === "type") {
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(
        (char.pos.x + 12) * z,
        (char.pos.y - 22) * z,
        2.5 * z,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  function drawBubble(ctx: CanvasRenderingContext2D, char: Character, z: number) {
    if (!char.bubble) return;
    const text = char.bubble;
    const fontSize = Math.max(5, 3 * z);
    ctx.font = `${fontSize}px monospace`;
    const metrics = ctx.measureText(text);
    const bw = metrics.width + 6 * z;
    const bh = fontSize + 4 * z;
    const bx = char.pos.x * z - bw / 2;
    const by = (char.pos.y - 28) * z;

    const alpha = Math.min(1, char.bubbleTimer / 1);

    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, bx, by, bw, bh, 3 * z);
    ctx.fill();

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
    ctx.strokeStyle = char.color;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = z;
    const hw = 10 * z;
    const hh = 14 * z;
    ctx.strokeRect(
      char.pos.x * z - hw,
      (char.pos.y - 8) * z - hh,
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
        const dy = Math.abs(wy - (c.pos.y - 8));
        if (dx < 12 && dy < 16) return c.id;
      }
      return null;
    },
    []
  );

  function handleClick(e: React.MouseEvent) {
    const w = worldFromEvent(e);
    if (!w) return;
    const id = hitTest(w.x, w.y);
    if (id) {
      onSelectAgent(id);
    } else {
      setGreetingAgent(null);
      setGreetingPos(null);
    }
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
    const next = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, s.zoom - e.deltaY * 0.005)
    );
    s.zoom = next;
    clearSpriteCache();
    clearTileCache();
  }

  // ── JSX ───────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "relative", width: "100%", background: "#0c0f1a" }}>
      <style>{`
        @keyframes greetFadeIn {
          from { opacity: 0; transform: translate(-50%, -90%); }
          to { opacity: 1; transform: translate(-50%, -100%); }
        }
      `}</style>
      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 200,
            color: "var(--text-tertiary)",
            fontSize: 12,
            fontFamily: "monospace",
          }}
        >
          Loading office...
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={WORLD_W * BASE_ZOOM}
        height={WORLD_H * BASE_ZOOM}
        onClick={handleClick}
        onMouseMove={handleMove}
        style={{
          width: "100%",
          height: "auto",
          display: loading ? "none" : "block",
          imageRendering: "pixelated",
        }}
      />
      {/* Greeting Popup */}
      {greetingAgent && greetingPos && AGENT_GREETINGS[greetingAgent] && (
        <div
          style={{
            position: "absolute",
            left: greetingPos.x,
            top: greetingPos.y,
            transform: "translate(-50%, -100%)",
            background: "rgba(13, 17, 23, 0.95)",
            border: `1px solid ${agents.find((a) => a.id === greetingAgent)?.color || "#666"}40`,
            borderLeft: `3px solid ${agents.find((a) => a.id === greetingAgent)?.color || "#666"}`,
            borderRadius: 8,
            padding: "10px 14px",
            maxWidth: 220,
            pointerEvents: "none",
            zIndex: 10,
            animation: "greetFadeIn 0.3s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>{AGENT_GREETINGS[greetingAgent].emoji}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: agents.find((a) => a.id === greetingAgent)?.color || "#fff",
            }}>
              {agents.find((a) => a.id === greetingAgent)?.label}
            </span>
            <span style={{ fontSize: 9, color: "#8b949e" }}>
              {AGENT_GREETINGS[greetingAgent].role}
            </span>
          </div>
          <div style={{
            fontSize: 11,
            color: "#e6edf3",
            lineHeight: 1.5,
            fontStyle: "italic",
          }}>
            &ldquo;{AGENT_GREETINGS[greetingAgent].greeting}&rdquo;
          </div>
        </div>
      )}
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────

import type { CharacterAppearance } from "./types";

function createCharacter(
  agent: AgentData,
  tile: { x: number; y: number },
  appearance: CharacterAppearance
): Character {
  const center = tileCenter(tile);
  return {
    id: agent.id,
    label: agent.label,
    color: agent.color,
    appearance,
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
    greetTimer: 0,
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
