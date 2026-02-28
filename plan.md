# Phase 1: Sync System Implementation Plan

Connect the Next.js dashboard to the Python pipeline via a Sync button in the UI.

---

## What We're Building

A sync system that lets you hit "Sync" in the dashboard sidebar to trigger the full collect → process → moments pipeline, with real-time progress feedback and a loading video on first sync.

**Data flow:**
```
Click "Sync" → POST /api/sync → spawn python3 run_pipeline.py --sync --sync-state
                                        ↓
Pipeline writes progress to data/sync_state.json at each stage
                                        ↓
Client polls GET /api/sync every 2s → updates sidebar spinner + stage label
                                        ↓
On complete → router.refresh() reloads server data → dashboard shows fresh results
```

---

## Files to Create/Modify

| File | Action | What |
|------|--------|------|
| `scripts/run_pipeline.py` | **Modify** | Add `--sync`, `--sync-state`, `--force` flags + state file writer |
| `dashboard/app/api/sync/route.ts` | **Create** | GET (poll status) + POST (trigger sync/briefing) |
| `dashboard/app/api/sync/briefing-status/route.ts` | **Create** | Check if today's briefing exists |
| `dashboard/components/SyncProvider.tsx` | **Create** | React context: polling, elapsed timer, freshness, shared state |
| `dashboard/components/SyncFooter.tsx` | **Create** | Sidebar footer: sync button, briefing button, status dot |
| `dashboard/components/BlankState.tsx` | **Create** | Empty-state UI with centered Sync button |
| `dashboard/components/SyncVideoOverlay.tsx` | **Create** | Full-screen loading video during first sync |
| `dashboard/components/DashboardHome.tsx` | **Create** | Client wrapper for home page (blank-state vs. grid) |
| `dashboard/components/Sidebar.tsx` | **Modify** | Replace footer with `<SyncFooter />` |
| `dashboard/app/layout.tsx` | **Modify** | Wrap children with `<SyncProvider>` |
| `dashboard/app/page.tsx` | **Modify** | Delegate rendering to `DashboardHome` client component |
| `dashboard/app/globals.css` | **Modify** | Add spinner animation |
| `dashboard/public/background_video.mp4` | **Create** | Copy from `assets/` for Next.js serving |

---

## Implementation Steps

### Step 1: Pipeline changes (`run_pipeline.py`)
- Add `--sync` flag: runs collect → process → moments (no tensions, no briefing)
- Add `--sync-state` flag: writes `data/sync_state.json` at each stage transition
- Add `--force` flag: forces tension evaluation regardless of weekly cadence
- Atomic state file writes (write to `.tmp` then rename)

### Step 2: API routes
- `POST /api/sync` — Spawns detached Python process, writes initial state, returns immediately
- `POST /api/sync?briefing=true` — Runs briefing only
- `GET /api/sync` — Reads `sync_state.json`, returns current status
- `GET /api/sync/briefing-status` — Checks if today's briefing exists in Notion
- Local detection: `!process.env.VERCEL` (Vercel injects `VERCEL=1` on deployed builds)
- Returns 403 on Vercel, 409 if sync already running

### Step 3: SyncProvider context
- Polls `/api/sync` every 2s during active sync
- Tracks elapsed time, current stage, freshness (green ≤2h / yellow >2h / gray never)
- Exposes `startSync()`, `startBriefing()`, `isRunning`, `briefingExists`
- Calls `router.refresh()` on sync completion to revalidate server data

### Step 4: Sidebar sync controls (`SyncFooter`)
- **Sync button**: Green border, shows spinner + stage label + elapsed time while running
- **Briefing button**: Secondary, disabled if today's briefing exists
- **Status line**: Colored dot + "Synced 2:34pm" / "Never synced"
- **Theme toggle + date**: Moved below sync controls
- Disabled with tooltip on Vercel ("Run locally")

### Step 5: Home page blank state
- Copy video to `dashboard/public/background_video.mp4`
- If no trends exist: show `BlankState` (centered Sync button)
- On click: show `SyncVideoOverlay` (full-screen looping video with progress overlay)
- On sync complete: `router.refresh()` → server re-fetches → 5-column grid appears

---

## Key Design Decisions

1. **Detached process + polling** (not SSE): Pipeline takes 5-10 min. Spawning detached and polling state file is simpler and survives page refreshes.
2. **Blank-state = no data in Notion** (not sync state file): If user ran CLI before dashboard, data exists → skip blank state.
3. **`--sync` is a new flag** separate from existing flags: Avoids breaking CLI behavior.
4. **Video only on first sync**: Subsequent syncs show progress in sidebar only.
5. **Sync disabled on Vercel**: API returns 403, buttons show "Run locally" tooltip.
