# Agent Behavior Tendencies — Design

**Date:** 2026-03-01
**Scope:** `dashboard/components/pixel-office/`

## Problem

All 7 agents share identical idle behavior: walk to random tile, pause 2-7s, repeat. No personality in movement. Oracle should be elusive and contemplative; Scout should be restless and social; Sentinel should be a workaholic. Currently they all just wander aimlessly.

## Solution

### 1. Points of Interest (POIs)

Auto-detect furniture types as POIs at init. Each POI has a walkable tile agents pathfind to and a facing direction.

| POI Type | Asset(s) | Behavior |
|----------|----------|----------|
| `water_cooler` | ASSET_42 | Stand facing it |
| `vending_machine` | ASSET_40 | Stand facing it |
| `bookshelf` | ASSET_17, ASSET_18 | Stand facing, "browsing" |
| `couch` | ASSET_NEW_110, ASSET_NEW_111 | Sit (lowered Y) |
| `coffee_table` | ASSET_NEW_112 | Stand near it |
| `server` | ASSET_123 | Stand facing it |
| `rug` | ASSET_148 | Sit on floor (lowered Y) |

Detection: scan `buildFurnitureList()` output, match `type` to a POI category map, find adjacent walkable tile via `buildWalkableMap()`.

### 2. Tendency Profiles (tendencies.ts)

Each agent gets:
- `activities`: weighted map of idle activities (POI types + `wander` + `social` + `desk`)
- `deskAffinity`: 0-1, chance of returning to desk when idle (workaholic factor)
- `socialChance`: 0-1, probability of walking toward nearby idle agent
- `idleDuration`: [min, max] seconds to linger at a POI
- `wanderStyle`: `"short"` (1-3 tiles) or `"long"` (anywhere) — how far they roam

Profiles:
- **Oracle**: Rug 45%, bookshelf 25%, wander 15%, coffee table 15%. Low desk affinity (0.1), almost never social (0.05). Long idle durations.
- **Sentinel**: Desk 50%, server 20%, wander 20%, water cooler 10%. High desk affinity (0.7), low social (0.15).
- **Scout**: Wander 40%, water cooler 20%, vending 15%, social 25%. Lowest desk affinity (0.05), highest social (0.6). Short idle durations.
- **Architect**: Wander 20%, bookshelf 15%, coffee table 30%, social 35%. Low desk affinity (0.15), high social (0.5).
- **Strategist**: Bookshelf 35%, coffee table 25%, desk 20%, wander 20%. Medium desk affinity (0.4), moderate social (0.2).
- **Optimize**: Desk 40%, server 25%, water cooler 15%, wander 20%. High desk affinity (0.6), moderate social (0.25).
- **Isabel**: Wander 35%, couch 25%, rug 15%, social 25%. Low desk affinity (0.05), high social (0.45).

### 3. FSM Changes (engine.ts)

Current idle transition: `randomWalkableTile()` always.

New idle transition:
1. Roll `deskAffinity` — if hit, return to desk, sit for extended duration
2. Roll `socialChance` — if hit AND another idle agent within range, pathfind near them
3. Otherwise, weighted-random pick from `activities`:
   - POI type → find matching POI, pathfind to it, face it, linger
   - `wander` → current random tile behavior
   - `desk` → return to desk voluntarily

New states needed: none. The 3 existing states (idle/walk/type) are sufficient. We add fields to `Character`:
- `tendency`: reference to agent's tendency profile
- `currentActivity`: what they're doing at idle destination (`"poi"` | `"social"` | `"wander"` | `"desk_rest"`)
- `activityTarget`: POI or agent they're headed toward

### 4. Social Interactions

When two agents end up within 2 tiles and at least one rolled "social":
- Both face each other
- Both pause 3-6 seconds
- Brief "..." bubble (optional)

### 5. Sitting at Non-Desk Locations

Rug and couch POIs: character uses standing frame (animFrame=1) with a Y offset to appear seated. No new sprites needed.

## Files Changed

- **New:** `tendencies.ts` — tendency profiles + POI detection
- **Modified:** `types.ts` — add tendency fields to Character
- **Modified:** `engine.ts` — new idle decision logic, social proximity check
- **Modified:** `office-layout.ts` — export POI builder function
- **Modified:** `PixelOffice.tsx` — pass tendencies to character init, render sitting offset at POIs
