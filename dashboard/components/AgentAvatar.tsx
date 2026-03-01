"use client";

import { useRef, useEffect } from "react";

/**
 * Renders a pixel-art agent face from sprite sheets.
 * Lightweight — loads only the 3 sheets needed (body, outfit, hair),
 * composites a single "facing down, standing" frame onto a small canvas.
 */

interface AgentConfig {
  skinRow: number;
  hairRow: number;
  outfitIndex: number;
}

const AGENTS: Record<string, AgentConfig> = {
  sentinel:   { skinRow: 3, hairRow: 7, outfitIndex: 0 },
  scout:      { skinRow: 2, hairRow: 0, outfitIndex: 1 },
  oracle:     { skinRow: 0, hairRow: 1, outfitIndex: 2 },
  architect:  { skinRow: 4, hairRow: 3, outfitIndex: 3 },
  optimize:   { skinRow: 1, hairRow: 6, outfitIndex: 4 },
  strategist: { skinRow: 5, hairRow: 5, outfitIndex: 5 },
  isabel:     { skinRow: 4, hairRow: 2, outfitIndex: 6 },
};

// Shared image cache — loaded once across all AgentAvatar instances
const imageCache: Record<string, HTMLImageElement> = {};

function loadImg(url: string): Promise<HTMLImageElement> {
  if (imageCache[url]) return Promise.resolve(imageCache[url]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache[url] = img; resolve(img); };
    img.onerror = () => reject(new Error(`Failed: ${url}`));
    img.src = url;
  });
}

interface Props {
  agent: string;
  size?: number;
}

export default function AgentAvatar({ agent, size = 36 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = AGENTS[agent];

  useEffect(() => {
    if (!config || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // Face-down, standing frame = col 1 (middle of down walk cycle)
    const col = 1;

    const outfitFile = `/sprites/outfit${config.outfitIndex + 1}.png`;

    Promise.all([
      loadImg("/sprites/character-model.png"),
      loadImg(outfitFile),
      loadImg("/sprites/hairs.png"),
    ]).then(([body, outfit, hair]) => {
      ctx.clearRect(0, 0, 32, 32);

      // Layer 1: Body
      ctx.drawImage(body, col * 32, config.skinRow * 32, 32, 32, 0, 0, 32, 32);
      // Layer 2: Outfit
      ctx.drawImage(outfit, col * 32, 0, 32, 32, 0, 0, 32, 32);
      // Layer 3: Hair
      ctx.drawImage(hair, col * 32, config.hairRow * 32, 32, 32, 0, 0, 32, 32);
    });
  }, [config]);

  if (!config) return null;

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
}
