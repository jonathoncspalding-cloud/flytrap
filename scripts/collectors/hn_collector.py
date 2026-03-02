"""
hn_collector.py
---------------
Collects culturally-relevant stories from Hacker News using two strategies:

1. Front Page — top stories from HN's official API (no keyword filter needed;
   if it's on the HN front page with high engagement, it's culturally relevant
   to the tech/society space)
2. Keyword Search — Algolia API for stories matching cultural keywords

HN Official API: https://hacker-news.firebaseio.com/v0/
HN Algolia API: https://hn.algolia.com/api
"""

from __future__ import annotations

import time
import logging
import requests
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

ALGOLIA_BASE = "https://hn.algolia.com/api/v1"
HN_OFFICIAL  = "https://hacker-news.firebaseio.com/v0"

# ── Thresholds ────────────────────────────────────────────────────────────────

# Front page stories: lower bar since HN front page is already curated
MIN_POINTS_FRONTPAGE = 50
MIN_COMMENTS_FRONTPAGE = 5

# Keyword search: slightly higher bar to avoid noise from search results
MIN_POINTS_SEARCH = 80
MIN_COMMENTS_SEARCH = 10

# How many front page stories to check (HN front page is 30 items)
FRONTPAGE_LIMIT = 30

# Tags/keywords that indicate cultural relevance (for search strategy)
CULTURAL_KEYWORDS = [
    # Society & behavior
    "gen z", "millennial", "culture", "trend", "viral", "tiktok", "social media",
    "remote work", "work from home", "loneliness", "community", "mental health",
    "burnout", "dating", "marriage", "fertility", "birth rate", "aging",
    # Tech culture & AI
    "ai art", "openai", "chatgpt", "claude", "anthropic", "automation", "creator",
    "platform", "streaming", "subscription", "privacy", "surveillance",
    "deepfake", "misinformation", "algorithm", "recommendation",
    "open source", "enshittification", "techno-optimism",
    # Consumer culture & economy
    "brand", "advertising", "marketing", "consumer", "inflation", "cost of living",
    "housing", "rent", "gig economy", "layoff", "startup", "tech layoff",
    "shrinkflation", "subscription fatigue", "tipping",
    # Media & entertainment
    "movie", "music", "game", "book", "podcast", "newsletter", "substack",
    "streaming war", "hollywood", "box office", "cancel",
    # Politics & society
    "protest", "movement", "election", "diversity", "inequality",
    "censorship", "free speech", "regulation", "antitrust",
    # Health & wellness
    "ozempic", "weight loss", "therapy", "wellness", "psychedelic",
    "screen time", "dopamine", "addiction",
]

MAX_AGE_HOURS = 48
MAX_SEARCH_RESULTS = 40


def _is_culturally_relevant(title: str, story_text: str = "") -> bool:
    """Return True if the story title/text has cultural relevance."""
    combined = (title + " " + story_text).lower()
    return any(kw in combined for kw in CULTURAL_KEYWORDS)


def _fetch_item(item_id: int) -> dict | None:
    """Fetch a single HN item by ID from the official API."""
    try:
        resp = requests.get(f"{HN_OFFICIAL}/item/{item_id}.json", timeout=8)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def _collect_frontpage() -> list:
    """
    Strategy 1: Fetch HN front page stories via the official API.
    No keyword filtering — front page curation IS the filter.
    """
    signals = []
    try:
        resp = requests.get(f"{HN_OFFICIAL}/topstories.json", timeout=10)
        resp.raise_for_status()
        story_ids = resp.json()[:FRONTPAGE_LIMIT]
    except Exception as e:
        logger.warning(f"HN front page fetch failed: {e}")
        return []

    # Fetch items in parallel for speed
    items = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_fetch_item, sid): sid for sid in story_ids}
        for f in as_completed(futures):
            item = f.result()
            if item:
                items.append(item)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)

    for item in items:
        if item.get("type") != "story":
            continue

        title = (item.get("title") or "").strip()
        points = item.get("score", 0)
        num_comments = item.get("descendants", 0) or 0
        story_url = item.get("url", "")
        item_id = item.get("id", "")
        created = item.get("time", 0)

        if not title:
            continue
        if points < MIN_POINTS_FRONTPAGE:
            continue
        if num_comments < MIN_COMMENTS_FRONTPAGE:
            continue

        # Age check
        if created and datetime.fromtimestamp(created, tz=timezone.utc) < cutoff:
            continue

        hn_url = f"https://news.ycombinator.com/item?id={item_id}"
        engagement_note = f"{points} points, {num_comments} comments"

        signals.append({
            "title":           f"HN: {title}",
            "source_platform": "News",
            "source_url":      story_url or hn_url,
            "raw_content":     (
                f"[Hacker News — Front Page] {title} — {engagement_note}. "
                f"Discussion: {hn_url}"
            ),
            "summary":         f"{title} ({engagement_note})",
            "_category":       "Tech/Culture",
        })

    logger.info(f"HN front page: {len(signals)} stories from {len(items)} checked")
    return signals


def _collect_keyword_search() -> list:
    """
    Strategy 2: Search Algolia for stories matching cultural keywords.
    Catches stories that aren't on the front page but are culturally relevant.
    """
    signals = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
    cutoff_ts = int(cutoff.timestamp())

    try:
        resp = requests.get(
            f"{ALGOLIA_BASE}/search",
            params={
                "tags":           "story",
                "numericFilters": f"created_at_i>{cutoff_ts},points>{MIN_POINTS_SEARCH}",
                "hitsPerPage":    MAX_SEARCH_RESULTS,
            },
            timeout=10,
        )
        resp.raise_for_status()
        hits = resp.json().get("hits", [])

        for hit in hits:
            title = hit.get("title", "").strip()
            points = hit.get("points", 0)
            num_comments = hit.get("num_comments", 0)
            story_url = hit.get("url", "")
            hn_url = f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            story_text = hit.get("story_text") or ""

            if not title:
                continue
            if num_comments < MIN_COMMENTS_SEARCH:
                continue
            if not _is_culturally_relevant(title, story_text):
                continue

            engagement_note = f"{points} points, {num_comments} comments"

            signals.append({
                "title":           f"HN: {title}",
                "source_platform": "News",
                "source_url":      story_url or hn_url,
                "raw_content":     (
                    f"[Hacker News] {title} — {engagement_note}. "
                    f"Link: {story_url or hn_url}"
                    + (f" Summary: {story_text[:300]}" if story_text else "")
                ),
                "summary":         f"{title} ({engagement_note})",
                "_category":       "Tech/Culture",
            })

        logger.info(f"HN keyword search: {len(signals)} relevant from {len(hits)} fetched")

    except Exception as e:
        logger.warning(f"HN Algolia search failed: {e}")

    return signals


def collect(max_age_hours: int = MAX_AGE_HOURS) -> list:
    """
    Collect HN stories using both front page + keyword search strategies.
    Deduplicates by title.
    """
    global MAX_AGE_HOURS
    MAX_AGE_HOURS = max_age_hours

    logger.info("Collecting Hacker News signals...")

    # Run both strategies
    frontpage = _collect_frontpage()
    time.sleep(1)
    keyword = _collect_keyword_search()

    # Merge and deduplicate by title
    seen_titles = set()
    merged = []
    for signal in frontpage + keyword:
        key = signal["title"].lower()
        if key not in seen_titles:
            seen_titles.add(key)
            merged.append(signal)

    logger.info(f"Hacker News: {len(merged)} total signals ({len(frontpage)} front page, {len(keyword)} keyword)")
    return merged


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} HN signals")
    for s in results[:15]:
        print(f"  {s['title'][:80]}")
