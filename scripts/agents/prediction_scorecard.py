"""
prediction_scorecard.py (Oracle)
---------------------------------
Weekly prediction accuracy scorecard. Checks moments DB for hit/miss rates,
broken down by type and horizon.

Run: python3 scripts/agents/prediction_scorecard.py
Schedule: Weekly via GitHub Actions
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import query_database

MOMENTS_DB = os.getenv("NOTION_MOMENTS_DB")

# Status categories for scoring
HIT_STATUSES = {"Happening", "Passed"}  # Prediction was correct
MISS_STATUSES = {"Missed"}               # Prediction was wrong
PENDING_STATUSES = {"Predicted", "Forming"}  # Still waiting


def get_prop(page: dict, name: str, prop_type: str = "select") -> str | None:
    """Extract a select property value."""
    prop = page.get("properties", {}).get(name, {})
    if prop.get("type") == prop_type and prop.get(prop_type):
        return prop[prop_type].get("name")
    return None


def get_number(page: dict, name: str) -> float | None:
    """Extract a number property."""
    prop = page.get("properties", {}).get(name, {})
    if prop.get("type") == "number":
        return prop.get("number")
    return None


def main():
    print("=== Oracle: Prediction Scorecard ===")

    if not MOMENTS_DB:
        print("  ERROR: NOTION_MOMENTS_DB not set")
        return

    moments = query_database(MOMENTS_DB)
    print(f"  Total moments: {len(moments)}")

    # Categorize
    by_status = Counter()
    by_type = {}   # {type: {hit: N, miss: N, pending: N}}
    by_horizon = {}
    confidence_buckets = {"0-40": [], "40-60": [], "60-80": [], "80-100": []}

    for m in moments:
        status = get_prop(m, "Status") or "Unknown"
        mtype = get_prop(m, "Type") or "Unknown"
        horizon = get_prop(m, "Horizon") or "Unknown"
        confidence = get_number(m, "Confidence")

        by_status[status] += 1

        # By type
        by_type.setdefault(mtype, {"hit": 0, "miss": 0, "pending": 0})
        if status in HIT_STATUSES:
            by_type[mtype]["hit"] += 1
        elif status in MISS_STATUSES:
            by_type[mtype]["miss"] += 1
        elif status in PENDING_STATUSES:
            by_type[mtype]["pending"] += 1

        # By horizon
        by_horizon.setdefault(horizon, {"hit": 0, "miss": 0, "pending": 0})
        if status in HIT_STATUSES:
            by_horizon[horizon]["hit"] += 1
        elif status in MISS_STATUSES:
            by_horizon[horizon]["miss"] += 1
        elif status in PENDING_STATUSES:
            by_horizon[horizon]["pending"] += 1

        # Confidence calibration
        if confidence is not None and status not in PENDING_STATUSES:
            is_hit = status in HIT_STATUSES
            if confidence < 40:
                confidence_buckets["0-40"].append(is_hit)
            elif confidence < 60:
                confidence_buckets["40-60"].append(is_hit)
            elif confidence < 80:
                confidence_buckets["60-80"].append(is_hit)
            else:
                confidence_buckets["80-100"].append(is_hit)

    # Calculate overall hit rate (excluding pending)
    total_resolved = sum(v for k, v in by_status.items() if k in HIT_STATUSES | MISS_STATUSES)
    total_hits = sum(v for k, v in by_status.items() if k in HIT_STATUSES)
    hit_rate = (total_hits / total_resolved * 100) if total_resolved > 0 else 0

    # Build report
    lines = [f"Prediction Scorecard — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"]
    lines.append(f"Total moments: {len(moments)}")
    lines.append(f"Resolved: {total_resolved} | Hits: {total_hits} | Hit rate: {hit_rate:.0f}%")
    lines.append(f"Pending: {sum(v for k, v in by_status.items() if k in PENDING_STATUSES)}")
    lines.append("")

    lines.append("BY STATUS:")
    for status, count in sorted(by_status.items()):
        lines.append(f"  {status}: {count}")

    lines.append("")
    lines.append("BY TYPE: (hit / miss / pending)")
    for mtype, counts in sorted(by_type.items()):
        total = counts["hit"] + counts["miss"]
        rate = f"{counts['hit']/total*100:.0f}%" if total > 0 else "N/A"
        lines.append(f"  {mtype}: {counts['hit']}/{counts['miss']}/{counts['pending']} ({rate})")

    lines.append("")
    lines.append("BY HORIZON: (hit / miss / pending)")
    for horizon, counts in sorted(by_horizon.items()):
        total = counts["hit"] + counts["miss"]
        rate = f"{counts['hit']/total*100:.0f}%" if total > 0 else "N/A"
        lines.append(f"  {horizon}: {counts['hit']}/{counts['miss']}/{counts['pending']} ({rate})")

    lines.append("")
    lines.append("CONFIDENCE CALIBRATION:")
    for bucket, outcomes in confidence_buckets.items():
        if outcomes:
            actual_rate = sum(outcomes) / len(outcomes) * 100
            lines.append(f"  {bucket}%: {actual_rate:.0f}% actual hit rate (n={len(outcomes)})")
        else:
            lines.append(f"  {bucket}%: no resolved predictions")

    report = "\n".join(lines)
    print(report)

    # Write to Agent Activity Log
    from agent_report_writer import write_report

    priority = "high" if hit_rate < 50 and total_resolved >= 5 else "medium"
    summary = f"Hit rate: {hit_rate:.0f}% ({total_hits}/{total_resolved}). "
    summary += f"{len(moments)} total moments, {len(moments) - total_resolved} pending."

    write_report(
        agent="oracle",
        report_type="scorecard",
        title=f"Prediction Scorecard — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        summary=summary,
        details=report,
        priority=priority,
    )

    return {"hit_rate": hit_rate, "total": len(moments), "resolved": total_resolved}


if __name__ == "__main__":
    main()
