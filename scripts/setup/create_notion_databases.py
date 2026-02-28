"""
create_notion_databases.py
--------------------------
Creates all 5 Cultural Forecaster databases in Notion under the Forecaster parent page.
Safe to re-run — skips databases that already exist (matched by name).
"""

import os
import sys
import json
from notion_client import Client
from dotenv import load_dotenv

load_dotenv(override=True)

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
# Parent page where all databases will live (the "Forecaster" page)
PARENT_PAGE_ID = os.getenv("NOTION_PARENT_PAGE_ID", "3126ff05-e5b1-80b6-b865-e230af5ac9d5")

notion = Client(auth=NOTION_API_KEY)


def get_existing_databases():
    """Return dict of {title: database_id} for all databases already under the parent page."""
    results = notion.blocks.children.list(block_id=PARENT_PAGE_ID)
    existing = {}
    for block in results["results"]:
        if block["type"] == "child_database":
            title = block["child_database"]["title"]
            existing[title] = block["id"]
    return existing


def create_database(title, properties, existing):
    """Create a database if it doesn't already exist. Returns the database ID."""
    if title in existing:
        print(f"  ✓ '{title}' already exists — skipping")
        return existing[title]

    db = notion.databases.create(
        parent={"type": "page_id", "page_id": PARENT_PAGE_ID},
        title=[{"type": "text", "text": {"content": title}}],
        properties=properties,
    )
    db_id = db["id"]
    print(f"  + Created '{title}' ({db_id})")
    return db_id


def main():
    print("Cultural Forecaster — Notion Database Setup")
    print("=" * 50)

    existing = get_existing_databases()

    # ------------------------------------------------------------------ #
    # 1. Cultural Tensions Database
    # Must be created first so other databases can relate to it.
    # ------------------------------------------------------------------ #
    tensions_id = create_database(
        "Cultural Tensions",
        {
            "Name": {"title": {}},
            "Weight": {
                "number": {"format": "number"}
            },
            "Status": {
                "select": {
                    "options": [
                        {"name": "Active", "color": "green"},
                        {"name": "Rising", "color": "orange"},
                        {"name": "Dormant", "color": "gray"},
                        {"name": "New", "color": "blue"},
                    ]
                }
            },
            "Description": {"rich_text": {}},
            "Last Evaluated": {"date": {}},
        },
        existing,
    )

    # ------------------------------------------------------------------ #
    # 2. Trends Database
    # ------------------------------------------------------------------ #
    trends_id = create_database(
        "Trends",
        {
            "Name": {"title": {}},
            "Type": {
                "select": {
                    "options": [
                        {"name": "Macro Trend", "color": "purple"},
                        {"name": "Micro Trend", "color": "blue"},
                        {"name": "Emerging Signal", "color": "yellow"},
                        {"name": "Scheduled Event", "color": "green"},
                        {"name": "Predicted Moment", "color": "red"},
                    ]
                }
            },
            "Status": {
                "select": {
                    "options": [
                        {"name": "Exploding", "color": "red"},
                        {"name": "Rising", "color": "orange"},
                        {"name": "Peaked", "color": "yellow"},
                        {"name": "Stable", "color": "green"},
                        {"name": "Emerging", "color": "blue"},
                        {"name": "Archived", "color": "gray"},
                    ]
                }
            },
            "Cultural Potency Score": {"number": {"format": "number"}},
            "Momentum Score": {"number": {"format": "number"}},
            "Pinned": {"checkbox": {}},
            "Summary": {"rich_text": {}},
            "Forecast": {"rich_text": {}},
            "First Detected": {"date": {}},
            "Last Updated": {"date": {}},
            "Linked Tensions": {
                "relation": {
                    "database_id": tensions_id,
                    "single_property": {},
                }
            },
        },
        existing,
    )

    # ------------------------------------------------------------------ #
    # 3. Evidence Log Database
    # ------------------------------------------------------------------ #
    evidence_id = create_database(
        "Evidence Log",
        {
            "Title": {"title": {}},
            "Source URL": {"url": {}},
            "Source Platform": {
                "select": {
                    "options": [
                        {"name": "Reddit", "color": "orange"},
                        {"name": "TikTok", "color": "pink"},
                        {"name": "Twitter/X", "color": "blue"},
                        {"name": "News", "color": "gray"},
                        {"name": "Blog", "color": "green"},
                        {"name": "Google Trends", "color": "red"},
                        {"name": "Wikipedia", "color": "default"},
                        {"name": "Manual", "color": "purple"},
                        {"name": "RSS", "color": "yellow"},
                        {"name": "Other", "color": "default"},
                    ]
                }
            },
            "Date Captured": {"date": {}},
            "Summary": {"rich_text": {}},
            "Sentiment": {
                "select": {
                    "options": [
                        {"name": "Positive", "color": "green"},
                        {"name": "Negative", "color": "red"},
                        {"name": "Neutral", "color": "gray"},
                        {"name": "Mixed", "color": "yellow"},
                    ]
                }
            },
            "Raw Content": {"rich_text": {}},
            "Linked Trends": {
                "relation": {
                    "database_id": trends_id,
                    "single_property": {},
                }
            },
        },
        existing,
    )

    # ------------------------------------------------------------------ #
    # 4. Cultural Calendar Database
    # ------------------------------------------------------------------ #
    calendar_id = create_database(
        "Cultural Calendar",
        {
            "Event Name": {"title": {}},
            "Date": {"date": {}},
            "Type": {
                "select": {
                    "options": [
                        {"name": "Known Event", "color": "blue"},
                        {"name": "Predicted Moment", "color": "red"},
                    ]
                }
            },
            "Category": {
                "multi_select": {
                    "options": [
                        {"name": "Politics", "color": "red"},
                        {"name": "Entertainment", "color": "pink"},
                        {"name": "Sports", "color": "green"},
                        {"name": "Tech", "color": "blue"},
                        {"name": "Business", "color": "gray"},
                        {"name": "Culture", "color": "purple"},
                        {"name": "Holiday", "color": "yellow"},
                        {"name": "Music", "color": "orange"},
                        {"name": "Film", "color": "default"},
                    ]
                }
            },
            "Cultural Potency Score": {"number": {"format": "number"}},
            "Notes": {"rich_text": {}},
            "Linked Trends": {
                "relation": {
                    "database_id": trends_id,
                    "single_property": {},
                }
            },
            "Linked Tensions": {
                "relation": {
                    "database_id": tensions_id,
                    "single_property": {},
                }
            },
        },
        existing,
    )

    # ------------------------------------------------------------------ #
    # 5. Briefing Archive Database
    # ------------------------------------------------------------------ #
    briefing_id = create_database(
        "Briefing Archive",
        {
            "Date": {"title": {}},
            "Briefing Content": {"rich_text": {}},
            "Flashpoint Count": {"number": {"format": "number"}},
            "Key Highlights": {"rich_text": {}},
        },
        existing,
    )

    # ------------------------------------------------------------------ #
    # Save database IDs to .env-style config for other scripts to use
    # ------------------------------------------------------------------ #
    ids = {
        "NOTION_TRENDS_DB": trends_id,
        "NOTION_TENSIONS_DB": tensions_id,
        "NOTION_EVIDENCE_DB": evidence_id,
        "NOTION_CALENDAR_DB": calendar_id,
        "NOTION_BRIEFING_DB": briefing_id,
    }

    # Write to notion_ids.env (sourced by other scripts)
    ids_file = os.path.join(os.path.dirname(__file__), "../../notion_ids.env")
    ids_file = os.path.normpath(ids_file)
    with open(ids_file, "w") as f:
        for key, val in ids.items():
            f.write(f"{key}={val}\n")

    print("\n" + "=" * 50)
    print("Database IDs saved to notion_ids.env")
    for key, val in ids.items():
        print(f"  {key} = {val}")
    print("\nSetup complete.")
    return ids


if __name__ == "__main__":
    main()
