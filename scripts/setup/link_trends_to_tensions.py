"""
link_trends_to_tensions.py
--------------------------
One-time script (safe to re-run) that uses Claude to assign Cultural Tensions
to all existing Trends that currently have no Linked Tensions set.

This populates the Tension detail pages immediately, without waiting for the
daily pipeline to link new signals.

Run once after seeding macro/historical trends:
    python3 scripts/setup/link_trends_to_tensions.py
"""

import os
import sys
import json
import time
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

import anthropic
from notion_helper import query_database, update_page, get_page_title

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

TRENDS_DB  = os.getenv("NOTION_TRENDS_DB")
TENSIONS_DB = os.getenv("NOTION_TENSIONS_DB")

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def run(overwrite: bool = False):
    # ── Load tensions ──────────────────────────────────────────────────────────
    tension_pages = query_database(TENSIONS_DB)
    tensions = []
    for p in tension_pages:
        name = get_page_title(p)
        desc_rt = p["properties"].get("Description", {}).get("rich_text", [])
        desc = desc_rt[0]["plain_text"] if desc_rt else ""
        if name:
            tensions.append({"id": p["id"], "name": name, "description": desc})
    tension_map = {t["name"]: t["id"] for t in tensions}
    logger.info(f"Loaded {len(tensions)} tensions")

    # ── Load trends ────────────────────────────────────────────────────────────
    trend_pages = query_database(
        TRENDS_DB,
        filter_obj={"property": "Status", "select": {"does_not_equal": "Archived"}},
    )
    logger.info(f"Loaded {len(trend_pages)} trends")

    tensions_list = "\n".join([
        f"- {t['name']}: {t['description'][:120]}"
        for t in tensions
    ])

    linked = 0
    skipped = 0
    errors = 0

    for p in trend_pages:
        trend_name = get_page_title(p)
        if not trend_name:
            continue

        existing = p["properties"].get("Linked Tensions", {}).get("relation", [])
        if existing and not overwrite:
            logger.info(f"  [skip] {trend_name} — already has {len(existing)} tension(s)")
            skipped += 1
            continue

        # Get trend context
        sum_rt = p["properties"].get("Summary", {}).get("rich_text", [])
        summary = sum_rt[0]["plain_text"] if sum_rt else ""
        type_sel = p["properties"].get("Type", {}).get("select") or {}
        trend_type = type_sel.get("name", "")
        cps = p["properties"].get("Cultural Potency Score", {}).get("number") or 0

        prompt = f"""You are a cultural strategist matching trends to underlying cultural tensions.

TREND: {trend_name}
TYPE: {trend_type}
CPS: {cps}
SUMMARY: {summary}

ACTIVE CULTURAL TENSIONS:
{tensions_list}

Which 2-4 tensions does this trend most directly connect to? Only include tensions with a clear, meaningful relationship — not just superficial overlap.

Respond ONLY with a JSON array of exact tension names from the list above.
Example: ["Authenticity vs. performance", "Cost of living crisis vs. treat yourself"]"""

        try:
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()
            # Strip markdown code fence if present
            if raw.startswith("```"):
                raw = "\n".join(raw.split("\n")[1:])
                if raw.endswith("```"):
                    raw = raw[:-3].strip()

            tension_names = json.loads(raw)
            valid_ids = [{"id": tension_map[n]} for n in tension_names if n in tension_map]

            if valid_ids:
                update_page(p["id"], {"Linked Tensions": {"relation": valid_ids}})
                logger.info(f"  ✓ {trend_name}")
                logger.info(f"    → {[n for n in tension_names if n in tension_map]}")
                linked += 1
            else:
                logger.info(f"  ✗ {trend_name} — no tension names matched the list")
                skipped += 1

            time.sleep(0.5)  # Stay within rate limits

        except json.JSONDecodeError as e:
            logger.error(f"  ✗ {trend_name} — JSON parse error: {e} | raw: {raw[:120]}")
            errors += 1
        except Exception as e:
            logger.error(f"  ✗ {trend_name} — {e}")
            errors += 1

    logger.info(f"\n{'='*50}")
    logger.info(f"Done: {linked} linked · {skipped} skipped · {errors} errors")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Link trends to tensions via Claude")
    parser.add_argument("--overwrite", action="store_true",
                        help="Re-assign tensions even for trends that already have some")
    args = parser.parse_args()
    run(overwrite=args.overwrite)
