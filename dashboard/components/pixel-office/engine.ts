// ── Game Engine — Loop, FSM, Pathfinding, Z-Sort ────────────────────────────

import type { Character, Vec2, Renderable, FurnitureItem } from "./types";
import { TILE_SIZE, GRID_COLS, GRID_ROWS } from "./office-layout";

// ── Constants ───────────────────────────────────────────────────────────────

const WALK_SPEED = 48; // px/sec
const WALK_FRAME_DUR = 0.15; // sec per walk anim frame
const TYPE_FRAME_DUR = 0.4; // sec per type anim frame toggle
const MAX_DT = 0.1; // cap delta to prevent teleporting

// ── Game Loop ───────────────────────────────────────────────────────────────

export function createGameLoop(
  update: (dt: number) => void,
  render: () => void
): { start: () => void; stop: () => void } {
  let lastTime = 0;
  let animId = 0;
  let stopped = false;

  function tick(time: number) {
    if (stopped) return;
    const dt = Math.min((time - lastTime) / 1000, MAX_DT);
    lastTime = time;
    update(dt);
    render();
    animId = requestAnimationFrame(tick);
  }

  return {
    start: () => {
      stopped = false;
      lastTime = performance.now();
      animId = requestAnimationFrame(tick);
    },
    stop: () => {
      stopped = true;
      cancelAnimationFrame(animId);
    },
  };
}

// ── Tile ↔ Pixel Helpers ────────────────────────────────────────────────────

export function tileCenter(tile: Vec2): Vec2 {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE / 2,
    y: tile.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function posToTile(pos: Vec2): Vec2 {
  return {
    x: Math.floor(pos.x / TILE_SIZE),
    y: Math.floor(pos.y / TILE_SIZE),
  };
}

// ── BFS Pathfinding ─────────────────────────────────────────────────────────

const DIRS: Vec2[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export function bfsPath(
  start: Vec2,
  end: Vec2,
  walkable: boolean[][]
): Vec2[] {
  if (start.x === end.x && start.y === end.y) return [];
  if (
    end.y < 0 || end.y >= GRID_ROWS ||
    end.x < 0 || end.x >= GRID_COLS ||
    !walkable[end.y][end.x]
  )
    return [];

  const visited: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(false)
  );
  const parent: (Vec2 | null)[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array<Vec2 | null>(GRID_COLS).fill(null)
  );
  const queue: Vec2[] = [start];
  visited[start.y][start.x] = true;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === end.x && cur.y === end.y) {
      // Reconstruct
      const path: Vec2[] = [];
      let node: Vec2 | null = end;
      while (node && !(node.x === start.x && node.y === start.y)) {
        path.unshift({ x: node.x, y: node.y });
        node = parent[node.y][node.x];
      }
      return path;
    }

    for (const d of DIRS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (
        nx >= 0 &&
        nx < GRID_COLS &&
        ny >= 0 &&
        ny < GRID_ROWS &&
        !visited[ny][nx] &&
        walkable[ny][nx]
      ) {
        visited[ny][nx] = true;
        parent[ny][nx] = cur;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return []; // no path
}

// ── Random Walkable Tile ────────────────────────────────────────────────────

export function randomWalkableTile(walkable: boolean[][]): Vec2 {
  const candidates: Vec2[] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (walkable[y][x]) candidates.push({ x, y });
    }
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ── Movement Along Path ─────────────────────────────────────────────────────

function moveAlongPath(char: Character, dt: number): void {
  if (char.path.length === 0) return;

  const target = tileCenter(char.path[0]);
  const dx = target.x - char.pos.x;
  const dy = target.y - char.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    // Snap and advance
    char.pos = { ...target };
    char.path.shift();
    return;
  }

  const step = Math.min(WALK_SPEED * dt, dist);
  char.pos.x += (dx / dist) * step;
  char.pos.y += (dy / dist) * step;

  // Update facing
  if (Math.abs(dx) > Math.abs(dy)) {
    char.facing = dx > 0 ? "right" : "left";
  } else {
    char.facing = dy > 0 ? "down" : "up";
  }

  // Walk animation frame cycling
  char.animTimer += dt;
  if (char.animTimer >= WALK_FRAME_DUR) {
    char.animTimer -= WALK_FRAME_DUR;
    char.animFrame = (char.animFrame + 1) % 4;
  }
}

// ── Character FSM Update ────────────────────────────────────────────────────

export function updateCharacter(
  char: Character,
  dt: number,
  walkable: boolean[][]
): void {
  switch (char.state) {
    case "idle": {
      char.idleTimer -= dt;
      if (char.idleTimer <= 0) {
        if (char.isActive) {
          // Go to desk
          const curTile = posToTile(char.pos);
          char.path = bfsPath(curTile, char.deskTile, walkable);
          if (char.path.length > 0) {
            char.state = "walk";
            char.animFrame = 0;
            char.animTimer = 0;
          } else {
            // Already at desk
            char.state = "type";
            char.facing = "up";
            char.animFrame = 0;
            char.animTimer = 0;
          }
        } else {
          // Wander
          const target = randomWalkableTile(walkable);
          const curTile = posToTile(char.pos);
          char.path = bfsPath(curTile, target, walkable);
          if (char.path.length > 0) {
            char.state = "walk";
            char.animFrame = 0;
            char.animTimer = 0;
          }
          char.idleTimer = 3 + Math.random() * 5;
        }
      }
      break;
    }

    case "walk": {
      moveAlongPath(char, dt);
      if (char.path.length === 0) {
        const curTile = posToTile(char.pos);
        if (
          curTile.x === char.deskTile.x &&
          curTile.y === char.deskTile.y &&
          char.isActive
        ) {
          char.state = "type";
          char.facing = "up";
          char.animFrame = 0;
          char.animTimer = 0;
        } else {
          char.state = "idle";
          char.idleTimer = 2 + Math.random() * 4;
          char.animFrame = 0;
        }
      }
      break;
    }

    case "type": {
      char.animTimer += dt;
      if (char.animTimer >= TYPE_FRAME_DUR) {
        char.animTimer -= TYPE_FRAME_DUR;
        char.animFrame = (char.animFrame + 1) % 2;
      }
      if (!char.isActive) {
        char.state = "idle";
        char.idleTimer = 1 + Math.random() * 3;
        char.animFrame = 0;
      }
      break;
    }
  }

  // Bubble timer
  if (char.bubble && char.bubbleTimer > 0) {
    char.bubbleTimer -= dt;
    if (char.bubbleTimer <= 0) {
      char.bubble = null;
    }
  }
}

// ── Z-Sort Render List Builder ──────────────────────────────────────────────

export function buildRenderList(
  characters: Character[],
  furniture: FurnitureItem[],
  drawCharFn: (ctx: CanvasRenderingContext2D, char: Character, zoom: number) => void,
  drawFurnFn: (ctx: CanvasRenderingContext2D, item: FurnitureItem, zoom: number) => void
): Renderable[] {
  const list: Renderable[] = [];

  for (const f of furniture) {
    list.push({
      bottomY: (f.tileY + f.heightTiles) * TILE_SIZE,
      draw: (ctx, zoom) => drawFurnFn(ctx, f, zoom),
    });
  }

  for (const c of characters) {
    list.push({
      bottomY: c.pos.y + TILE_SIZE,
      draw: (ctx, zoom) => drawCharFn(ctx, c, zoom),
    });
  }

  list.sort((a, b) => a.bottomY - b.bottomY);
  return list;
}
