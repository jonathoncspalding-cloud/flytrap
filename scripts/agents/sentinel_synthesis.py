"""
sentinel_synthesis.py (Sentinel)
----------------------------------
Weekly "State of the System" synthesis. Reads all Agent Activity entries
from the past week and produces an executive summary.

Run: python3 scripts/agents/sentinel_synthesis.py
Schedule: Weekly via GitHub Actions
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import query_database, get_page_title

AGENT_ACTIVITY_DB = os.getenv("NOTION_AGENT_ACTIVITY_DB")
MOMENTS_DB = os.getenv("NOTION_MOMENTS_DB")
TRENDS_DB = os.getenv("NOTION_TRENDS_DB")
EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")


def get_prop_select(page: dict, name: str) -> str:
    """Extract select property."""
    prop = page.get("properties", {}).get(name, {})
    if prop.get("type") == "select" and prop.get("select"):
        return prop["select"]["name"]
    return "Unknown"


def get_rich_text(page: dict, name: str) -> str:
    """Extract rich_text as plain text."""
    prop = page.get("properties", {}).get(name, {})
    if prop.get("type") == "rich_text":
        return "".join(t.get("plain_text", "") for t in prop.get("rich_text", []))
    return ""


def main():
    print("=== Sentinel: Weekly Synthesis ===")

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Fetch agent activity from last week
    activities = []
    if AGENT_ACTIVITY_DB:
        activities = query_database(AGENT_ACTIVITY_DB, {
            "property": "Date",
            "date": {"on_or_after": cutoff},
        })
    print(f"  Agent activities this week: {len(activities)}")

    # Categorize by agent
    by_agent = {}
    priority_counts = Counter()
    for a in activities:
        agent = get_prop_select(a, "Agent")
        by_agent.setdefault(agent, []).append({
            "title": get_page_title(a),
            "type": get_prop_select(a, "Type"),
            "priority": get_prop_select(a, "Priority"),
            "summary": get_rich_text(a, "Summary"),
        })
        priority_counts[get_prop_select(a, "Priority")] += 1

    # Get high-level system stats
    system_stats = {}
    if TRENDS_DB:
        trends = query_database(TRENDS_DB)
        system_stats["total_trends"] = len(trends)

    if MOMENTS_DB:
        moments = query_database(MOMENTS_DB)
        system_stats["total_moments"] = len(moments)
        predicted = sum(1 for m in moments if get_prop_select(m, "Status") == "Predicted")
        system_stats["pending_predictions"] = predicted

    if EVIDENCE_DB:
        recent_evidence = query_database(EVIDENCE_DB, {
            "property": "Date Captured",
            "date": {"on_or_after": cutoff},
        })
        system_stats["signals_this_week"] = len(recent_evidence)

    # Build synthesis
    lines = [f"State of the System — Week of {cutoff} to {today}"]
    lines.append("")

    lines.append("SYSTEM OVERVIEW:")
    for key, val in system_stats.items():
        lines.append(f"  {key.replace('_', ' ').title()}: {val}")
    lines.append("")

    lines.append(f"AGENT ACTIVITY: {len(activities)} entries this week")
    if priority_counts:
        lines.append(f"  By priority: {dict(priority_counts)}")
    lines.append("")

    for agent_name in ["sentinel", "scout", "oracle", "architect", "optimize", "strategist"]:
        entries = by_agent.get(agent_name, [])
        if entries:
            lines.append(f"{agent_name.upper()} ({len(entries)} entries):")
            for e in entries[:5]:  # Cap at 5 per agent
                lines.append(f"  [{e['type']}] {e['title']}")
                if e["summary"]:
                    lines.append(f"    {e['summary'][:150]}")
            if len(entries) > 5:
                lines.append(f"  ... and {len(entries) - 5} more")
            lines.append("")
        else:
            lines.append(f"{agent_name.upper()}: No activity this week")
            lines.append("")

    # Alerts and recommendations
    alerts = []
    if priority_counts.get("critical", 0) > 0:
        alerts.append(f"{priority_counts['critical']} critical-priority items this week")
    if not by_agent.get("scout"):
        alerts.append("Scout had no activity — source health may be unmonitored")
    if not by_agent.get("oracle"):
        alerts.append("Oracle had no activity — prediction accuracy untracked")

    if alerts:
        lines.append("ALERTS:")
        for alert in alerts:
            lines.append(f"  ! {alert}")
    else:
        lines.append("No systemic alerts. System operating normally.")

    report = "\n".join(lines)
    print(report)

    # Write to Agent Activity Log
    from agent_report_writer import write_report

    priority = "high" if alerts else "medium"
    summary = f"Week summary: {len(activities)} agent entries. "
    summary += f"Signals: {system_stats.get('signals_this_week', '?')}. "
    summary += f"Trends: {system_stats.get('total_trends', '?')}. "
    if alerts:
        summary += f"{len(alerts)} alert(s)."
    else:
        summary += "No alerts."

    write_report(
        agent="sentinel",
        report_type="synthesis",
        title=f"State of the System — {today}",
        summary=summary,
        details=report,
        priority=priority,
    )

    # Update shared agent state
    from agent_state import update_agent, update_digest
    update_agent(
        agent="sentinel",
        status="warning" if alerts else "healthy",
        findings=alerts if alerts else ["System operating normally."],
    )
    update_digest(summary=summary, action_items=alerts if alerts else [])

    return {"activities": len(activities), "alerts": alerts, "stats": system_stats}


if __name__ == "__main__":
    main()
