// ── Agent Behavior Tendencies — POI detection + weighted activity profiles ────

import type { Vec2, FurnitureItem, Character } from "./types";
import type { Direction } from "./types";

// ── POI Types ───────────────────────────────────────────────────────────────

export type PoiType =
  | "water_cooler"
  | "vending_machine"
  | "bookshelf"
  | "couch"
  | "coffee_table"
  | "server"
  | "rug";

export interface Poi {
  type: PoiType;
  /** Tile the agent walks to (adjacent walkable) */
  tile: Vec2;
  /** Direction agent faces when at the POI */
  facing: Direction;
  /** Whether the agent "sits" here (lowered Y offset) */
  sitting: boolean;
}

// ── Furniture → POI type mapping ────────────────────────────────────────────

const ASSET_TO_POI: Record<string, { type: PoiType; sitting: boolean }> = {
  ASSET_42: { type: "water_cooler", sitting: false },
  ASSET_40: { type: "vending_machine", sitting: false },
  ASSET_17: { type: "bookshelf", sitting: false },
  ASSET_18: { type: "bookshelf", sitting: false },
  ASSET_NEW_110: { type: "couch", sitting: true },
  ASSET_NEW_111: { type: "couch", sitting: true },
  ASSET_NEW_112: { type: "coffee_table", sitting: false },
  ASSET_123: { type: "server", sitting: false },
  ASSET_148: { type: "rug", sitting: true },
};

// ── POI Detection ───────────────────────────────────────────────────────────

const DIRS: Vec2[] = [
  { x: 0, y: 1 },  // below → face up
  { x: 0, y: -1 }, // above → face down
  { x: -1, y: 0 }, // left → face right
  { x: 1, y: 0 },  // right → face left
];

const DIR_TO_FACING: Record<string, Direction> = {
  "0,1": "up",
  "0,-1": "down",
  "-1,0": "right",
  "1,0": "left",
};

/** Scan furniture list and find walkable tiles adjacent to POI furniture */
export function detectPois(
  furniture: FurnitureItem[],
  walkable: boolean[][],
  gridRows: number,
  gridCols: number,
): Poi[] {
  const pois: Poi[] = [];

  for (const f of furniture) {
    const mapping = ASSET_TO_POI[f.type];
    if (!mapping) continue;

    // For sitting POIs (rug, couch), the agent walks ON the furniture tile itself
    if (mapping.sitting) {
      // Find a walkable tile within the furniture footprint, or adjacent
      for (let dy = 0; dy < f.heightTiles; dy++) {
        for (let dx = 0; dx < f.widthTiles; dx++) {
          const tx = f.tileX + dx;
          const ty = f.tileY + dy;
          if (ty >= 0 && ty < gridRows && tx >= 0 && tx < gridCols && walkable[ty][tx]) {
            pois.push({
              type: mapping.type,
              tile: { x: tx, y: ty },
              facing: "down",
              sitting: true,
            });
            break; // one POI per furniture item is enough
          }
        }
        if (pois.length > 0 && pois[pois.length - 1].type === mapping.type) break;
      }

      // If no walkable tile on the furniture, find adjacent
      if (pois.length === 0 || pois[pois.length - 1].type !== mapping.type) {
        const adj = findAdjacentWalkable(f, walkable, gridRows, gridCols);
        if (adj) {
          pois.push({ type: mapping.type, tile: adj.tile, facing: adj.facing, sitting: true });
        }
      }
      continue;
    }

    // For standing POIs, find adjacent walkable tile
    const adj = findAdjacentWalkable(f, walkable, gridRows, gridCols);
    if (adj) {
      pois.push({ type: mapping.type, tile: adj.tile, facing: adj.facing, sitting: false });
    }
  }

  return pois;
}

function findAdjacentWalkable(
  f: FurnitureItem,
  walkable: boolean[][],
  gridRows: number,
  gridCols: number,
): { tile: Vec2; facing: Direction } | null {
  // Check tiles adjacent to the furniture footprint
  for (let dy = 0; dy < f.heightTiles; dy++) {
    for (let dx = 0; dx < f.widthTiles; dx++) {
      const fx = f.tileX + dx;
      const fy = f.tileY + dy;

      for (const d of DIRS) {
        const nx = fx + d.x;
        const ny = fy + d.y;
        if (
          ny >= 0 && ny < gridRows &&
          nx >= 0 && nx < gridCols &&
          walkable[ny][nx]
        ) {
          // Make sure this adjacent tile isn't inside the furniture itself
          const insideFurniture =
            nx >= f.tileX && nx < f.tileX + f.widthTiles &&
            ny >= f.tileY && ny < f.tileY + f.heightTiles;
          if (!insideFurniture) {
            const facing = DIR_TO_FACING[`${d.x},${d.y}`] ?? "down";
            // Invert: agent faces TOWARD the furniture
            const inverseFacing: Direction =
              facing === "up" ? "down" :
              facing === "down" ? "up" :
              facing === "left" ? "right" : "left";
            return { tile: { x: nx, y: ny }, facing: inverseFacing };
          }
        }
      }
    }
  }
  return null;
}

// ── Tendency Profiles ───────────────────────────────────────────────────────

export interface TendencyProfile {
  /** Weighted idle activities: keys are PoiType | "wander" | "social" | "desk" */
  activities: Record<string, number>;
  /** 0-1: chance of voluntarily returning to desk when idle */
  deskAffinity: number;
  /** 0-1: chance of walking toward a nearby idle agent */
  socialChance: number;
  /** [min, max] seconds to linger at a POI or social spot */
  idleDuration: [number, number];
}

export const AGENT_TENDENCIES: Record<string, TendencyProfile> = {
  oracle: {
    activities: { rug: 0.45, bookshelf: 0.25, wander: 0.15, coffee_table: 0.15 },
    deskAffinity: 0.25,
    socialChance: 0.05,
    idleDuration: [45, 120],
  },
  sentinel: {
    activities: { desk: 0.5, server: 0.2, wander: 0.2, water_cooler: 0.1 },
    deskAffinity: 0.8,
    socialChance: 0.1,
    idleDuration: [60, 180],
  },
  scout: {
    activities: { wander: 0.35, water_cooler: 0.2, vending_machine: 0.15, social: 0.3 },
    deskAffinity: 0.15,
    socialChance: 0.5,
    idleDuration: [15, 40],
  },
  architect: {
    activities: { wander: 0.15, bookshelf: 0.15, coffee_table: 0.3, social: 0.4 },
    deskAffinity: 0.3,
    socialChance: 0.4,
    idleDuration: [30, 75],
  },
  strategist: {
    activities: { bookshelf: 0.35, coffee_table: 0.25, desk: 0.2, wander: 0.2 },
    deskAffinity: 0.55,
    socialChance: 0.15,
    idleDuration: [45, 120],
  },
  optimize: {
    activities: { desk: 0.4, server: 0.25, water_cooler: 0.15, wander: 0.2 },
    deskAffinity: 0.7,
    socialChance: 0.2,
    idleDuration: [60, 150],
  },
  isabel: {
    activities: { wander: 0.3, couch: 0.3, rug: 0.15, social: 0.25 },
    deskAffinity: 0.15,
    socialChance: 0.35,
    idleDuration: [30, 90],
  },
};

// ── Activity Selection ──────────────────────────────────────────────────────

export type IdleActivity =
  | { kind: "poi"; poi: Poi }
  | { kind: "social"; targetAgent: string }
  | { kind: "wander" }
  | { kind: "desk" };

/** Pick a weighted-random activity for an idle agent */
export function pickActivity(
  agentId: string,
  pois: Poi[],
  allCharacters: Character[],
  walkable: boolean[][],
): IdleActivity {
  const profile = AGENT_TENDENCIES[agentId];
  if (!profile) return { kind: "wander" };

  // 1. Desk affinity check
  if (Math.random() < profile.deskAffinity) {
    return { kind: "desk" };
  }

  // 2. Social check — find nearby idle agents
  if (Math.random() < profile.socialChance) {
    const self = allCharacters.find((c) => c.id === agentId);
    if (self) {
      const nearby = allCharacters.filter(
        (c) =>
          c.id !== agentId &&
          !c.isActive &&
          c.state === "idle" &&
          Math.abs(c.pos.x - self.pos.x) < 80 &&
          Math.abs(c.pos.y - self.pos.y) < 80
      );
      if (nearby.length > 0) {
        const target = nearby[Math.floor(Math.random() * nearby.length)];
        return { kind: "social", targetAgent: target.id };
      }
    }
  }

  // 3. Weighted random from activities
  const entries = Object.entries(profile.activities);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;

  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      if (key === "wander") return { kind: "wander" };
      if (key === "desk") return { kind: "desk" };
      if (key === "social") {
        // Try to find any idle agent anywhere
        const self = allCharacters.find((c) => c.id === agentId);
        if (self) {
          const others = allCharacters.filter(
            (c) => c.id !== agentId && !c.isActive && c.state !== "type"
          );
          if (others.length > 0) {
            const target = others[Math.floor(Math.random() * others.length)];
            return { kind: "social", targetAgent: target.id };
          }
        }
        return { kind: "wander" }; // fallback if nobody available
      }

      // POI type — find a matching POI
      const matching = pois.filter((p) => p.type === key);
      if (matching.length > 0) {
        const poi = matching[Math.floor(Math.random() * matching.length)];
        return { kind: "poi", poi };
      }
      // POI not found in layout — fall through to wander
      return { kind: "wander" };
    }
  }

  return { kind: "wander" };
}

/** Get idle duration for an agent's current activity */
export function getIdleDuration(agentId: string): number {
  const profile = AGENT_TENDENCIES[agentId];
  if (!profile) return 3 + Math.random() * 4;
  const [min, max] = profile.idleDuration;
  return min + Math.random() * (max - min);
}
