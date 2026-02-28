"""
hn_collector.py
---------------
Collects culturally-relevant stories from Hacker News via the Algolia HN API.
No authentication required. Filters for stories that touch culture, society,
behavior, technology trends, and creative/media topics.

HN Algolia API: https://hn.algolia.com/api
"""

import time
import logging
import requests
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

ALGOLIA_BASE = "https://hn.algolia.com/api/v1"

# Minimum points to include a story
MIN_POINTS = 100

# Minimum comments to consider (signals discussion, not just upvotes)
MIN_COMMENTS = 10

# Tags/keywords that indicate cultural relevance (title filter)
CULTURAL_KEYWORDS = [
    # Society & behavior
    "gen z", "millennial", "culture", "trend", "viral", "tiktok", "social media",
    "remote work", "work from home", "loneliness", "community", "mental health",
    # Tech culture
    "ai art", "openai", "chatgpt", "automation", "creator", "platform",
    "streaming", "subscription", "privacy",
    # Consumer culture
    "brand", "advertising", "marketing", "consumer", "inflation", "cost of living",
    "housing", "rent", "gig economy", "layoff",
    # Media & entertainment
    "movie", "music", "game", "book", "podcast", "newsletter", "substack",
    # Politics & society
    "protest", "movement", "election", "diversity", "inequality",
]

MAX_AGE_HOURS = 48
MAX_RESULTS   = 40


def _is_culturally_relevant(title: str, story_text: str = "") -> bool:
    """Return True if the story title/text has cultural relevance."""
    combined = (title + " " + story_text).lower()
    return any(kw in combined for kw in CULTURAL_KEYWORDS)


def collect(max_age_hours: int = MAX_AGE_HOURS) -> list:
    """
    Collect HN stories from the past N hours.
    Returns list of signal dicts.
    """
    logger.info("Collecting Hacker News signals...")
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    cutoff_ts = int(cutoff.timestamp())

    signals = []

    # Fetch front-page stories (high engagement)
    try:
        url    = f"{ALGOLIA_BASE}/search"
        params = {
            "tags":         "story",
            "numericFilters": f"created_at_i>{cutoff_ts},points>{MIN_POINTS}",
            "hitsPerPage":  MAX_RESULTS,
        }
        resp   = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data   = resp.json()
        hits   = data.get("hits", [])

        for hit in hits:
            title       = hit.get("title", "").strip()
            points      = hit.get("points", 0)
            num_comments = hit.get("num_comments", 0)
            story_url   = hit.get("url", "")
            hn_url      = f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
            story_text  = hit.get("story_text") or ""

            if not title:
                continue
            if num_comments < MIN_COMMENTS:
                continue
            if not _is_culturally_relevant(title, story_text):
                continue

            # Score as proxy for cultural signal strength
            engagement_note = f"{points} points, {num_comments} comments"
            raw_content = (
                f"[Hacker News] {title} — {engagement_note}. "
                f"Link: {story_url or hn_url}"
                + (f" Summary: {story_text[:300]}" if story_text else "")
            )

            signals.append({
                "title":           f"HN: {title}",
                "source_platform": "News",
                "source_url":      story_url or hn_url,
                "raw_content":     raw_content,
                "summary":         f"{title} ({engagement_note})",
                "_category":       "Tech/Culture",
            })

        logger.info(f"Hacker News: {len(signals)} relevant stories from {len(hits)} fetched")
        time.sleep(1)

    except Exception as e:
        logger.warning(f"Hacker News Algolia fetch failed: {e}")

    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} HN signals")
    for s in results[:8]:
        print(f"  {s['title'][:80]}")
