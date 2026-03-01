"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type {
  AgentData,
  Character,
  FurnitureItem,
  SpriteSheets,
  FloorColor,
  CharacterAppearance,
} from "./types";
import {
  TILE_SIZE,
  GRID_ROWS,
  WORLD_W,
  WORLD_H,
  TILE_MAP,
  DESK_ASSIGNMENTS,
  buildFurnitureList,
  buildWalkableMap,
  isFloor,
  WALL_HSB,
} from "./office-layout";
import {
  loadAllSheets,
  getCharacterFrame,
  clearSpriteCache,
  loadFurnitureAssets,
  getFurnitureSprite,
  AGENT_APPEARANCES,
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

// ── Agent Greetings ─────────────────────────────────────────────────────────

const AGENT_GREETINGS: Record<string, { emoji: string; role: string; greeting: string }> = {
  sentinel: { emoji: "👁️", role: "Oversight & QA", greeting: "Eyes up. I'm watching everything so you don't have to." },
  scout: { emoji: "🔭", role: "Source Intelligence", greeting: "Psst! You won't BELIEVE what I just found on Reddit..." },
  oracle: { emoji: "🧠", role: "Prediction Engine", greeting: "Ah... I sensed you'd click on me. The patterns suggested it." },
  architect: { emoji: "🎨", role: "UX & Design", greeting: "OMG hi!! Wait till you see what I've been sketching!" },
  optimize: { emoji: "⚡", role: "Efficiency & Ops", greeting: "Fun fact: you took 3.2 seconds to click me. I timed it." },
  strategist: { emoji: "📝", role: "Cultural Intelligence", greeting: "Good timing. I was just synthesizing today's cultural signals." },
  isabel: { emoji: "🎨", role: "Interior Designer", greeting: "Darling! This office needs MORE COLOR. Help me redecorate?" },
};

// ── Constants ───────────────────────────────────────────────────────────────

const BASE_ZOOM = 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const WALL_COLOR = "#1e2738";
const WALL_COLOR_B = "#242e42";
const FLOOR_DEFAULT = { a: "#8a6210", b: "#7a570e" };

// ── Furniture colorization ──────────────────────────────────────────────────

const furnColorCache = new Map<string, HTMLCanvasElement>();

function colorizeFurniture(
  img: HTMLImageElement,
  color: FloorColor,
  zoom: number,
  cacheKey: string
): HTMLCanvasElement | null {
  const existing = furnColorCache.get(cacheKey);
  if (existing) return existing;

  const w = img.width;
  const h = img.height;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tc = tmp.getContext("2d")!;
  tc.drawImage(img, 0, 0);
  const id = tc.getImageData(0, 0, w, h);

  const out = document.createElement("canvas");
  out.width = w * zoom;
  out.height = h * zoom;
  const oc = out.getContext("2d")!;
  oc.imageSmoothingEnabled = false;

  const { h: ch, s: cs, b: cb, c: cc } = color;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const av = id.data[i + 3];
      if (av < 10) continue;
      let l = (0.299 * id.data[i] + 0.587 * id.data[i + 1] + 0.114 * id.data[i + 2]) / 255;
      if (cc !== 0) l = 0.5 + (l - 0.5) * ((100 + cc) / 100);
      if (cb !== 0) l += cb / 200;
      l = Math.max(0, Math.min(1, l));
      const sf = cs / 100;
      const cn = (1 - Math.abs(2 * l - 1)) * sf;
      const hp = ch / 60;
      const x = cn * (1 - Math.abs((hp % 2) - 1));
      let r1 = 0, g1 = 0, b1 = 0;
      if (hp < 1) { r1 = cn; g1 = x; } else if (hp < 2) { r1 = x; g1 = cn; }
      else if (hp < 3) { g1 = cn; b1 = x; } else if (hp < 4) { g1 = x; b1 = cn; }
      else if (hp < 5) { r1 = x; b1 = cn; } else { r1 = cn; b1 = x; }
      const m = l - cn / 2;
      const clamp = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
      oc.fillStyle = `rgba(${clamp(r1)},${clamp(g1)},${clamp(b1)},${av / 255})`;
      oc.fillRect(px * zoom, py * zoom, zoom, zoom);
    }
  }
  furnColorCache.set(cacheKey, out);
  return out;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PixelOffice({
  agents, selectedAgent, onSelectAgent,
}: {
  agents: AgentData[];
  selectedAgent: string | null;
  onSelectAgent: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheetsRef = useRef<SpriteSheets | null>(null);
  const stateRef = useRef<{ characters: Character[]; furniture: FurnitureItem[]; walkable: boolean[][]; zoom: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [greetingAgent, setGreetingAgent] = useState<string | null>(null);
  const [greetingPos, setGreetingPos] = useState<{ x: number; y: number } | null>(null);
  const selectedRef = useRef(selectedAgent);
  const hoveredRef = useRef(hoveredAgent);
  selectedRef.current = selectedAgent;
  hoveredRef.current = hoveredAgent;

  useEffect(() => {
    if (!selectedAgent) { setGreetingAgent(null); setGreetingPos(null); return; }
    const s = stateRef.current; const canvas = canvasRef.current;
    if (!s || !canvas) return;
    const char = s.characters.find((c) => c.id === selectedAgent);
    if (!char) return;
    stopCharacter(char);
    setGreetingAgent(selectedAgent);
    const rect = canvas.getBoundingClientRect();
    const z = s.zoom;
    setGreetingPos({ x: char.pos.x * z * (rect.width / (WORLD_W * z)), y: (char.pos.y - 32) * z * (rect.height / (WORLD_H * z)) });
    const timer = setTimeout(() => { setGreetingAgent(null); setGreetingPos(null); }, 6000);
    return () => clearTimeout(timer);
  }, [selectedAgent]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [sheets] = await Promise.all([
        loadAllSheets(),
        loadTileAssets().catch((e) => console.warn("Tile assets not loaded:", e)),
        loadFurnitureAssets().catch((e) => console.warn("Furniture assets not loaded:", e)),
      ]);
      if (cancelled) return;
      sheetsRef.current = sheets;
      const furniture = buildFurnitureList();
      const walkable = buildWalkableMap(furniture);
      const characters: Character[] = agents.map((agent) => {
        const assignment = DESK_ASSIGNMENTS[agent.id];
        const appearance = AGENT_APPEARANCES[agent.id] || AGENT_APPEARANCES.sentinel;
        const tile = assignment?.chairTile || { x: 5, y: 5 };
        const char = createCharacter(agent, tile, appearance);
        if (agent.isActive && assignment) { char.state = "type"; char.facing = "up"; }
        return char;
      });
      stateRef.current = { characters, furniture, walkable, zoom: BASE_ZOOM };
      setLoading(false);
      const loop = createGameLoop(
        (dt) => { const s = stateRef.current; if (!s) return; for (const c of s.characters) updateCharacter(c, dt, s.walkable); },
        () => render()
      );
      loop.start();
      return () => loop.stop();
    }
    const cleanup = init();
    return () => { cancelled = true; cleanup.then((stop) => stop?.()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = stateRef.current; if (!s) return;
    for (const agent of agents) {
      const char = s.characters.find((c) => c.id === agent.id);
      if (!char) continue;
      char.isActive = agent.isActive;
      if (agent.status && agent.status !== "idle" && agent.status !== char.status) {
        char.bubble = agent.status.length > 25 ? agent.status.slice(0, 24) + "…" : agent.status;
        char.bubbleTimer = 5; char.status = agent.status;
      }
    }
  }, [agents]);

  const render = useCallback(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d");
    const s = stateRef.current; const sheets = sheetsRef.current;
    if (!ctx || !s || !canvas || !sheets) return;
    const z = s.zoom;
    canvas.width = WORLD_W * z; canvas.height = WORLD_H * z;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Floor + Walls
    if (hasTileAssets()) { drawWallBases(ctx, z, WALL_HSB); drawFloors(ctx, z); }
    else {
      for (let y = 0; y < GRID_ROWS; y++) for (let x = 0; x < TILE_MAP[y].length; x++) {
        const tv = TILE_MAP[y][x];
        if (tv === 0) { ctx.fillStyle = (x+y)%2===0 ? WALL_COLOR : WALL_COLOR_B; ctx.fillRect(x*TILE_SIZE*z, y*TILE_SIZE*z, TILE_SIZE*z, TILE_SIZE*z); }
        else if (isFloor(tv)) { ctx.fillStyle = (x+y)%2===0 ? FLOOR_DEFAULT.a : FLOOR_DEFAULT.b; ctx.fillRect(x*TILE_SIZE*z, y*TILE_SIZE*z, TILE_SIZE*z, TILE_SIZE*z); }
      }
    }

    // Z-sorted scene
    const wallR = hasTileAssets() ? buildWallRenderables(z, WALL_HSB) : [];
    const sceneR = buildRenderList(s.characters, s.furniture,
      (c, ch, zm) => drawChar(c, ch, zm, sheets), (c, it, zm) => drawFurn(c, it, zm));
    const all = [...wallR, ...sceneR].sort((a, b) => a.bottomY - b.bottomY);
    for (const r of all) r.draw(ctx, z);

    // Bubbles
    for (const c of s.characters) if (c.bubble) drawBubble(ctx, c, z);

    // Highlights
    const sel = selectedRef.current; const hov = hoveredRef.current;
    if (sel) { const c = s.characters.find((ch) => ch.id === sel); if (c) drawHighlight(ctx, c, z, 0.5); }
    if (hov && hov !== sel) { const c = s.characters.find((ch) => ch.id === hov); if (c) drawHighlight(ctx, c, z, 0.25); }

    // Labels
    ctx.textAlign = "center";
    for (const c of s.characters) {
      ctx.font = `bold ${Math.max(7, 4*z)}px monospace`;
      ctx.fillStyle = c.id === sel ? c.color : "rgba(255,255,255,0.5)";
      ctx.fillText(c.label, c.pos.x*z, (c.pos.y+TILE_SIZE+8)*z);
    }

    // Scanlines + title
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    for (let y = 0; y < canvas.height; y += 3*z) ctx.fillRect(0, y, canvas.width, z);
    ctx.font = `bold ${Math.max(6,3.5*z)}px monospace`; ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillText("FLYTRAP COMMAND CENTER", 4*z, 8*z);
  }, []);

  function drawFurn(ctx: CanvasRenderingContext2D, item: FurnitureItem, z: number) {
    const sprite = getFurnitureSprite(item.type); if (!sprite) return;
    const dx = item.tileX * TILE_SIZE * z, dy = item.tileY * TILE_SIZE * z;
    if (item.color) {
      const k = `f-${item.type}-${item.color.h}-${item.color.s}-${item.color.b}-${item.color.c}-z${z}`;
      const c = colorizeFurniture(sprite, item.color, z, k);
      if (c) { ctx.drawImage(c, dx, dy); return; }
    }
    ctx.drawImage(sprite, dx, dy, item.pixelW * z, item.pixelH * z);
  }

  function drawChar(ctx: CanvasRenderingContext2D, char: Character, z: number, sheets: SpriteSheets) {
    const frame = char.state === "type" ? 1 : char.state === "walk" ? char.animFrame % 3 : 1;
    const cv = getCharacterFrame(sheets, char.appearance, char.state === "type" ? "up" : char.facing, frame);
    ctx.globalAlpha = 0.3; ctx.fillStyle = "#000"; ctx.beginPath();
    ctx.ellipse(char.pos.x*z, (char.pos.y+4)*z, 8*z, 3*z, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.drawImage(cv, (char.pos.x-16)*z, (char.pos.y-24)*z, 32*z, 32*z);
    if (char.isActive && char.state === "type") {
      ctx.fillStyle = "#4ade80"; ctx.beginPath();
      ctx.arc((char.pos.x+12)*z, (char.pos.y-22)*z, 2.5*z, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawBubble(ctx: CanvasRenderingContext2D, char: Character, z: number) {
    if (!char.bubble) return;
    const fs = Math.max(5, 3*z); ctx.font = `${fs}px monospace`;
    const m = ctx.measureText(char.bubble); const bw = m.width+6*z, bh = fs+4*z;
    const bx = char.pos.x*z - bw/2, by = (char.pos.y-28)*z;
    ctx.globalAlpha = Math.min(1, char.bubbleTimer)*0.92; ctx.fillStyle = "#fff";
    roundRect(ctx, bx, by, bw, bh, 3*z); ctx.fill();
    ctx.beginPath(); ctx.moveTo(char.pos.x*z-3*z, by+bh); ctx.lineTo(char.pos.x*z, by+bh+3*z);
    ctx.lineTo(char.pos.x*z+3*z, by+bh); ctx.fill();
    ctx.fillStyle = "#1a1a2e"; ctx.textAlign = "center";
    ctx.fillText(char.bubble, char.pos.x*z, by+bh-2*z); ctx.globalAlpha = 1;
  }

  function drawHighlight(ctx: CanvasRenderingContext2D, char: Character, z: number, a: number) {
    const p = a + Math.sin(performance.now()/1000*3)*0.15;
    ctx.strokeStyle = char.color; ctx.globalAlpha = p; ctx.lineWidth = z;
    ctx.strokeRect(char.pos.x*z-10*z, (char.pos.y-8)*z-14*z, 20*z, 28*z); ctx.globalAlpha = 1;
  }

  const worldFromEvent = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current; const s = stateRef.current;
    if (!canvas || !s) return null;
    const rect = canvas.getBoundingClientRect(); const z = s.zoom;
    return { x: (e.clientX-rect.left)*(canvas.width/rect.width)/z, y: (e.clientY-rect.top)*(canvas.height/rect.height)/z };
  }, []);

  const hitTest = useCallback((wx: number, wy: number) => {
    const s = stateRef.current; if (!s) return null;
    for (let i = s.characters.length-1; i >= 0; i--) {
      const c = s.characters[i];
      if (Math.abs(wx-c.pos.x) < 12 && Math.abs(wy-(c.pos.y-8)) < 16) return c.id;
    }
    return null;
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", background: "#0c0f1a" }}>
      <style>{`@keyframes greetFadeIn { from { opacity:0; transform:translate(-50%,-90%) } to { opacity:1; transform:translate(-50%,-100%) } }`}</style>
      {loading && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"var(--text-tertiary)", fontSize:12, fontFamily:"monospace" }}>Loading office...</div>}
      <canvas ref={canvasRef} width={WORLD_W*BASE_ZOOM} height={WORLD_H*BASE_ZOOM}
        onClick={(e) => { const w = worldFromEvent(e); if (!w) return; const id = hitTest(w.x, w.y); if (id) onSelectAgent(id); else { setGreetingAgent(null); setGreetingPos(null); } }}
        onMouseMove={(e) => { const w = worldFromEvent(e); if (!w) return; const id = hitTest(w.x, w.y); setHoveredAgent(id); if (canvasRef.current) canvasRef.current.style.cursor = id ? "pointer" : "default"; }}
        onWheel={(e) => { e.stopPropagation(); const s = stateRef.current; if (!s) return; s.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom - e.deltaY*0.005)); clearSpriteCache(); clearTileCache(); furnColorCache.clear(); }}
        style={{ width:"100%", height:"auto", display:loading?"none":"block", imageRendering:"pixelated" }} />
      {greetingAgent && greetingPos && AGENT_GREETINGS[greetingAgent] && (
        <div style={{ position:"absolute", left:greetingPos.x, top:greetingPos.y, transform:"translate(-50%,-100%)", background:"rgba(13,17,23,0.95)", border:`1px solid ${agents.find(a=>a.id===greetingAgent)?.color||"#666"}40`, borderLeft:`3px solid ${agents.find(a=>a.id===greetingAgent)?.color||"#666"}`, borderRadius:8, padding:"10px 14px", maxWidth:220, pointerEvents:"none", zIndex:10, animation:"greetFadeIn 0.3s ease-out" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <span style={{ fontSize:14 }}>{AGENT_GREETINGS[greetingAgent].emoji}</span>
            <span style={{ fontSize:11, fontWeight:700, color:agents.find(a=>a.id===greetingAgent)?.color||"#fff" }}>{agents.find(a=>a.id===greetingAgent)?.label}</span>
            <span style={{ fontSize:9, color:"#8b949e" }}>{AGENT_GREETINGS[greetingAgent].role}</span>
          </div>
          <div style={{ fontSize:11, color:"#e6edf3", lineHeight:1.5, fontStyle:"italic" }}>&ldquo;{AGENT_GREETINGS[greetingAgent].greeting}&rdquo;</div>
        </div>
      )}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", boxShadow:"inset 0 0 40px rgba(0,0,0,0.6)" }} />
    </div>
  );
}

function createCharacter(agent: AgentData, tile: { x:number; y:number }, appearance: CharacterAppearance): Character {
  const center = tileCenter(tile);
  return { id:agent.id, label:agent.label, color:agent.color, appearance, state:"idle", facing:"down",
    pos:{x:center.x,y:center.y}, path:[], deskTile:{x:tile.x,y:tile.y}, animFrame:0, animTimer:0,
    idleTimer:1+Math.random()*3, bubble:null, bubbleTimer:0, greetTimer:0, isActive:agent.isActive, status:agent.status };
}

function roundRect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
