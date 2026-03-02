// ── Game Engine — Loop, FSM, Pathfinding, Z-Sort ────────────────────────────

import type { Character, Vec2, Renderable, FurnitureItem } from "./types";
import { TILE_SIZE, GRID_COLS, GRID_ROWS } from "./office-layout";
import type { Poi } from "./tendencies";
import { pickActivity, getIdleDuration } from "./tendencies";

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
    char.animFrame = (char.animFrame + 1) % 3;
  }
}

// ── Stop Character (on click) ────────────────────────────────────────────────

export function stopCharacter(char: Character): void {
  char.state = "idle";
  char.path = [];
  char.facing = "down";
  char.animFrame = 1; // standing frame
  char.animTimer = 0;
  char.greetTimer = 6;
  char.idleTimer = 10; // stay still while greeting shows
}

// ── Character FSM Update ────────────────────────────────────────────────────

export function updateCharacter(
  char: Character,
  dt: number,
  walkable: boolean[][],
  pois: Poi[],
  allCharacters: Character[],
): void {
  // Greeting timer — keep character still while greeting popup shows
  if (char.greetTimer > 0) {
    char.greetTimer -= dt;
    if (char.greetTimer <= 0) {
      char.greetTimer = 0;
    }
    // Still decay bubble timer during greeting
    if (char.bubble && char.bubbleTimer > 0) {
      char.bubbleTimer -= dt;
      if (char.bubbleTimer <= 0) char.bubble = null;
    }
    return; // skip FSM while greeting is active
  }

  switch (char.state) {
    case "idle": {
      // Social interaction: face toward partner while socializing
      if (char.currentActivity === "social" && char.socialTarget) {
        const partner = allCharacters.find((c) => c.id === char.socialTarget);
        if (partner) {
          const dx = partner.pos.x - char.pos.x;
          const dy = partner.pos.y - char.pos.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            char.facing = dx > 0 ? "right" : "left";
          } else {
            char.facing = dy > 0 ? "down" : "up";
          }
        }
      }

      char.idleTimer -= dt;
      if (char.idleTimer <= 0) {
        // Clear sitting state when leaving idle
        char.sittingAtPoi = false;
        char.currentActivity = null;
        char.socialTarget = null;

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
          // Tendency-driven idle decision
          const activity = pickActivity(char.id, pois, allCharacters, walkable);
          const curTile = posToTile(char.pos);

          switch (activity.kind) {
            case "desk": {
              char.currentActivity = "desk_rest";
              char.path = bfsPath(curTile, char.deskTile, walkable);
              if (char.path.length > 0) {
                char.state = "walk";
                char.animFrame = 0;
                char.animTimer = 0;
              } else {
                // Already at desk — sit for a while
                char.state = "type";
                char.facing = "up";
                char.animFrame = 0;
                char.animTimer = 0;
                char.idleTimer = getIdleDuration(char.id);
              }
              break;
            }

            case "poi": {
              char.currentActivity = "poi";
              char.path = bfsPath(curTile, activity.poi.tile, walkable);
              if (char.path.length > 0) {
                char.state = "walk";
                char.animFrame = 0;
                char.animTimer = 0;
                // Store POI info for arrival behavior
                char._targetPoi = activity.poi;
              } else {
                // Already at POI tile
                char.facing = activity.poi.facing;
                char.sittingAtPoi = activity.poi.sitting;
                char.idleTimer = getIdleDuration(char.id);
                char.animFrame = 1; // standing frame
              }
              break;
            }

            case "social": {
              char.currentActivity = "social";
              char.socialTarget = activity.targetAgent;
              const target = allCharacters.find((c) => c.id === activity.targetAgent);
              if (target) {
                // Walk to a tile near the target
                const targetTile = posToTile(target.pos);
                // Try adjacent tiles
                const adjacentOptions = [
                  { x: targetTile.x + 1, y: targetTile.y },
                  { x: targetTile.x - 1, y: targetTile.y },
                  { x: targetTile.x, y: targetTile.y + 1 },
                  { x: targetTile.x, y: targetTile.y - 1 },
                ];
                let found = false;
                for (const adj of adjacentOptions) {
                  if (
                    adj.y >= 0 && adj.y < GRID_ROWS &&
                    adj.x >= 0 && adj.x < GRID_COLS &&
                    walkable[adj.y][adj.x]
                  ) {
                    char.path = bfsPath(curTile, adj, walkable);
                    if (char.path.length > 0) {
                      char.state = "walk";
                      char.animFrame = 0;
                      char.animTimer = 0;
                      found = true;
                      break;
                    }
                  }
                }
                if (!found) {
                  // Can't reach — just wander
                  char.currentActivity = "wander";
                  char.socialTarget = null;
                  const wanderTarget = randomWalkableTile(walkable);
                  char.path = bfsPath(curTile, wanderTarget, walkable);
                  if (char.path.length > 0) {
                    char.state = "walk";
                    char.animFrame = 0;
                    char.animTimer = 0;
                  }
                  char.idleTimer = getIdleDuration(char.id);
                }
              }
              break;
            }

            case "wander":
            default: {
              char.currentActivity = "wander";
              const target = randomWalkableTile(walkable);
              char.path = bfsPath(curTile, target, walkable);
              if (char.path.length > 0) {
                char.state = "walk";
                char.animFrame = 0;
                char.animTimer = 0;
              }
              char.idleTimer = getIdleDuration(char.id);
              break;
            }
          }
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
        } else if (char.currentActivity === "desk_rest" &&
          curTile.x === char.deskTile.x &&
          curTile.y === char.deskTile.y) {
          // Arrived at desk for voluntary rest
          char.state = "type";
          char.facing = "up";
          char.animFrame = 0;
          char.animTimer = 0;
          // Use a desk-rest timer — will transition back to idle when it expires
          char.idleTimer = getIdleDuration(char.id);
          // Temporarily mark as "active-looking" so type animation plays
          char._deskResting = true;
        } else if (char.currentActivity === "poi" && char._targetPoi) {
          // Arrived at POI — face it and linger
          char.state = "idle";
          char.facing = char._targetPoi.facing;
          char.sittingAtPoi = char._targetPoi.sitting;
          char.idleTimer = getIdleDuration(char.id);
          char.animFrame = 1; // standing frame
          char._targetPoi = undefined;
        } else if (char.currentActivity === "social") {
          // Arrived near social target — face them and chat
          char.state = "idle";
          const partner = allCharacters.find((c) => c.id === char.socialTarget);
          if (partner) {
            const dx = partner.pos.x - char.pos.x;
            const dy = partner.pos.y - char.pos.y;
            if (Math.abs(dx) > Math.abs(dy)) {
              char.facing = dx > 0 ? "right" : "left";
            } else {
              char.facing = dy > 0 ? "down" : "up";
            }
          }
          char.idleTimer = 15 + Math.random() * 30; // chat for 15-45 sec
          char.animFrame = 1;
        } else {
          char.state = "idle";
          char.idleTimer = getIdleDuration(char.id);
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
      // Desk resting (voluntary) — leave after timer expires
      if (char._deskResting) {
        char.idleTimer -= dt;
        if (char.idleTimer <= 0) {
          char._deskResting = false;
          char.currentActivity = null;
          char.state = "idle";
          char.idleTimer = 10 + Math.random() * 20; // brief pause before next activity
          char.animFrame = 0;
        }
        break;
      }
      if (!char.isActive) {
        char.state = "idle";
        char.idleTimer = 10 + Math.random() * 20; // don't immediately start moving
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
    let bottomY = (f.tileY + f.heightTiles) * TILE_SIZE;

    // Surface item z-boost: small non-solid items sitting on solid furniture
    // get their z pushed above the container (like PA's surface item logic)
    if (!f.solid && !f.wallMounted) {
      for (const container of furniture) {
        if (container === f || !container.solid) continue;
        // Check if this item overlaps the container's tile footprint
        const fx = f.tileX, fy = f.tileY;
        const cx = container.tileX, cy = container.tileY;
        const cw = container.widthTiles, ch = container.heightTiles;
        if (fx >= cx && fx < cx + cw && fy >= cy && fy < cy + ch) {
          const containerBottom = (cy + ch) * TILE_SIZE;
          if (bottomY <= containerBottom) {
            bottomY = containerBottom + 0.5;
          }
          break;
        }
      }
    }

    list.push({
      bottomY,
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
