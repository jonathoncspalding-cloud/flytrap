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
        collector_summary = signal.get("summary", "")[:2000]
        sentiment = signal.get("sentiment", "Neutral")

        # Combine raw_content + collector summary into Raw Content.
        # Keep Summary field EMPTY — it's reserved for Claude's analysis
        # and used by signal_processor to detect unprocessed signals.
        if collector_summary and raw:
            combined_raw = f"{raw}\n\n---\n{collector_summary}"[:2000]
        elif collector_summary:
            combined_raw = collector_summary
        else:
            combined_raw = raw

        properties = {
            "Title": {"title": [{"text": {"content": title}}]},
            "Source Platform": {"select": {"name": platform}},
            "Date Captured": {"date": {"start": TODAY}},
            "Raw Content": {"rich_text": [{"text": {"content": combined_raw}}]},
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
    Run all data collectors in parallel, then write their signals to Notion sequentially.
    Returns summary dict with counts per source.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from collectors import (
        reddit_collector,
        rss_collector,
        wikipedia_trending,
        google_trends,
        hn_collector,
        bluesky_collector,
        youtube_collector,
        polymarket_collector,
        trends24_collector,
        tiktok_collector,
    )

    collectors = [
        ("reddit",        reddit_collector.collect),
        ("rss",           rss_collector.collect),
        ("wikipedia",     wikipedia_trending.collect),
        ("google_trends", google_trends.collect),
        ("hacker_news",   hn_collector.collect),
        ("bluesky",       bluesky_collector.collect),
        ("youtube",       youtube_collector.collect),
        ("polymarket",    polymarket_collector.collect),
        ("x_twitter",     trends24_collector.collect),
        ("tiktok",        tiktok_collector.collect),
    ]

    # Label mapping for write_signals log output
    write_labels = {
        "reddit": "Reddit", "rss": "RSS", "wikipedia": "Wikipedia",
        "google_trends": "Google Trends", "hacker_news": "HN",
        "bluesky": "Bluesky", "youtube": "YouTube",
        "polymarket": "Polymarket", "x_twitter": "Trends24",
        "tiktok": "TikTok",
    }

    summary = {}
    raw_results = {}

    # Phase 1: Collect in parallel
    logger.info(f"Running {len(collectors)} collectors in parallel...")
    with ThreadPoolExecutor(max_workers=len(collectors)) as pool:
        futures = {pool.submit(fn): name for name, fn in collectors}
        for future in as_completed(futures):
            name = futures[future]
            try:
                raw_results[name] = future.result()
            except Exception as e:
                logger.warning(f"{name} collector failed: {e}")
                raw_results[name] = []

    # Phase 2: Write to Notion sequentially (respects rate limits)
    for name, signals in raw_results.items():
        label = write_labels.get(name, name)
        count = write_signals(signals, label)
        summary[name] = count

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
