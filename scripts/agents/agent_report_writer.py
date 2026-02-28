"""
agent_report_writer.py
----------------------
Shared helper for writing agent reports to the Agent Activity Log in Notion.
All agent scripts import this to log their work.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import create_page, rich_text


AGENT_ACTIVITY_DB = os.getenv("NOTION_AGENT_ACTIVITY_DB")


def write_report(
    agent: str,
    report_type: str,
    title: str,
    summary: str,
    details: str = "",
    priority: str = "medium",
    status: str = "completed",
) -> dict | None:
    """Write a report entry to the Agent Activity Log.

    Args:
        agent: sentinel, scout, oracle, architect, optimize, strategist
        report_type: health_check, scorecard, operations, integrity, self_eval, synthesis, proposal, task
        title: Report title (Notion page name)
        summary: Brief summary (< 2000 chars)
        details: Full report content (< 2000 chars — Notion rich_text limit)
        priority: low, medium, high, critical
        status: completed, in_progress, needs_review, approved, rejected
    """
    if not AGENT_ACTIVITY_DB:
        print("  [WARN] NOTION_AGENT_ACTIVITY_DB not set — skipping report write")
        return None

    properties = {
        "Name": {"title": [{"text": {"content": title[:100]}}]},
        "Agent": {"select": {"name": agent}},
        "Type": {"select": {"name": report_type}},
        "Status": {"select": {"name": status}},
        "Priority": {"select": {"name": priority}},
        "Summary": {"rich_text": rich_text(summary)},
        "Details": {"rich_text": rich_text(details)},
        "Date": {"date": {"start": datetime.now(timezone.utc).strftime("%Y-%m-%d")}},
    }

    page = create_page(AGENT_ACTIVITY_DB, properties)
    print(f"  + Logged to Agent Activity: {title}")
    return page
