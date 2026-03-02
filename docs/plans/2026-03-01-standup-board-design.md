# The Standup Board — Agent Autonomy & Coordination Design

**Date:** 2026-03-01
**Status:** Approved
**Goal:** Make agents function as a semi-autonomous team that performs their tasks, coordinates through shared state, and reports to you via the dashboard.

## Problem Statement

The agent infrastructure exists but has four compounding failures:
1. Agent autonomy runs complete without producing changes or PRs
2. Reports go to a Notion DB with no visibility to the user
3. Agents work in silos with no cross-agent awareness
4. Pipeline reliability issues undermine the data foundation agents depend on

## Design Overview

Six interconnected changes that transform isolated cron jobs into a coordinated team:

1. Fix agent autonomy plumbing (PRs actually get created)
2. Shared agent state file for cross-agent awareness
3. Sentinel daily digest (team standup summary)
4. Dashboard upgrades (pipeline health, agent status, standup digest)
5. Optimize cost tracking (Actions + Anthropic + Notion spend)
6. Cross-agent context in autonomy prompts

## 1. Fix Agent Autonomy

**Problem:** `claude-code-action` runs complete in 2-3 min without creating PRs. Architect fails silently on TypeScript checks.

**Changes to `.github/workflows/claude-agents-auto.yml`:**
- Add a post-step to each job that logs whether a PR was created
- Upload Claude execution output as a GitHub Actions artifact on failure
- After each agent's claude-code-action step, run a step that updates `data/agent_state.json` and commits it back to `main`
- Ensure environment setup (npm ci, pip install) happens correctly before Claude runs

## 2. Shared Agent State (`data/agent_state.json`)

A JSON file committed to the repo. Every agent reads it before starting, writes to it after finishing.

```json
{
  "last_updated": "2026-03-01T15:00:00Z",
  "pipeline": {
    "last_success": "2026-03-01T12:22:53Z",
    "last_failure": null,
    "signals_24h": 535,
    "streak": 4
  },
  "agents": {
    "sentinel": {
      "last_run": "2026-03-01T13:36:25Z",
      "status": "healthy",
      "findings": ["No issues found"],
      "next_scheduled": "2026-03-02T13:00:00Z"
    },
    "scout": {
      "last_run": "2026-02-26T15:00:00Z",
      "status": "warning",
      "findings": ["Google Trends: 0 signals", "YouTube: skipped"],
      "next_scheduled": "2026-03-05T15:00:00Z"
    }
  }
}
```

**New file:** `scripts/agents/agent_state.py` — helper for reading/writing/committing state.

**Integration points:**
- `scripts/run_pipeline.py` — updates `pipeline` section after each run
- Each agent report script — updates its own entry in `agents`
- Agent autonomy workflow — commits state changes back to `main`

## 3. Sentinel Daily Digest

Upgrade `scripts/agents/data_integrity_check.py` to produce a team standup after its own checks:

1. Read `data/agent_state.json` for all agent statuses
2. Read pipeline health
3. Produce a structured digest:
   - Pipeline health (last run, signal counts, streak)
   - Per-agent: last run, status, key findings, blockers
   - Action items needing human attention (high/critical)
4. Write digest to Agent Activity DB
5. Update agent_state.json with digest summary

## 4. Dashboard Upgrades

**Layout constraint:** All new elements go BELOW the existing office visualizer and chat window.

### New API route: `dashboard/app/api/agent-status/route.ts`
- Fetches latest Sentinel digest from Agent Activity DB
- Fetches recent agent activity entries
- Fetches pipeline status from agent_state.json (via GitHub raw content or Notion)
- Returns structured JSON

### Agents page upgrades (`dashboard/app/agents/page.tsx`):
Below CommandCenter, add:

1. **Pipeline Health Bar** — success streak, last run time, signals/24h, status indicator
2. **Agent Status Grid** — per-agent cards showing: last run, status badge (healthy/warning/error/idle), latest finding, next scheduled run
3. **Team Standup Digest** — Sentinel's latest digest rendered as readable summary
4. **"Run Agent" button** per card — triggers `workflow_dispatch` via GitHub API
5. Existing activity feed remains at the bottom, with richer data

### New API route: `dashboard/app/api/agent-trigger/route.ts`
- Accepts POST with agent name
- Triggers workflow_dispatch on claude-agents-auto.yml via GitHub API
- Returns run URL

## 5. Optimize Cost Tracking

Upgrade `scripts/agents/operations_report.py`:
- Query GitHub Actions API for workflow run minutes this billing period
- Calculate estimated Anthropic API spend from pipeline log token counts
- Track Notion API call volume
- Produce cost report:
  - Actions minutes: used this period
  - Anthropic API: estimated tokens + cost
  - Notion API: calls this period
  - Month-over-month trend
- Write to Agent Activity DB
- Show in dashboard agent status widget

## 6. Cross-Agent Context in Prompts

Add to each agent's prompt in `claude-agents-auto.yml`:
```
Before starting, read data/agent_state.json to understand current system state,
what other agents have reported, and any issues affecting your domain.
```

Minimal change (2-3 lines per prompt) with high coordination value.

## Files Changed

| File | Change |
|---|---|
| `data/agent_state.json` | NEW — shared agent state |
| `scripts/agents/agent_state.py` | NEW — state read/write/commit helper |
| `scripts/agents/data_integrity_check.py` | Add team standup digest |
| `scripts/agents/operations_report.py` | Add cost tracking |
| `scripts/run_pipeline.py` | Write pipeline status to agent_state.json |
| `.github/workflows/claude-agents-auto.yml` | Fix plumbing + state updates + context in prompts |
| `.github/workflows/agents.yml` | Add state updates after each report |
| `dashboard/app/api/agent-status/route.ts` | NEW — agent status API |
| `dashboard/app/api/agent-trigger/route.ts` | NEW — trigger agent runs from dashboard |
| `dashboard/app/agents/page.tsx` | Add pipeline health, status grid, digest, run buttons |
| `dashboard/lib/notion.ts` | May need new query for agent digest |

## Implementation Order

1. Create `agent_state.py` + seed `agent_state.json`
2. Wire state updates into existing report scripts
3. Wire state updates into `run_pipeline.py`
4. Upgrade Sentinel digest
5. Upgrade Optimize cost tracking
6. Fix `claude-agents-auto.yml` plumbing + add state context
7. Update `agents.yml` with state commits
8. Build `agent-status` API route
9. Build `agent-trigger` API route
10. Upgrade agents page with new widgets
