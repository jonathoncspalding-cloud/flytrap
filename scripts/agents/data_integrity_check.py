"""
data_integrity_check.py (Sentinel)
------------------------------------
Daily data integrity check. Scans for orphan records, stale trends,
duplicate entries, and cross-database consistency issues.

Run: python3 scripts/agents/data_integrity_check.py
Schedule: Daily via GitHub Actions
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

EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")
TRENDS_DB = os.getenv("NOTION_TRENDS_DB")
TENSIONS_DB = os.getenv("NOTION_TENSIONS_DB")
MOMENTS_DB = os.getenv("NOTION_MOMENTS_DB")


def get_relation_ids(page: dict, prop_name: str) -> list[str]:
    """Extract relation IDs from a page property."""
    prop = page.get("properties", {}).get(prop_name, {})
    if prop.get("type") == "relation":
        return [r["id"] for r in prop.get("relation", [])]
    return []


def get_date(page: dict, prop_name: str) -> str | None:
    """Extract a date string from a page property."""
    prop = page.get("properties", {}).get(prop_name, {})
    if prop.get("type") == "date" and prop.get("date"):
        return prop["date"].get("start")
    return None


def main():
    print("=== Sentinel: Data Integrity Check ===")

    issues = []
    stats = {}

    # --- Check 1: Stale trends (no updates in 30+ days) ---
    if TRENDS_DB:
        print("  Checking trends...")
        trends = query_database(TRENDS_DB)
        stats["trends_total"] = len(trends)

        stale = []
        today = datetime.now(timezone.utc).date()

        for t in trends:
            title = get_page_title(t)
            # Trends DB: "Last Updated" or "First Detected" (both date type)
            last_updated = get_date(t, "Last Updated") or get_date(t, "First Detected")
            if last_updated:
                try:
                    last_dt = datetime.fromisoformat(last_updated).date()
                    if (today - last_dt).days > 30:
                        stale.append(f"{title} (last: {last_updated})")
                except ValueError:
                    pass

        if stale:
            issues.append(f"{len(stale)} stale trends (no update >30 days)")
            stats["trends_stale"] = len(stale)

    # --- Check 2: Duplicate trend names ---
    if TRENDS_DB:
        names = [get_page_title(t) for t in trends]
        name_counts = Counter(n.lower().strip() for n in names if n)
        duplicates = {name: count for name, count in name_counts.items() if count > 1}
        if duplicates:
            issues.append(f"{len(duplicates)} duplicate trend names")
            stats["trends_duplicates"] = len(duplicates)

    # --- Check 3: Tensions health ---
    if TENSIONS_DB:
        print("  Checking tensions...")
        tensions = query_database(TENSIONS_DB)
        stats["tensions_total"] = len(tensions)

        dormant = 0
        for t in tensions:
            status_prop = t.get("properties", {}).get("Status", {})
            status = status_prop.get("select", {}).get("name", "") if status_prop.get("select") else ""
            if status == "Dormant":
                dormant += 1

        if dormant:
            stats["tensions_dormant"] = dormant

    # --- Check 4: Moments with expired windows ---
    if MOMENTS_DB:
        print("  Checking moments...")
        moments = query_database(MOMENTS_DB)
        stats["moments_total"] = len(moments)

        expired_predicted = 0
        for m in moments:
            status_prop = m.get("properties", {}).get("Status", {})
            status = status_prop.get("select", {}).get("name", "") if status_prop.get("select") else ""
            window_end = get_date(m, "Predicted Window End")

            if status == "Predicted" and window_end:
                try:
                    end_dt = datetime.fromisoformat(window_end).date()
                    if end_dt < today:
                        expired_predicted += 1
                except ValueError:
                    pass

        if expired_predicted:
            issues.append(f"{expired_predicted} moments still 'Predicted' past their window end")
            stats["moments_expired"] = expired_predicted

    # --- Check 5: Evidence count ---
    if EVIDENCE_DB:
        print("  Checking evidence (count only)...")
        # Just get a count — don't fetch all evidence (could be thousands)
        recent = query_database(EVIDENCE_DB, {
            "property": "Date Captured",
            "date": {"on_or_after": (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")},
        })
        stats["evidence_last_24h"] = len(recent)
        if len(recent) == 0:
            issues.append("No new evidence in last 24 hours — pipeline may be failing")

    # Build report
    lines = [f"Data Integrity Check — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"]
    lines.append("")
    lines.append("DATABASE STATS:")
    for key, val in sorted(stats.items()):
        lines.append(f"  {key}: {val}")

    lines.append("")
    if issues:
        lines.append(f"ISSUES FOUND: {len(issues)}")
        for issue in issues:
            lines.append(f"  ! {issue}")
    else:
        lines.append("No issues found. All databases healthy.")

    report = "\n".join(lines)
    print(report)

    # Write to Agent Activity Log
    from agent_report_writer import write_report

    priority = "critical" if any("pipeline may be failing" in i for i in issues) else \
               "high" if len(issues) >= 3 else \
               "medium" if issues else "low"

    summary = f"{len(issues)} issue(s). " if issues else "Clean. "
    summary += f"Trends: {stats.get('trends_total', '?')}, "
    summary += f"Evidence (24h): {stats.get('evidence_last_24h', '?')}, "
    summary += f"Moments: {stats.get('moments_total', '?')}"

    write_report(
        agent="sentinel",
        report_type="integrity",
        title=f"Data Integrity — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        summary=summary,
        details=report,
        priority=priority,
    )

    # Update shared agent state
    from agent_state import update_agent
    findings_list = issues if issues else ["No issues found. All databases healthy."]
    update_agent(
        agent="sentinel",
        status="warning" if issues else "healthy",
        findings=findings_list,
    )

    # === Team Standup Digest ===
    from agent_state import read_state, update_digest

    state = read_state()
    digest_lines = [f"Team Standup — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"]
    digest_lines.append("")

    # Pipeline health
    p = state.get("pipeline", {})
    p_status = "HEALTHY" if p.get("streak", 0) > 0 else "UNKNOWN" if p.get("last_success") is None else "FAILING"
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
        a_status = info.get("status", "idle")
        last_run = info.get("last_run", "never")
        a_findings = info.get("findings", [])
        icon = {"healthy": "+", "warning": "!", "error": "X", "idle": "?"}.get(a_status, "?")
        digest_lines.append(f"  [{icon}] {agent_name}: {a_status} (last: {last_run})")
        for finding in a_findings[:2]:
            digest_lines.append(f"      {finding}")
        if a_status == "idle" or last_run == "never" or last_run is None:
            action_items.append(f"{agent_name} has never run — check workflow")
        if a_status in ("warning", "error"):
            for finding in a_findings[:1]:
                action_items.append(f"{agent_name}: {finding}")
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

    # Write digest to Notion as a separate report entry
    write_report(
        agent="sentinel",
        report_type="synthesis",
        title=f"Team Standup — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        summary=f"{len(action_items)} action item(s). Pipeline: {p_status}.",
        details=digest_text[:2000],
        priority="high" if action_items else "low",
    )

    # Update shared state digest section
    update_digest(
        summary=f"Pipeline: {p_status}. {len(action_items)} action items.",
        action_items=action_items,
    )

    return {"issues": issues, "stats": stats}


if __name__ == "__main__":
    main()
