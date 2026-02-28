"""
add_cps_sparkline_property.py
------------------------------
One-time setup script: adds the 'CPS Sparkline' rich_text property to the
existing Trends database.

The signal_processor writes comma-separated CPS history to this field daily
(e.g., "65,72,78,80,85") and the dashboard reads it to render sparkline charts.

Run once:
    python scripts/setup/add_cps_sparkline_property.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import get_database_schema, update_database_properties

TRENDS_DB = os.getenv("NOTION_TRENDS_DB")

def main():
    if not TRENDS_DB:
        print("ERROR: NOTION_TRENDS_DB not set in .env")
        sys.exit(1)

    print(f"Checking Trends database: {TRENDS_DB}")
    schema = get_database_schema(TRENDS_DB)

    if "CPS Sparkline" in schema:
        print("✓ 'CPS Sparkline' property already exists — nothing to do.")
        return

    print("Adding 'CPS Sparkline' rich_text property...")
    update_database_properties(TRENDS_DB, {
        "CPS Sparkline": {"rich_text": {}}
    })
    print("✓ 'CPS Sparkline' property added to Trends database.")
    print()
    print("Next steps:")
    print("  1. Run the signal pipeline: python scripts/run_pipeline.py")
    print("  2. The signal_processor will populate sparkline data each run.")
    print("  3. The dashboard will automatically show sparklines for trends")
    print("     that have 2+ days of data.")


if __name__ == "__main__":
    main()
