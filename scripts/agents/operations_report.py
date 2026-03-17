"""
operations_report.py (Optimize)
--------------------------------
Weekly operations report. Tracks pipeline runtime, signal volumes, Notion DB sizes,
and error counts.

Run: python3 scripts/agents/operations_report.py
Schedule: Weekly via GitHub Actions
"""
from __future__ import annotations

import os
import sys
import re
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import query_database

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PIPELINE_LOG = PROJECT_ROOT / "pipeline.log"

EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")
TRENDS_DB = os.getenv("NOTION_TRENDS_DB")
TENSIONS_DB = os.getenv("NOTION_TENSIONS_DB")
MOMENTS_DB = os.getenv("NOTION_MOMENTS_DB")
BRIEFING_DB = os.getenv("NOTION_BRIEFING_DB")
CALENDAR_DB = os.getenv("NOTION_CALENDAR_DB")


def count_db_rows(db_id: str | None, name: str) -> int:
    """Count pages in a Notion database."""
    if not db_id:
        return -1
    try:
        pages = query_database(db_id)
        return len(pages)
    except Exception as e:
        print(f"  WARN: Could not count {name}: {e}")
        return -1


def parse_pipeline_log() -> dict:
    """Parse recent pipeline.log entries for runtime and error data."""
    stats = {
        "last_run": None,
        "last_duration_sec": None,
        "error_count_7d": 0,
        "runs_7d": 0,
    }

    if not PIPELINE_LOG.exists():
        return stats

    lines = PIPELINE_LOG.read_text().splitlines()

    # Scan for pipeline start/complete lines
    run_times = []
    errors = 0
    for line in lines:
        if "Pipeline Starting" in line or "Sync complete" in line or "Pipeline complete" in line:
            # Extract timestamp
            match = re.match(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", line)
            if match:
                ts = match.group(1)
                run_times.append(ts)

        if "Pipeline complete in" in line or "Sync complete in" in line:
            match = re.search(r"in (\d+)s", line)
            if match:
                stats["last_duration_sec"] = int(match.group(1))

        if "[ERROR]" in line:
            errors += 1

    if run_times:
        stats["last_run"] = run_times[-1]

    stats["error_count_7d"] = errors
    stats["runs_7d"] = len([t for t in run_times if "Pipeline Starting" in str(t) or True])

    return stats


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
        "estimated_cost": round(total_minutes * 0.008, 2),
    }


def main():
    print("=== Optimize: Operations Report ===")

    # Count database rows
    print("  Counting Notion database rows...")
    db_sizes = {
        "Evidence": count_db_rows(EVIDENCE_DB, "Evidence"),
        "Trends": count_db_rows(TRENDS_DB, "Trends"),
        "Tensions": count_db_rows(TENSIONS_DB, "Tensions"),
        "Moments": count_db_rows(MOMENTS_DB, "Moments"),
        "Briefings": count_db_rows(BRIEFING_DB, "Briefings"),
        "Calendar": count_db_rows(CALENDAR_DB, "Calendar"),
    }

    total_rows = sum(v for v in db_sizes.values() if v > 0)

    # Parse pipeline log
    print("  Parsing pipeline log...")
    log_stats = parse_pipeline_log()

    # Estimate Actions cost
    print("  Estimating GitHub Actions cost...")
    actions_cost = estimate_actions_cost()

    # Build report
    lines = [f"Operations Report — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"]
    lines.append("")

    lines.append("NOTION DATABASE SIZES:")
    for db, count in db_sizes.items():
        status = "OK" if count >= 0 else "ERROR"
        lines.append(f"  {db}: {count if count >= 0 else 'N/A'} rows [{status}]")
    lines.append(f"  Total: {total_rows} rows")
    lines.append("")

    lines.append("PIPELINE HEALTH:")
    lines.append(f"  Last run: {log_stats['last_run'] or 'Unknown'}")
    lines.append(f"  Last duration: {log_stats['last_duration_sec'] or 'Unknown'}s")
    lines.append(f"  Errors in log: {log_stats['error_count_7d']}")
    lines.append("")

    # Growth projection (rough)
    if db_sizes["Evidence"] > 0:
        lines.append("STORAGE PROJECTIONS:")
        # Notion free tier: ~10,000 blocks. Evidence grows fastest.
        daily_estimate = db_sizes["Evidence"] / 30  # rough
        lines.append(f"  Evidence growth: ~{daily_estimate:.0f} rows/day (est.)")
        if daily_estimate > 0:
            rows_to_limit = max(0, 10000 - db_sizes["Evidence"])
            days_to_limit = rows_to_limit / daily_estimate if daily_estimate > 0 else float("inf")
            lines.append(f"  Days until 10k: ~{days_to_limit:.0f}")

    lines.append("COST TRACKING:")
    if actions_cost.get("error"):
        lines.append(f"  Actions: Could not fetch ({actions_cost['error']})")
    else:
        lines.append(f"  Actions minutes (recent runs): {actions_cost['total_minutes']} min")
        lines.append(f"  Estimated Actions cost: ${actions_cost['estimated_cost']}")
        for wf, mins in actions_cost.get("by_workflow", {}).items():
            lines.append(f"    {wf}: {mins} min")
    lines.append("")

    # Alerts
    alerts = []
    if total_rows > 8000:
        alerts.append("Notion storage above 80% — consider archival")
    if log_stats["error_count_7d"] > 10:
        alerts.append(f"{log_stats['error_count_7d']} errors in pipeline log — investigate")
    if log_stats["last_duration_sec"] and log_stats["last_duration_sec"] > 600:
        alerts.append(f"Pipeline took {log_stats['last_duration_sec']}s — exceeds 10min target")

    if alerts:
        lines.append("")
        lines.append("ALERTS:")
        for alert in alerts:
            lines.append(f"  ! {alert}")

    report = "\n".join(lines)
    print(report)

    # Write to Agent Activity Log
    from agent_report_writer import write_report

    priority = "high" if alerts else "low"
    summary = f"Total storage: {total_rows} rows. "
    summary += f"Last run: {log_stats['last_duration_sec'] or '?'}s. "
    if alerts:
        summary += f"{len(alerts)} alert(s)."
    else:
        summary += "No alerts."

    write_report(
        agent="optimize",
        report_type="operations",
        title=f"Operations Report — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        summary=summary,
        details=report,
        priority=priority,
    )

    # Update shared agent state
    from agent_state import update_agent
    findings_list = alerts if alerts else [f"Healthy. {total_rows} total rows."]
    update_agent(
        agent="optimize",
        status="warning" if alerts else "healthy",
        findings=findings_list,
    )

    return {"db_sizes": db_sizes, "log_stats": log_stats, "alerts": alerts}


if __name__ == "__main__":
    main()
