"""
source_health_check.py (Scout)
-------------------------------
Weekly source health report. Checks each collector's recent signal output,
flags failures, and reports signal-to-noise by source.

Run: python3 scripts/agents/source_health_check.py
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

from notion_helper import query_database

EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")

# Known platforms — should match what collectors produce
EXPECTED_PLATFORMS = ["Reddit", "RSS", "Wikipedia", "Google Trends", "Hacker News", "Bluesky", "YouTube"]


def get_platform(page: dict) -> str:
    """Extract Source Platform from an Evidence page."""
    prop = page.get("properties", {}).get("Source Platform", {})
    if prop.get("type") == "select" and prop.get("select"):
        return prop["select"]["name"]
    return "Unknown"


def main():
    print("=== Scout: Source Health Check ===")

    if not EVIDENCE_DB:
        print("  ERROR: NOTION_EVIDENCE_DB not set")
        return

    # Fetch evidence from last 7 days
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    signals = query_database(EVIDENCE_DB, {
        "property": "Date Captured",
        "date": {"on_or_after": cutoff},
    })

    print(f"  Signals in last 7 days: {len(signals)}")

    # Group by platform
    platform_counts = Counter()
    for sig in signals:
        platform = get_platform(sig)
        platform_counts[platform] += 1

    # Build report
    lines = [f"Source Health Report — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"]
    lines.append(f"Total signals (7d): {len(signals)}")
    lines.append("")
    lines.append("Platform | Signals")
    lines.append("---------|--------")

    missing = []
    for platform in EXPECTED_PLATFORMS:
        count = platform_counts.get(platform, 0)

        if count == 0:
            missing.append(platform)

        lines.append(f"{platform} | {count}")

    # Flag issues
    if missing:
        lines.append("")
        lines.append(f"ALERT: No signals from: {', '.join(missing)}")
        lines.append("These collectors may be broken or rate-limited.")

    # Check for unknown platforms
    unknown = [p for p in platform_counts if p not in EXPECTED_PLATFORMS and p != "Unknown"]
    if unknown:
        lines.append("")
        lines.append(f"New platforms detected: {', '.join(unknown)}")

    report = "\n".join(lines)
    print(report)

    # Write to Agent Activity Log
    from agent_report_writer import write_report

    priority = "high" if missing else "low"
    summary = f"{len(signals)} signals from {len(platform_counts)} sources. "
    if missing:
        summary += f"MISSING: {', '.join(missing)}."
    else:
        summary += "All collectors healthy."

    write_report(
        agent="scout",
        report_type="health_check",
        title=f"Source Health — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        summary=summary,
        details=report,
        priority=priority,
    )

    return {"total_signals": len(signals), "platforms": dict(platform_counts), "missing": missing}


if __name__ == "__main__":
    main()
