"""
create_agent_activity_db.py
---------------------------
Creates the Agent Activity Log database in Notion.
Tracks all agent work: health checks, scorecards, proposals, reports.
Safe to re-run — skips if already exists.

Run: python3 scripts/setup/create_agent_activity_db.py
After running, add NOTION_AGENT_ACTIVITY_DB=<id> to .env and dashboard/.env.local
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import create_database
import requests

PARENT_PAGE_ID = os.getenv("NOTION_PARENT_PAGE_ID", "3126ff05-e5b1-80b6-b865-e230af5ac9d5")


def main():
    print("Creating Agent Activity Log database...")

    headers = {
        "Authorization": f"Bearer {os.getenv('NOTION_API_KEY')}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }
    resp = requests.get(
        f"https://api.notion.com/v1/blocks/{PARENT_PAGE_ID}/children?page_size=100",
        headers=headers,
    )
    if resp.ok:
        for block in resp.json().get("results", []):
            if block.get("type") == "child_database":
                title = block.get("child_database", {}).get("title", "")
                if title == "Agent Activity Log":
                    db_id = block["id"]
                    print(f"  Already exists: {db_id}")
                    print(f"\nAdd to .env and dashboard/.env.local:")
                    print(f"  NOTION_AGENT_ACTIVITY_DB={db_id}")
                    return db_id

    db_id = create_database(
        PARENT_PAGE_ID,
        "Agent Activity Log",
        {
            "Name": {"title": {}},
            "Agent": {
                "select": {
                    "options": [
                        {"name": "sentinel", "color": "red"},
                        {"name": "scout", "color": "green"},
                        {"name": "oracle", "color": "blue"},
                        {"name": "architect", "color": "pink"},
                        {"name": "optimize", "color": "yellow"},
                        {"name": "strategist", "color": "purple"},
                    ]
                }
            },
            "Type": {
                "select": {
                    "options": [
                        {"name": "health_check", "color": "green"},
                        {"name": "scorecard", "color": "blue"},
                        {"name": "operations", "color": "yellow"},
                        {"name": "integrity", "color": "red"},
                        {"name": "self_eval", "color": "purple"},
                        {"name": "synthesis", "color": "orange"},
                        {"name": "proposal", "color": "pink"},
                        {"name": "task", "color": "gray"},
                    ]
                }
            },
            "Status": {
                "select": {
                    "options": [
                        {"name": "completed", "color": "green"},
                        {"name": "in_progress", "color": "yellow"},
                        {"name": "needs_review", "color": "orange"},
                        {"name": "approved", "color": "blue"},
                        {"name": "rejected", "color": "red"},
                    ]
                }
            },
            "Priority": {
                "select": {
                    "options": [
                        {"name": "low", "color": "gray"},
                        {"name": "medium", "color": "yellow"},
                        {"name": "high", "color": "orange"},
                        {"name": "critical", "color": "red"},
                    ]
                }
            },
            "Summary": {"rich_text": {}},
            "Details": {"rich_text": {}},
            "Date": {"date": {}},
        },
    )

    print(f"\n  + Created Agent Activity Log database: {db_id}")
    print(f"\nAdd to .env and dashboard/.env.local:")
    print(f"  NOTION_AGENT_ACTIVITY_DB={db_id}")
    return db_id


if __name__ == "__main__":
    main()
