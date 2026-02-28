"""
create_moments_db.py
--------------------
Creates the Cultural Moments database in Notion.
Safe to re-run — skips if already exists.

Run: python3 scripts/setup/create_moments_db.py
After running, add NOTION_MOMENTS_DB=<id> to .env and dashboard/.env.local
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import create_database, query_database

PARENT_PAGE_ID = os.getenv("NOTION_PARENT_PAGE_ID", "3126ff05-e5b1-80b6-b865-e230af5ac9d5")
TRENDS_DB = os.getenv("NOTION_TRENDS_DB")
TENSIONS_DB = os.getenv("NOTION_TENSIONS_DB")
CALENDAR_DB = os.getenv("NOTION_CALENDAR_DB")


def main():
    print("Creating Cultural Moments database...")

    # Check if it already exists by looking at parent page children
    import requests
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
                if title == "Cultural Moments":
                    db_id = block["id"]
                    print(f"  Already exists: {db_id}")
                    print(f"\nAdd to .env and dashboard/.env.local:")
                    print(f"  NOTION_MOMENTS_DB={db_id}")
                    return db_id

    db_id = create_database(
        PARENT_PAGE_ID,
        "Cultural Moments",
        {
            "Name": {"title": {}},
            "Narrative": {"rich_text": {}},
            "Type": {
                "select": {
                    "options": [
                        {"name": "Catalyst", "color": "red"},
                        {"name": "Collision", "color": "orange"},
                        {"name": "Pressure", "color": "yellow"},
                        {"name": "Pattern", "color": "blue"},
                        {"name": "Void", "color": "purple"},
                    ]
                }
            },
            "Horizon": {
                "select": {
                    "options": [
                        {"name": "This Week", "color": "red"},
                        {"name": "2-4 Weeks", "color": "orange"},
                        {"name": "1-3 Months", "color": "blue"},
                    ]
                }
            },
            "Status": {
                "select": {
                    "options": [
                        {"name": "Predicted", "color": "blue"},
                        {"name": "Forming", "color": "orange"},
                        {"name": "Happening", "color": "red"},
                        {"name": "Passed", "color": "green"},
                        {"name": "Missed", "color": "gray"},
                    ]
                }
            },
            "Confidence": {"number": {"format": "number"}},
            "Magnitude": {"number": {"format": "number"}},
            "Watch For": {"rich_text": {}},
            "Reasoning": {"rich_text": {}},
            "Predicted Window Start": {"date": {}},
            "Predicted Window End": {"date": {}},
            "Created Date": {"date": {}},
            "Last Updated": {"date": {}},
            "Outcome Notes": {"rich_text": {}},
            "Linked Trends": {
                "relation": {
                    "database_id": TRENDS_DB,
                    "single_property": {},
                }
            },
            "Linked Tensions": {
                "relation": {
                    "database_id": TENSIONS_DB,
                    "single_property": {},
                }
            },
            "Linked Calendar Events": {
                "relation": {
                    "database_id": CALENDAR_DB,
                    "single_property": {},
                }
            },
        },
    )

    print(f"\n  + Created Cultural Moments database: {db_id}")
    print(f"\nAdd to .env and dashboard/.env.local:")
    print(f"  NOTION_MOMENTS_DB={db_id}")
    return db_id


if __name__ == "__main__":
    main()
