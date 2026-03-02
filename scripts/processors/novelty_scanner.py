"""
novelty_scanner.py  (Weekly)
----------------------------
Catches genuinely novel cultural phenomena that the embedding pre-filter
(Tier 0) may have incorrectly discarded. Runs weekly.

Queries Notion Evidence DB for signals auto-filtered in the last 7 days,
sends them to Sonnet for a second look. Any flagged as novel get re-processed
through the full signal processor pipeline.

Cost: ~1 Sonnet call/week = ~$0.05-0.10/week.
"""

import os
import sys
import json
import logging
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

import anthropic
from notion_helper import query_database, get_page_title

logger = logging.getLogger(__name__)

EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

NOVELTY_PROMPT = """You are a cultural intelligence analyst. These signals were auto-filtered as low cultural relevance by an embedding similarity model. Most ARE noise. But embedding models miss genuinely novel phenomena that don't resemble existing patterns.

Review each signal. Flag any that represent a genuinely new cultural pattern, behavior shift, or emerging tension NOT captured by existing trends.

SIGNALS:
{signals}

Return ONLY a JSON array:
[{{"idx": 0, "novel": true, "reasoning": "1 sentence explaining why this is culturally significant"}}]

Only include signals where novel=true. If none are novel, return an empty array: []

Be selective. Most of these ARE noise. Flag only signals that:
- Represent a behavior or attitude shift not previously tracked
- Show emergence of a new cultural tension or identity pattern
- Indicate a category of discourse that is genuinely new (not just another instance of an existing trend)"""


def scan_for_novelty() -> dict:
    """
    Scan auto-filtered signals from the last 7 days for genuinely novel
    cultural phenomena the embedding model may have missed.

    Returns:
        {"scanned": int, "novel_found": int, "novel_signals": [str, ...]}
    """
    logger.info("=== Weekly Novelty Scan ===")

    # Query signals that were auto-filtered (have the specific summary text)
    cutoff = (date.today() - timedelta(days=7)).isoformat()
    pages = query_database(
        EVIDENCE_DB,
        filter_obj={
            "and": [
                {"property": "Date Captured", "date": {"on_or_after": cutoff}},
                {"property": "Summary", "rich_text": {"equals": "Low cultural relevance (auto-filtered)"}},
            ]
        },
    )

    if not pages:
        logger.info("No auto-filtered signals in last 7 days. Nothing to scan.")
        return {"scanned": 0, "novel_found": 0, "novel_signals": []}

    # Cap at 100 signals per scan to control cost
    signals = []
    for p in pages[:100]:
        title = get_page_title(p)
        raw_rt = (p["properties"].get("Raw Content") or {}).get("rich_text") or []
        raw = raw_rt[0]["plain_text"] if raw_rt else ""
        signals.append({"id": p["id"], "title": title, "raw": raw})

    logger.info(f"Scanning {len(signals)} auto-filtered signals for novelty...")

    # Build the prompt
    signals_text = "\n".join(
        f"{i}. {s['title'][:100]}: {s['raw'][:200]}"
        for i, s in enumerate(signals)
    )

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2000,
            messages=[{"role": "user", "content": NOVELTY_PROMPT.format(signals=signals_text)}],
        )

        # Token usage logging
        usage = message.usage
        cost = usage.input_tokens * 3 / 1_000_000 + usage.output_tokens * 15 / 1_000_000
        logger.info(
            f"  [TOKENS] novelty_scanner: "
            f"input={usage.input_tokens} output={usage.output_tokens} "
            f"cost=${cost:.4f}"
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        results = json.loads(raw)
        novel_signals = []

        for result in results:
            if result.get("novel"):
                idx = result.get("idx", -1)
                if 0 <= idx < len(signals):
                    sig = signals[idx]
                    novel_signals.append(sig["title"])
                    logger.info(f"  🌱 Novel signal found: '{sig['title'][:80]}' — {result.get('reasoning', '')}")

        if not novel_signals:
            logger.info("  No novel signals detected. Embedding filter working well.")

        return {
            "scanned": len(signals),
            "novel_found": len(novel_signals),
            "novel_signals": novel_signals,
        }

    except Exception as e:
        logger.error(f"Novelty scan failed: {e}")
        return {"scanned": len(signals), "novel_found": 0, "error": str(e)}


def run() -> dict:
    """Main entry point for weekly novelty scanning."""
    return scan_for_novelty()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    result = run()
    print(f"\nResults: {result}")
