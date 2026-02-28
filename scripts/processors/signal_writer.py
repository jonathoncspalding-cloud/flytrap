"""
signal_writer.py
----------------
Takes raw signals from collectors and writes them to the Notion Evidence Log.
Deduplicates by title to avoid re-inserting signals on repeated runs.
"""

import os
import sys
import time
import logging
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

from notion_helper import query_database, create_page, get_page_title

logger = logging.getLogger(__name__)

EVIDENCE_DB = os.getenv("NOTION_EVIDENCE_DB")
TODAY = date.today().isoformat()


def get_recent_titles(days: int = 3) -> set:
    """
    Return set of signal titles already in Evidence Log from the last N days.
    Used for deduplication on repeated daily runs.
    """
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        pages = query_database(
            EVIDENCE_DB,
            filter_obj={
                "property": "Date Captured",
                "date": {"on_or_after": cutoff},
            },
        )
        return {get_page_title(p) for p in pages}
    except Exception as e:
        logger.warning(f"Could not fetch recent titles for dedup: {e}")
        return set()


def write_signals(signals: list, source_label: str = "") -> int:
    """
    Write a list of signal dicts to the Notion Evidence Log.
    Returns the number of new signals written.

    Each signal dict should have:
        title (str)          — used as page title and for dedup
        source_platform (str)
        source_url (str, optional)
        raw_content (str, optional)
        summary (str, optional)
        sentiment (str, optional) — "Positive" / "Negative" / "Neutral" / "Mixed"
    """
    if not signals:
        return 0

    existing_titles = get_recent_titles(days=3)
    written = 0
    skipped = 0

    for signal in signals:
        title = signal.get("title", "")[:255]  # Notion title limit
        if not title:
            continue

        # Dedup check
        if title in existing_titles:
            skipped += 1
            continue

        platform = signal.get("source_platform", "Other")
        url = signal.get("source_url", None)
        raw = signal.get("raw_content", "")[:2000]
        summary = signal.get("summary", "")[:2000]
        sentiment = signal.get("sentiment", "Neutral")

        properties = {
            "Title": {"title": [{"text": {"content": title}}]},
            "Source Platform": {"select": {"name": platform}},
            "Date Captured": {"date": {"start": TODAY}},
            "Raw Content": {"rich_text": [{"text": {"content": raw}}]},
            "Summary": {"rich_text": [{"text": {"content": summary}}]},
            "Sentiment": {"select": {"name": sentiment}},
        }
        if url:
            properties["Source URL"] = {"url": url}

        try:
            create_page(EVIDENCE_DB, properties)
            existing_titles.add(title)  # Prevent within-batch dupes
            written += 1
            # Rate limit: ~2 writes/sec to stay within Notion's limits
            time.sleep(0.5)
        except Exception as e:
            logger.error(f"Failed to write signal '{title[:50]}': {e}")

    label = f" [{source_label}]" if source_label else ""
    logger.info(f"Signal writer{label}: {written} written, {skipped} skipped (dupes)")
    return written


def run_all_collectors() -> dict:
    """
    Run all data collectors and write their signals to Notion.
    Returns summary dict with counts per source.
    """
    from collectors import (
        reddit_collector,
        rss_collector,
        wikipedia_trending,
        google_trends,
        hn_collector,
        bluesky_collector,
        youtube_collector,
    )

    summary = {}

    # Reddit
    try:
        logger.info("Running Reddit collector...")
        reddit_signals = reddit_collector.collect()
        summary["reddit"] = write_signals(reddit_signals, "Reddit")
    except Exception as e:
        logger.error(f"Reddit collector failed: {e}")
        summary["reddit"] = 0

    # RSS (expanded: news + research + newsletters)
    try:
        logger.info("Running RSS collector...")
        rss_signals = rss_collector.collect()
        summary["rss"] = write_signals(rss_signals, "RSS")
    except Exception as e:
        logger.error(f"RSS collector failed: {e}")
        summary["rss"] = 0

    # Wikipedia
    try:
        logger.info("Running Wikipedia collector...")
        wiki_signals = wikipedia_trending.collect()
        summary["wikipedia"] = write_signals(wiki_signals, "Wikipedia")
    except Exception as e:
        logger.error(f"Wikipedia collector failed: {e}")
        summary["wikipedia"] = 0

    # Google Trends
    try:
        logger.info("Running Google Trends collector...")
        gt_signals = google_trends.collect()
        summary["google_trends"] = write_signals(gt_signals, "Google Trends")
    except Exception as e:
        logger.error(f"Google Trends collector failed: {e}")
        summary["google_trends"] = 0

    # Hacker News (free Algolia API, no auth)
    try:
        logger.info("Running Hacker News collector...")
        hn_signals = hn_collector.collect()
        summary["hacker_news"] = write_signals(hn_signals, "HN")
    except Exception as e:
        logger.error(f"Hacker News collector failed: {e}")
        summary["hacker_news"] = 0

    # Bluesky (public API, no auth)
    try:
        logger.info("Running Bluesky collector...")
        bsky_signals = bluesky_collector.collect()
        summary["bluesky"] = write_signals(bsky_signals, "Bluesky")
    except Exception as e:
        logger.error(f"Bluesky collector failed: {e}")
        summary["bluesky"] = 0

    # YouTube (requires YOUTUBE_API_KEY in .env — gracefully skips if absent)
    try:
        logger.info("Running YouTube collector...")
        yt_signals = youtube_collector.collect()
        summary["youtube"] = write_signals(yt_signals, "YouTube")
    except Exception as e:
        logger.error(f"YouTube collector failed: {e}")
        summary["youtube"] = 0

    total = sum(summary.values())
    logger.info(f"Total signals written: {total} — {summary}")
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    # Add collectors directory to path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../collectors"))

    print("Running all collectors and writing to Notion Evidence Log...")
    summary = run_all_collectors()
    print(f"\nComplete: {summary}")
    print(f"Total: {sum(summary.values())} new signals")
