"""
patch_database_schemas.py
--------------------------
Adds all required properties to the already-created Notion databases.
The databases exist but were created without properties (notion-client v3 limitation).
Safe to re-run — Notion PATCH is idempotent for existing properties.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import update_database_properties, get_database_schema

TENSIONS_DB = os.getenv("NOTION_TENSIONS_DB")
TRENDS_DB = os.getenv("NOTION_TRENDS_DB")
EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")
CALENDAR_DB = os.getenv("NOTION_CALENDAR_DB")
BRIEFING_DB = os.getenv("NOTION_BRIEFING_DB")


def patch(label, db_id, properties):
    print(f"\nPatching '{label}'...")
    existing = get_database_schema(db_id)
    # Only send properties that don't already exist
    to_add = {k: v for k, v in properties.items() if k not in existing}
    if not to_add:
        print(f"  ✓ All properties already exist")
        return
    update_database_properties(db_id, to_add)
    print(f"  + Added: {list(to_add.keys())}")


def main():
    print("Cultural Forecaster — Patching Database Schemas")
    print("=" * 52)

    # ── Cultural Tensions ─────────────────────────────────────────────────
    patch("Cultural Tensions", TENSIONS_DB, {
        "Weight": {"number": {"format": "number"}},
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
    })

    # ── Trends ────────────────────────────────────────────────────────────
    patch("Trends", TRENDS_DB, {
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
                "database_id": TENSIONS_DB,
                "single_property": {},
            }
        },
    })

    # ── Evidence Log ──────────────────────────────────────────────────────
    patch("Evidence Log", EVIDENCE_DB, {
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
                "database_id": TRENDS_DB,
                "single_property": {},
            }
        },
    })

    # ── Cultural Calendar ─────────────────────────────────────────────────
    patch("Cultural Calendar", CALENDAR_DB, {
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
    })

    # ── Briefing Archive ──────────────────────────────────────────────────
    patch("Briefing Archive", BRIEFING_DB, {
        "Briefing Content": {"rich_text": {}},
        "Flashpoint Count": {"number": {"format": "number"}},
        "Key Highlights": {"rich_text": {}},
    })

    print("\n" + "=" * 52)
    print("Schema patching complete.")


if __name__ == "__main__":
    main()
