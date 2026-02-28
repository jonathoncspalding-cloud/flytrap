"""
create_feedback_db.py
---------------------
Creates the User Feedback database in Notion.
Stores feedback from the dashboard widget, triaged by Architect and routed to agents.
Safe to re-run — skips if already exists.

Run: python3 scripts/setup/create_feedback_db.py
After running, add NOTION_FEEDBACK_DB=<id> to .env and dashboard/.env.local
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
    print("Creating User Feedback database...")

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
                if title == "User Feedback":
                    db_id = block["id"]
                    print(f"  Already exists: {db_id}")
                    print(f"\nAdd to .env and dashboard/.env.local:")
                    print(f"  NOTION_FEEDBACK_DB={db_id}")
                    return db_id

    db_id = create_database(
        PARENT_PAGE_ID,
        "User Feedback",
        {
            "Name": {"title": {}},
            "Page": {
                "select": {
                    "options": [
                        {"name": "Home", "color": "blue"},
                        {"name": "Trends", "color": "green"},
                        {"name": "Tensions", "color": "orange"},
                        {"name": "Calendar", "color": "yellow"},
                        {"name": "Briefings", "color": "purple"},
                        {"name": "Moments", "color": "red"},
                        {"name": "Forecast", "color": "pink"},
                        {"name": "Research", "color": "gray"},
                        {"name": "Agents", "color": "brown"},
                    ]
                }
            },
            "Category": {
                "select": {
                    "options": [
                        {"name": "bug", "color": "red"},
                        {"name": "feature", "color": "blue"},
                        {"name": "data_quality", "color": "orange"},
                        {"name": "design", "color": "pink"},
                        {"name": "prediction", "color": "purple"},
                        {"name": "source", "color": "green"},
                        {"name": "performance", "color": "yellow"},
                        {"name": "other", "color": "gray"},
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
            "Routed To": {
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
            "Status": {
                "select": {
                    "options": [
                        {"name": "new", "color": "blue"},
                        {"name": "triaged", "color": "yellow"},
                        {"name": "in_progress", "color": "orange"},
                        {"name": "resolved", "color": "green"},
                        {"name": "wont_fix", "color": "gray"},
                    ]
                }
            },
            "Submitted": {"date": {}},
            "Response": {"rich_text": {}},
        },
    )

    print(f"\n  + Created User Feedback database: {db_id}")
    print(f"\nAdd to .env and dashboard/.env.local:")
    print(f"  NOTION_FEEDBACK_DB={db_id}")
    return db_id


if __name__ == "__main__":
    main()
