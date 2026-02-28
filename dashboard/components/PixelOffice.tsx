"use client";

import { useRef, useEffect, useState, useCallback } from "react";

type AgentState = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  status: string;
  isActive: boolean;
};

// Pixel character sprites (10x12 grid, 1=head, 2=body, 3=arm, 4=eye)
const SPRITE = [
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 4, 1, 1, 4, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 2, 2, 0, 0, 0, 0],
  [0, 0, 0, 2, 2, 2, 2, 0, 0, 0],
  [0, 0, 3, 2, 2, 2, 2, 3, 0, 0],
  [0, 0, 3, 2, 2, 2, 2, 3, 0, 0],
  [0, 0, 0, 2, 2, 2, 2, 0, 0, 0],
  [0, 0, 0, 2, 0, 0, 2, 0, 0, 0],
  [0, 0, 0, 2, 0, 0, 2, 0, 0, 0],
];

// Typing animation - arms move
const SPRITE_TYPING = [
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 4, 1, 1, 4, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 2, 2, 0, 0, 0, 0],
  [0, 0, 0, 2, 2, 2, 2, 0, 0, 0],
  [0, 3, 0, 2, 2, 2, 2, 0, 3, 0],
  [0, 0, 3, 2, 2, 2, 2, 3, 0, 0],
  [0, 0, 0, 2, 2, 2, 2, 0, 0, 0],
  [0, 0, 0, 2, 0, 0, 2, 0, 0, 0],
  [0, 0, 0, 2, 0, 0, 2, 0, 0, 0],
];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawPixelChar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  sprite: number[][],
  scale: number,
  bobOffset: number
) {
  const [r, g, b] = hexToRgb(color);
  const bodyColor = `rgb(${Math.floor(r * 0.7)}, ${Math.floor(g * 0.7)}, ${Math.floor(b * 0.7)})`;
  const armColor = `rgb(${Math.floor(r * 0.55)}, ${Math.floor(g * 0.55)}, ${Math.floor(b * 0.55)})`;

  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const cell = sprite[row][col];
      if (cell === 0) continue;

      if (cell === 1) ctx.fillStyle = color;
      else if (cell === 2) ctx.fillStyle = bodyColor;
      else if (cell === 3) ctx.fillStyle = armColor;
      else if (cell === 4) ctx.fillStyle = "#1a1a2e";

      ctx.fillRect(
        x + col * scale,
        y + row * scale + bobOffset,
        scale,
        scale
      );
    }
  }
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  // Desk surface
  ctx.fillStyle = "#3d2b1f";
  ctx.fillRect(x - 8, y, w + 16, 6);
  // Desk edge
  ctx.fillStyle = "#2a1f15";
  ctx.fillRect(x - 8, y + 6, w + 16, 3);
  // Monitor
  ctx.fillStyle = "#1a2332";
  ctx.fillRect(x + w / 2 - 12, y - 18, 24, 16);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x + w / 2 - 10, y - 16, 20, 12);
  // Monitor stand
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x + w / 2 - 2, y - 2, 4, 3);
}

// Desk positions in a 2-row, 3-column layout
const DESK_LAYOUT = [
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 0, row: 1 },
  { col: 1, row: 1 },
  { col: 2, row: 1 },
];

export default function PixelOffice({
  agents,
  selectedAgent,
  onSelectAgent,
}: {
  agents: AgentState[];
  selectedAgent: string | null;
  onSelectAgent: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  const CANVAS_W = 520;
  const CANVAS_H = 280;
  const PIXEL_SCALE = 3;
  const CHAR_W = 10 * PIXEL_SCALE;

  const getAgentBounds = useCallback(() => {
    const colSpacing = CANVAS_W / 3;
    const rowSpacing = 120;
    const startY = 40;

    return agents.map((_, i) => {
      const { col, row } = DESK_LAYOUT[i];
      const cx = colSpacing * col + colSpacing / 2;
      const cy = startY + row * rowSpacing;
      return {
        x: cx - CHAR_W / 2 - 15,
        y: cy - 10,
        w: CHAR_W + 30,
        h: 100,
      };
    });
  }, [agents, CHAR_W]);

  // Handle clicks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const bounds = getAgentBounds();
      for (let i = 0; i < bounds.length; i++) {
        const b = bounds[i];
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          onSelectAgent(agents[i].id);
          return;
        }
      }
    }

    function handleMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const bounds = getAgentBounds();
      let found: string | null = null;
      for (let i = 0; i < bounds.length; i++) {
        const b = bounds[i];
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          found = agents[i].id;
          break;
        }
      }
      setHoveredAgent(found);
      canvas!.style.cursor = found ? "pointer" : "default";
    }

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMove);
    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousemove", handleMove);
    };
  }, [agents, getAgentBounds, onSelectAgent]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    function draw() {
      frame++;
      ctx!.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background — dark office floor
      ctx!.fillStyle = "#0c0f1a";
      ctx!.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Floor grid lines (subtle)
      ctx!.strokeStyle = "rgba(255,255,255,0.03)";
      ctx!.lineWidth = 1;
      for (let x = 0; x < CANVAS_W; x += 40) {
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, CANVAS_H);
        ctx!.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += 40) {
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(CANVAS_W, y);
        ctx!.stroke();
      }

      const colSpacing = CANVAS_W / 3;
      const rowSpacing = 120;
      const startY = 40;

      agents.forEach((agent, i) => {
        const { col, row } = DESK_LAYOUT[i];
        const cx = colSpacing * col + colSpacing / 2;
        const cy = startY + row * rowSpacing;

        const charX = cx - CHAR_W / 2;
        const charY = cy;

        // Bob animation (slow sine)
        const bobPhase = (frame * 0.03 + i * 1.2) % (Math.PI * 2);
        const bobOffset = Math.sin(bobPhase) * 1.5;

        // Typing toggle for active agents
        const isTyping = agent.isActive && Math.floor(frame / 20) % 2 === 0;
        const sprite = isTyping ? SPRITE_TYPING : SPRITE;

        // Selection / hover glow
        if (selectedAgent === agent.id || hoveredAgent === agent.id) {
          const [r, g, b] = hexToRgb(agent.color);
          ctx!.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
          ctx!.shadowBlur = 15;
        }

        // Draw desk first (behind character's lower half)
        drawDesk(ctx!, charX, charY + 8 * PIXEL_SCALE + bobOffset, CHAR_W);

        // Draw character (upper body only — desk hides legs)
        drawPixelChar(ctx!, charX, charY + bobOffset, agent.color, sprite, PIXEL_SCALE, 0);

        // Reset shadow
        ctx!.shadowColor = "transparent";
        ctx!.shadowBlur = 0;

        // Activity indicator dot
        if (agent.isActive) {
          ctx!.fillStyle = "#4ade80";
          ctx!.beginPath();
          ctx!.arc(cx + CHAR_W / 2 + 4, cy + 2, 3, 0, Math.PI * 2);
          ctx!.fill();
        }

        // Name label
        ctx!.font = "bold 10px monospace";
        ctx!.textAlign = "center";
        ctx!.fillStyle = selectedAgent === agent.id ? agent.color : "rgba(255,255,255,0.7)";
        ctx!.fillText(agent.label, cx, cy + 12 * PIXEL_SCALE + 18 + bobOffset);

        // Status text (truncated)
        ctx!.font = "9px monospace";
        ctx!.fillStyle = "rgba(255,255,255,0.35)";
        const statusText = agent.status.length > 20 ? agent.status.slice(0, 19) + "…" : agent.status;
        ctx!.fillText(statusText, cx, cy + 12 * PIXEL_SCALE + 30 + bobOffset);
      });

      // "FLYTRAP COMMAND CENTER" header text
      ctx!.font = "bold 9px monospace";
      ctx!.textAlign = "left";
      ctx!.fillStyle = "rgba(255,255,255,0.15)";
      ctx!.fillText("FLYTRAP COMMAND CENTER", 10, 14);

      // Scanline effect
      for (let y = 0; y < CANVAS_H; y += 3) {
        ctx!.fillStyle = "rgba(0,0,0,0.08)";
        ctx!.fillRect(0, y, CANVAS_W, 1);
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [agents, selectedAgent, hoveredAgent, CHAR_W]);

  return (
    <div style={{
      background: "#0c0f1a",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
      position: "relative",
    }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated" }}
      />
      {/* Subtle overlay border */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        borderRadius: 10,
        boxShadow: "inset 0 0 30px rgba(0,0,0,0.5)",
      }} />
    </div>
  );
}
