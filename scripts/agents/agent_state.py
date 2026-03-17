"""Shared agent state helper for Flytrap coordination.

Provides read/write access to data/agent_state.json so agents can see
each other's status, pipeline health, and digest summaries.
"""

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

STATE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "agent_state.json"

EMPTY_STATE = {
    "last_updated": None,
    "pipeline": {
        "last_success": None,
        "last_failure": None,
        "signals_24h": 0,
        "last_duration_sec": None,
        "streak": 0,
    },
    "agents": {
        "sentinel": {"last_run": None, "status": "idle", "findings": [], "next_scheduled": None},
        "scout": {"last_run": None, "status": "idle", "findings": [], "next_scheduled": None},
        "oracle": {"last_run": None, "status": "idle", "findings": [], "next_scheduled": None},
        "architect": {"last_run": None, "status": "idle", "findings": [], "next_scheduled": None},
        "optimize": {"last_run": None, "status": "idle", "findings": [], "next_scheduled": None},
        "strategist": {"last_run": None, "status": "idle", "findings": [], "next_scheduled": None},
        "isabel": {"last_run": None, "status": "idle", "findings": [], "next_scheduled": None},
    },
    "digest": {
        "last_generated": None,
        "summary": None,
        "action_items": [],
    },
}

AGENT_NAMES = list(EMPTY_STATE["agents"].keys())


def _now() -> str:
    """Return current UTC timestamp as ISO string."""
    return datetime.now(timezone.utc).isoformat()


def read_state() -> dict:
    """Read agent state from disk. Returns empty structure if file is missing or corrupt."""
    try:
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return json.loads(json.dumps(EMPTY_STATE))  # deep copy


def write_state(state: dict) -> None:
    """Atomically write state to disk via tmp file + os.replace."""
    state["last_updated"] = _now()
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=STATE_PATH.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(state, f, indent=2)
            f.write("\n")
        os.replace(tmp_path, STATE_PATH)
    except BaseException:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def update_agent(agent: str, status: str, findings: list, next_scheduled: str = None) -> None:
    """Update a single agent's entry in the state file."""
    if agent not in AGENT_NAMES:
        raise ValueError(f"Unknown agent '{agent}'. Valid: {AGENT_NAMES}")
    state = read_state()
    state["agents"][agent] = {
        "last_run": _now(),
        "status": status,
        "findings": findings,
        "next_scheduled": next_scheduled,
    }
    write_state(state)


def update_pipeline(success: bool, signals_24h: int = 0, duration_sec: float = None) -> None:
    """Update pipeline health metrics."""
    state = read_state()
    now = _now()
    pipe = state["pipeline"]
    if success:
        pipe["last_success"] = now
        pipe["streak"] = pipe.get("streak", 0) + 1
    else:
        pipe["last_failure"] = now
        pipe["streak"] = 0
    pipe["signals_24h"] = signals_24h
    pipe["last_duration_sec"] = duration_sec
    write_state(state)


def update_digest(summary: str, action_items: list) -> None:
    """Update the digest section (typically written by Sentinel)."""
    state = read_state()
    state["digest"] = {
        "last_generated": _now(),
        "summary": summary,
        "action_items": action_items,
    }
    write_state(state)


def get_team_context() -> str:
    """Return a human-readable summary of team state for agent prompts."""
    state = read_state()
    lines = []

    # Pipeline
    pipe = state.get("pipeline", {})
    lines.append("## Pipeline Health")
    lines.append(f"  Last success: {pipe.get('last_success', 'never')}")
    lines.append(f"  Last failure: {pipe.get('last_failure', 'none')}")
    lines.append(f"  Signals (24h): {pipe.get('signals_24h', 0)}")
    lines.append(f"  Last duration: {pipe.get('last_duration_sec', 'n/a')}s")
    lines.append(f"  Streak: {pipe.get('streak', 0)} consecutive successes")
    lines.append("")

    # Agents
    lines.append("## Agent Status")
    for name, info in state.get("agents", {}).items():
        status = info.get("status", "unknown")
        last_run = info.get("last_run", "never")
        finding_count = len(info.get("findings", []))
        lines.append(f"  {name}: {status} (last run: {last_run}, findings: {finding_count})")
    lines.append("")

    # Digest
    digest = state.get("digest", {})
    if digest.get("summary"):
        lines.append("## Latest Digest")
        lines.append(f"  {digest['summary']}")
        items = digest.get("action_items", [])
        if items:
            for item in items:
                lines.append(f"  - {item}")
    else:
        lines.append("## Latest Digest")
        lines.append("  No digest generated yet.")

    return "\n".join(lines)
