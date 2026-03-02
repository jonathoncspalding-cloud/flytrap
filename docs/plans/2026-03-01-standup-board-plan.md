# The Standup Board — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform isolated agent cron jobs into a coordinated team with shared state, cross-agent awareness, a dashboard activity widget, and cost tracking.

**Architecture:** Shared JSON state file (`data/agent_state.json`) acts as a bulletin board. Each agent reads it before running and writes to it after. Sentinel produces a daily team digest. The dashboard reads agent activity from Notion and displays pipeline health, agent status cards, and a standup digest below the existing office visualizer. Optimize tracks Actions + API costs.

**Tech Stack:** Python 3.11 (agent scripts), Next.js 15 / TypeScript (dashboard), GitHub Actions (automation), Notion API (data store)

---

### Task 1: Create Agent State Helper (`scripts/agents/agent_state.py`)

**Files:**
- Create: `scripts/agents/agent_state.py`
- Create: `data/agent_state.json`

**Step 1: Create the seed state file**

Create `data/agent_state.json`:
```json
{
  "last_updated": null,
  "pipeline": {
    "last_success": null,
    "last_failure": null,
    "signals_24h": 0,
    "last_duration_sec": null,
    "streak": 0
  },
  "agents": {
    "sentinel": { "last_run": null, "status": "idle", "findings": [], "next_scheduled": null },
    "scout": { "last_run": null, "status": "idle", "findings": [], "next_scheduled": null },
    "oracle": { "last_run": null, "status": "idle", "findings": [], "next_scheduled": null },
    "architect": { "last_run": null, "status": "idle", "findings": [], "next_scheduled": null },
    "optimize": { "last_run": null, "status": "idle", "findings": [], "next_scheduled": null },
    "strategist": { "last_run": null, "status": "idle", "findings": [], "next_scheduled": null },
    "isabel": { "last_run": null, "status": "idle", "findings": [], "next_scheduled": null }
  },
  "digest": {
    "last_generated": null,
    "summary": null,
    "action_items": []
  }
}
```

**Step 2: Create the state helper**

Create `scripts/agents/agent_state.py`:
```python
"""
agent_state.py
--------------
Read/write shared agent state (data/agent_state.json).
All agents use this to coordinate — read before running, write after.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

STATE_PATH = Path(__file__).parent.parent.parent / "data" / "agent_state.json"

# Agent schedule (cron descriptions → next occurrence is computed from these)
SCHEDULES = {
    "sentinel": "daily 8AM ET",
    "scout": "weekly Wed 10AM ET",
    "oracle": "bi-monthly 1st/15th 10AM ET",
    "architect": "monthly 1st 11AM ET",
    "optimize": "weekly Fri 10AM ET",
    "strategist": "weekly Thu 10AM ET",
    "isabel": "weekly Mon 10AM ET",
}


def read_state() -> dict:
    """Read the shared agent state. Returns empty structure if file missing."""
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text())
    return {"last_updated": None, "pipeline": {}, "agents": {}, "digest": {}}


def write_state(state: dict) -> None:
    """Atomically write state back to disk."""
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    os.makedirs(STATE_PATH.parent, exist_ok=True)
    tmp = str(STATE_PATH) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, str(STATE_PATH))


def update_agent(
    agent: str,
    status: str,
    findings: list[str],
    next_scheduled: str | None = None,
) -> None:
    """Update a single agent's entry in the shared state."""
    state = read_state()
    state.setdefault("agents", {})
    state["agents"][agent] = {
        "last_run": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "findings": findings[:10],  # cap at 10
        "next_scheduled": next_scheduled,
    }
    write_state(state)


def update_pipeline(
    success: bool,
    signals_24h: int = 0,
    duration_sec: int | None = None,
) -> None:
    """Update pipeline health in the shared state."""
    state = read_state()
    pipeline = state.setdefault("pipeline", {})

    now = datetime.now(timezone.utc).isoformat()
    if success:
        pipeline["last_success"] = now
        pipeline["streak"] = pipeline.get("streak", 0) + 1
    else:
        pipeline["last_failure"] = now
        pipeline["streak"] = 0

    if signals_24h:
        pipeline["signals_24h"] = signals_24h
    if duration_sec is not None:
        pipeline["last_duration_sec"] = duration_sec

    write_state(state)


def update_digest(summary: str, action_items: list[str]) -> None:
    """Update the digest section (written by Sentinel)."""
    state = read_state()
    state["digest"] = {
        "last_generated": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "action_items": action_items[:10],
    }
    write_state(state)


def get_team_context() -> str:
    """Return a readable summary of team state for agent prompts."""
    state = read_state()
    lines = ["=== TEAM STATE ==="]

    # Pipeline
    p = state.get("pipeline", {})
    lines.append(f"Pipeline: last success={p.get('last_success', 'never')}, "
                 f"streak={p.get('streak', 0)}, signals/24h={p.get('signals_24h', 0)}")

    # Agents
    for name, info in state.get("agents", {}).items():
        status = info.get("status", "idle")
        last = info.get("last_run", "never")
        findings = info.get("findings", [])
        summary = findings[0] if findings else "no findings"
        lines.append(f"  {name}: {status} (last: {last}) — {summary}")

    # Digest
    d = state.get("digest", {})
    if d.get("action_items"):
        lines.append(f"\nAction items: {', '.join(d['action_items'])}")

    return "\n".join(lines)
```

**Step 3: Commit**

```bash
git add data/agent_state.json scripts/agents/agent_state.py
git commit -m "feat: add shared agent state file and helper"
```

---

### Task 2: Wire State Updates Into Existing Agent Report Scripts

**Files:**
- Modify: `scripts/agents/data_integrity_check.py:168-176` (after write_report call)
- Modify: `scripts/agents/source_health_check.py:101-108`
- Modify: `scripts/agents/prediction_scorecard.py` (after write_report call)
- Modify: `scripts/agents/operations_report.py:167-175`
- Modify: `scripts/agents/briefing_self_eval.py` (after write_report call)
- Modify: `scripts/agents/sentinel_synthesis.py:153-160`

**Step 1: Add state update to data_integrity_check.py**

After the existing `write_report()` call (around line 175), add:

```python
    # Update shared agent state
    from agent_state import update_agent
    findings_list = issues if issues else ["No issues found. All databases healthy."]
    update_agent(
        agent="sentinel",
        status="warning" if issues else "healthy",
        findings=findings_list,
    )
```

**Step 2: Add state update to source_health_check.py**

After the existing `write_report()` call (around line 108), add:

```python
    # Update shared agent state
    from agent_state import update_agent
    findings_list = []
    if missing:
        findings_list.append(f"Missing sources: {', '.join(missing)}")
    findings_list.append(f"{len(signals)} signals from {len(platform_counts)} platforms (7d)")
    update_agent(
        agent="scout",
        status="warning" if missing else "healthy",
        findings=findings_list,
    )
```

**Step 3: Add state update to operations_report.py**

After the existing `write_report()` call (around line 174), add:

```python
    # Update shared agent state
    from agent_state import update_agent
    findings_list = alerts if alerts else [f"Healthy. {total_rows} total rows."]
    update_agent(
        agent="optimize",
        status="warning" if alerts else "healthy",
        findings=findings_list,
    )
```

**Step 4: Add state update to prediction_scorecard.py**

Read the file first to identify the exact insertion point. After its `write_report()` call, add:

```python
    # Update shared agent state
    from agent_state import update_agent
    update_agent(
        agent="oracle",
        status="warning" if alerts else "healthy",
        findings=alerts if alerts else ["Prediction calibration nominal."],
    )
```

**Step 5: Add state update to briefing_self_eval.py**

After its `write_report()` call, add:

```python
    # Update shared agent state
    from agent_state import update_agent
    update_agent(
        agent="strategist",
        status="warning" if issues else "healthy",
        findings=issues if issues else ["Briefing quality nominal."],
    )
```

**Step 6: Add state update to sentinel_synthesis.py**

After its `write_report()` call (around line 160), add:

```python
    # Update shared agent state — synthesis also updates the digest
    from agent_state import update_agent, update_digest
    update_agent(
        agent="sentinel",
        status="warning" if alerts else "healthy",
        findings=alerts if alerts else ["System operating normally."],
    )
    action_items = alerts if alerts else []
    update_digest(summary=summary, action_items=action_items)
```

**Step 7: Commit**

```bash
git add scripts/agents/data_integrity_check.py scripts/agents/source_health_check.py \
  scripts/agents/operations_report.py scripts/agents/prediction_scorecard.py \
  scripts/agents/briefing_self_eval.py scripts/agents/sentinel_synthesis.py
git commit -m "feat: wire agent state updates into all report scripts"
```

---

### Task 3: Wire Pipeline State Updates Into `run_pipeline.py`

**Files:**
- Modify: `scripts/run_pipeline.py:196-200` (after pipeline completion)

**Step 1: Add state update at end of main()**

At the top of the file (after the existing imports around line 30), add:

```python
# Import agent state helper (optional — only fails if file doesn't exist yet)
try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "agents"))
    from agent_state import update_pipeline
except ImportError:
    update_pipeline = None
```

Then after the `logger.info(f"=== Pipeline complete in {elapsed:.0f}s ===")` line (around line 197), add:

```python
    # Update shared agent state
    if update_pipeline:
        signals = results.get("collection", {}).get("total", 0)
        update_pipeline(success=True, signals_24h=signals, duration_sec=int(elapsed))
```

And in the sync error handler (around line 172), after `update_state("error", ...)`, add:

```python
            if update_pipeline:
                update_pipeline(success=False)
```

**Step 2: Commit**

```bash
git add scripts/run_pipeline.py
git commit -m "feat: pipeline writes health status to shared agent state"
```

---

### Task 4: Upgrade Sentinel Daily Digest

**Files:**
- Modify: `scripts/agents/data_integrity_check.py:46-176`

**Step 1: Add team standup generation**

After the existing report generation and `write_report()` call, but before the `return` statement, add a new section:

```python
    # === Team Standup Digest ===
    from agent_state import read_state, update_digest

    state = read_state()
    digest_lines = [f"Team Standup — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"]
    digest_lines.append("")

    # Pipeline health
    p = state.get("pipeline", {})
    p_status = "HEALTHY" if p.get("streak", 0) > 0 else "FAILING"
    digest_lines.append(f"PIPELINE: {p_status}")
    digest_lines.append(f"  Last success: {p.get('last_success', 'never')}")
    digest_lines.append(f"  Signals (24h): {p.get('signals_24h', 0)}")
    digest_lines.append(f"  Success streak: {p.get('streak', 0)}")
    if p.get("last_failure"):
        digest_lines.append(f"  Last failure: {p['last_failure']}")
    digest_lines.append("")

    # Per-agent status
    digest_lines.append("AGENT STATUS:")
    action_items = []
    for agent_name, info in state.get("agents", {}).items():
        status = info.get("status", "idle")
        last_run = info.get("last_run", "never")
        findings = info.get("findings", [])
        icon = {"healthy": "+", "warning": "!", "error": "X", "idle": "?"}.get(status, "?")
        digest_lines.append(f"  [{icon}] {agent_name}: {status} (last: {last_run})")
        for f in findings[:2]:
            digest_lines.append(f"      {f}")
        # Flag agents that haven't run
        if status == "idle" or last_run == "never":
            action_items.append(f"{agent_name} has never run — check workflow")
        # Flag warning/error agents
        if status in ("warning", "error"):
            for f in findings[:1]:
                action_items.append(f"{agent_name}: {f}")
    digest_lines.append("")

    # Merge with integrity issues
    for issue in issues:
        action_items.append(f"Integrity: {issue}")

    if action_items:
        digest_lines.append(f"ACTION ITEMS ({len(action_items)}):")
        for item in action_items:
            digest_lines.append(f"  > {item}")
    else:
        digest_lines.append("No action items. All systems nominal.")

    digest_text = "\n".join(digest_lines)
    print("\n" + digest_text)

    # Write digest to Notion as a separate report
    write_report(
        agent="sentinel",
        report_type="synthesis",
        title=f"Team Standup — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        summary=f"{len(action_items)} action item(s). Pipeline: {p_status}.",
        details=digest_text[:2000],
        priority="high" if action_items else "low",
    )

    # Update shared state digest
    update_digest(
        summary=f"Pipeline: {p_status}. {len(action_items)} action items.",
        action_items=action_items,
    )
```

**Step 2: Commit**

```bash
git add scripts/agents/data_integrity_check.py
git commit -m "feat: Sentinel daily digest produces team standup summary"
```

---

### Task 5: Add Cost Tracking to Optimize Operations Report

**Files:**
- Modify: `scripts/agents/operations_report.py`

**Step 1: Add GitHub Actions cost tracking**

Add a new function after the existing `parse_pipeline_log()`:

```python
def estimate_actions_cost() -> dict:
    """Estimate GitHub Actions usage from recent workflow runs via API."""
    import requests

    token = os.getenv("GITHUB_PAT") or os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPO", "jonathoncspalding-cloud/flytrap")

    if not token:
        return {"error": "No GITHUB_PAT set", "total_minutes": 0}

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }

    # Get recent workflow runs (last 30 days of runs)
    total_minutes = 0
    workflow_breakdown = {}

    try:
        resp = requests.get(
            f"https://api.github.com/repos/{repo}/actions/runs?per_page=50",
            headers=headers,
        )
        resp.raise_for_status()
        runs = resp.json().get("workflow_runs", [])

        for run in runs:
            name = run.get("name", "Unknown")
            # Get timing from run_started_at and updated_at
            if run.get("run_started_at") and run.get("updated_at"):
                start = datetime.fromisoformat(run["run_started_at"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(run["updated_at"].replace("Z", "+00:00"))
                minutes = (end - start).total_seconds() / 60
                total_minutes += minutes
                workflow_breakdown[name] = workflow_breakdown.get(name, 0) + minutes

    except Exception as e:
        return {"error": str(e), "total_minutes": 0}

    return {
        "total_minutes": round(total_minutes, 1),
        "by_workflow": {k: round(v, 1) for k, v in workflow_breakdown.items()},
        "estimated_cost": round(total_minutes * 0.008, 2),  # $0.008/min for Linux runners
    }
```

**Step 2: Integrate into the main report**

In the `main()` function, after the pipeline log parsing section (around line 108), add:

```python
    # Estimate Actions cost
    print("  Estimating GitHub Actions cost...")
    actions_cost = estimate_actions_cost()
```

And in the report building section, before the Alerts section, add:

```python
    lines.append("COST TRACKING:")
    if actions_cost.get("error"):
        lines.append(f"  Actions: Could not fetch ({actions_cost['error']})")
    else:
        lines.append(f"  Actions minutes (recent runs): {actions_cost['total_minutes']} min")
        lines.append(f"  Estimated Actions cost: ${actions_cost['estimated_cost']}")
        for wf, mins in actions_cost.get("by_workflow", {}).items():
            lines.append(f"    {wf}: {mins} min")
    lines.append("")
```

**Step 3: Add GITHUB_PAT to the agents.yml workflow**

In `.github/workflows/agents.yml`, add `GITHUB_PAT` to the operations-report env vars:

```yaml
          GITHUB_PAT: ${{ secrets.GITHUB_PAT }}
          GITHUB_REPO: jonathoncspalding-cloud/flytrap
```

**Step 4: Commit**

```bash
git add scripts/agents/operations_report.py .github/workflows/agents.yml
git commit -m "feat: Optimize tracks GitHub Actions cost in weekly report"
```

---

### Task 6: Fix Agent Autonomy Workflow & Add Cross-Agent Context

**Files:**
- Modify: `.github/workflows/claude-agents-auto.yml`

**Step 1: Add state context to each agent prompt**

For each of the 6 agent jobs (isabel, scout, oracle, optimize, strategist, architect), prepend this to the prompt:

```
Before starting, read data/agent_state.json to understand:
- Current pipeline health and last run status
- What other agents have found recently
- Any action items from the latest Sentinel digest
Factor this context into your decisions.
```

**Step 2: Add state commit step after each claude-code-action**

After each `anthropics/claude-code-action@v1` step in every job, add a post-step:

```yaml
      - name: Update agent state
        if: always()
        run: |
          python3 -c "
          import sys
          sys.path.insert(0, 'scripts/agents')
          from agent_state import update_agent
          update_agent(
              agent='<agent-name>',
              status='${{ job.status }}' == 'success' and 'healthy' or 'error',
              findings=['Autonomy run: ${{ job.status }}'],
          )
          "
        env:
          PYTHONPATH: scripts

      - name: Commit state changes
        if: always()
        run: |
          git config user.name "flytrap-bot"
          git config user.email "flytrap-bot@users.noreply.github.com"
          git add data/agent_state.json || true
          git diff --cached --quiet || git commit -m "chore: update agent state (${{ github.job }})"
          git push origin main || true
```

Replace `<agent-name>` with the appropriate agent for each job (isabel, scout, oracle, etc.).

**Step 3: Add artifact upload on failure**

For each job, after the claude-code-action step, add:

```yaml
      - name: Upload execution log on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: claude-execution-${{ github.job }}-${{ github.run_id }}
          path: /home/runner/work/_temp/claude-execution-output.json
          retention-days: 7
```

**Step 4: Commit**

```bash
git add .github/workflows/claude-agents-auto.yml
git commit -m "feat: add cross-agent context and state tracking to autonomy workflow"
```

---

### Task 7: Update Agent Tasks Workflow With State Commits

**Files:**
- Modify: `.github/workflows/agents.yml`

**Step 1: Add git commit step to daily-integrity and weekly-reports jobs**

After the last script step in each job, add:

```yaml
      - name: Commit agent state updates
        if: always()
        run: |
          git config user.name "flytrap-bot"
          git config user.email "flytrap-bot@users.noreply.github.com"
          git add data/agent_state.json || true
          git diff --cached --quiet || git commit -m "chore: update agent state (agent-tasks)"
          git push origin main || true
```

**Step 2: Commit**

```bash
git add .github/workflows/agents.yml
git commit -m "feat: agent tasks workflow commits state updates"
```

---

### Task 8: Build Agent Status API Route

**Files:**
- Create: `dashboard/app/api/agent-status/route.ts`

**Step 1: Create the API route**

```typescript
import { NextResponse } from "next/server";
import { getAgentActivity, getLatestAgentReport, type AgentName } from "@/lib/notion";

export const revalidate = 0;

const AGENTS: AgentName[] = [
  "sentinel", "scout", "oracle", "architect", "optimize", "strategist", "isabel"
];

const SCHEDULES: Record<AgentName, string> = {
  sentinel: "Daily 8AM ET",
  scout: "Weekly Wed 10AM ET",
  oracle: "Bi-monthly 1st/15th 10AM ET",
  architect: "Monthly 1st 11AM ET",
  optimize: "Weekly Fri 10AM ET",
  strategist: "Weekly Thu 10AM ET",
  isabel: "Weekly Mon 10AM ET",
};

export async function GET() {
  const [activity, ...latestReports] = await Promise.all([
    getAgentActivity(50),
    ...AGENTS.map((a) => getLatestAgentReport(a)),
  ]);

  // Find the latest Sentinel digest (type === "synthesis")
  const digest = activity.find(
    (a) => a.agent === "sentinel" && a.type === "synthesis"
  );

  // Build per-agent status
  const agentStatuses = AGENTS.map((name, i) => {
    const latest = latestReports[i];
    const isActive = latest?.date === new Date().toISOString().split("T")[0];
    return {
      name,
      schedule: SCHEDULES[name],
      lastRun: latest?.date ?? null,
      status: isActive ? "active" : latest ? "idle" : "never_run",
      latestReport: latest
        ? {
            title: latest.title,
            summary: latest.summary,
            priority: latest.priority,
            type: latest.type,
          }
        : null,
    };
  });

  return NextResponse.json({
    agents: agentStatuses,
    digest: digest
      ? {
          title: digest.title,
          summary: digest.summary,
          details: digest.details,
          date: digest.date,
          priority: digest.priority,
        }
      : null,
    recentActivity: activity.slice(0, 20),
  });
}
```

**Step 2: Commit**

```bash
git add dashboard/app/api/agent-status/route.ts
git commit -m "feat: add agent-status API route"
```

---

### Task 9: Build Agent Trigger API Route

**Files:**
- Create: `dashboard/app/api/agent-trigger/route.ts`

**Step 1: Create the trigger route**

```typescript
import { NextRequest, NextResponse } from "next/server";

const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_REPO = process.env.GITHUB_REPO || "jonathoncspalding-cloud/flytrap";

const VALID_AGENTS = ["isabel", "scout", "oracle", "optimize", "strategist", "architect"];

export async function POST(req: NextRequest) {
  const { agent } = await req.json();

  if (!agent || !VALID_AGENTS.includes(agent)) {
    return NextResponse.json(
      { error: `Invalid agent. Must be one of: ${VALID_AGENTS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!GITHUB_PAT) {
    return NextResponse.json({ error: "GITHUB_PAT not configured" }, { status: 500 });
  }

  // Trigger workflow_dispatch on the agent autonomy workflow
  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/claude-agents-auto.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { agent },
      }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json(
      { error: `GitHub API error: ${resp.status} ${text}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, agent, message: `Triggered ${agent} autonomy run` });
}
```

**Step 2: Commit**

```bash
git add dashboard/app/api/agent-trigger/route.ts
git commit -m "feat: add agent-trigger API route for on-demand agent runs"
```

---

### Task 10: Upgrade Agents Page With Pipeline Health, Status Grid, and Digest

**Files:**
- Modify: `dashboard/app/agents/page.tsx`

This is the largest task. The key constraint: **all new widgets go BELOW the existing `<CommandCenter />` component**.

**Step 1: Add pipeline health bar component**

Add below the existing `AgentCard` function at the bottom of the file:

```typescript
function PipelineHealth({ digest }: { digest: any | null }) {
  if (!digest) {
    return (
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          No pipeline data yet. Waiting for first Sentinel digest.
        </span>
      </div>
    );
  }

  const priorityColor = digest.priority === "high" || digest.priority === "critical"
    ? "#E8127A"
    : "#2a8c4a";

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${priorityColor}30`,
      borderRadius: 10,
      padding: "16px 20px",
      marginBottom: 16,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${priorityColor}, ${priorityColor}33)`,
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: priorityColor,
            display: "inline-block",
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Pipeline Status
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          {digest.date}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
        {digest.summary}
      </p>
    </div>
  );
}
```

**Step 2: Add agent status grid component**

```typescript
function AgentStatusGrid({ agents, latestByAgent }: {
  agents: typeof AGENTS;
  latestByAgent: Map<AgentName, AgentActivity>;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      gap: 12,
      marginBottom: 20,
    }}>
      {agents.map((agent) => {
        const latest = latestByAgent.get(agent.name) ?? null;
        return <AgentStatusCard key={agent.name} agent={agent} latest={latest} />;
      })}
    </div>
  );
}

function AgentStatusCard({ agent, latest }: {
  agent: typeof AGENTS[number];
  latest: AgentActivity | null;
}) {
  const isActive = latest && latest.date === new Date().toISOString().split("T")[0];
  const statusColor = isActive ? "#2a8c4a" : latest ? "#6b7280" : "#E8127A";

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${agent.color}22`,
      borderRadius: 10,
      padding: 14,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${agent.color}, ${agent.color}33)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{agent.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {agent.label}
          </span>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: statusColor,
            display: "inline-block",
          }} />
        </div>
        <TriggerButton agent={agent.name} />
      </div>
      {latest ? (
        <div>
          <p style={{
            fontSize: 11, color: "var(--text-secondary)", margin: "0 0 6px",
            lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          } as React.CSSProperties}>
            {latest.summary}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {latest.type}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
              {timeAgo(latest.date)}
            </span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic", margin: 0 }}>
          No activity yet
        </p>
      )}
    </div>
  );
}
```

**Step 3: Add trigger button (client component)**

Create a new file `dashboard/components/TriggerButton.tsx`:

```typescript
"use client";

import { useState } from "react";

export default function TriggerButton({ agent }: { agent: string }) {
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);

  async function handleTrigger() {
    setLoading(true);
    try {
      const resp = await fetch("/api/agent-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      if (resp.ok) {
        setTriggered(true);
        setTimeout(() => setTriggered(false), 5000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleTrigger}
      disabled={loading || triggered}
      style={{
        fontSize: 9,
        padding: "2px 8px",
        borderRadius: 4,
        border: "1px solid var(--border)",
        background: triggered ? "rgba(42,140,74,0.15)" : "transparent",
        color: triggered ? "#2a8c4a" : "var(--text-tertiary)",
        cursor: loading || triggered ? "default" : "pointer",
        fontWeight: 500,
      }}
    >
      {loading ? "..." : triggered ? "Triggered" : "Run"}
    </button>
  );
}
```

**Step 4: Add digest display component**

```typescript
function StandupDigest({ digest }: { digest: any | null }) {
  if (!digest || !digest.details) return null;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "16px 20px",
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: "#E8127A", flexShrink: 0 }} />
        <span style={{
          fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Latest Team Standup
        </span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          {digest.date}
        </span>
      </div>
      <pre style={{
        fontSize: 11,
        color: "var(--text-secondary)",
        lineHeight: 1.6,
        margin: 0,
        whiteSpace: "pre-wrap",
        fontFamily: "var(--font-mono, monospace)",
      }}>
        {digest.details}
      </pre>
    </div>
  );
}
```

**Step 5: Update the page component to use new widgets**

In the `AgentsPage` component, after the `<CommandCenter ... />` closing tag (around line 101), and BEFORE the "Recent Activity" section, add:

```typescript
      {/* Pipeline Health + Agent Status (below office + chat) */}
      <div style={{ marginTop: 24 }}>
        <PipelineHealth digest={digest} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: "var(--text-tertiary)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Agent Status
          </span>
        </div>
        <AgentStatusGrid agents={AGENTS} latestByAgent={latestByAgent} />

        <StandupDigest digest={digest} />
      </div>
```

And add the `digest` variable to the component body (after `latestByAgent` is built):

```typescript
  // Find latest Sentinel digest
  const digest = activity.find(
    (a) => a.agent === "sentinel" && a.type === "synthesis"
  ) ?? null;
```

Also add the TriggerButton import at the top:

```typescript
import TriggerButton from "@/components/TriggerButton";
```

**Step 6: Commit**

```bash
git add dashboard/app/agents/page.tsx dashboard/components/TriggerButton.tsx
git commit -m "feat: add pipeline health, agent status grid, standup digest, and run buttons to agents page"
```

---

### Task 11: Verify Build & Final Commit

**Files:**
- No new files

**Step 1: Run TypeScript check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: No errors.

**Step 2: Run the build**

```bash
cd dashboard && npm run build
```

Expected: Build succeeds.

**Step 3: Run a local agent state test**

```bash
cd /Users/jonathon/Desktop/Projects/forecaster
python3 -c "
import sys; sys.path.insert(0, 'scripts/agents')
from agent_state import read_state, update_agent, update_pipeline, get_team_context
update_pipeline(success=True, signals_24h=100, duration_sec=300)
update_agent('sentinel', 'healthy', ['Test finding'])
print(get_team_context())
state = read_state()
print(f'State updated: {state[\"last_updated\"]}')
"
```

Expected: Prints team context with sentinel and pipeline data.

**Step 4: Fix any issues, then final commit if needed**

```bash
git add -A && git commit -m "fix: resolve build issues from standup board implementation"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Agent state helper + seed file | `agent_state.py`, `agent_state.json` |
| 2 | Wire state into all 6 report scripts | `data_integrity_check.py`, etc. |
| 3 | Wire state into pipeline runner | `run_pipeline.py` |
| 4 | Upgrade Sentinel daily digest | `data_integrity_check.py` |
| 5 | Add cost tracking to Optimize | `operations_report.py` |
| 6 | Fix autonomy workflow + cross-agent context | `claude-agents-auto.yml` |
| 7 | Add state commits to agent tasks workflow | `agents.yml` |
| 8 | Agent status API route | `api/agent-status/route.ts` |
| 9 | Agent trigger API route | `api/agent-trigger/route.ts` |
| 10 | Dashboard widgets (health, status, digest, buttons) | `agents/page.tsx`, `TriggerButton.tsx` |
| 11 | Verify build + final fixes | — |
