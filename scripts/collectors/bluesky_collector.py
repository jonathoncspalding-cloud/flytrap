"""
bluesky_collector.py
---------------------
Collects trending topics and viral posts from Bluesky (AT Protocol) using
the public API — no authentication required for public content.

Endpoints used:
  - app.bsky.unspecced.getTrendingTopics  (trending hashtags/topics)
  (keyword search removed 2026-03-01 — trending topics pre-filter by engagement)

Bluesky public API: https://public.api.bsky.app
"""

import time
import logging
import requests
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

BSKY_API = "https://public.api.bsky.app/xrpc"

MAX_AGE_HOURS    = 48
MAX_TRENDING_TOPICS = 25  # Bluesky API max limit is 25 (400 error if higher)


def _get_trending_topics() -> list:
    """Fetch trending topics from Bluesky's unspecced trending endpoint."""
    try:
        resp = requests.get(
            f"{BSKY_API}/app.bsky.unspecced.getTrendingTopics",
            params={"limit": MAX_TRENDING_TOPICS},
            timeout=10,
        )
        if resp.status_code != 200:
            logger.debug(f"Trending topics returned {resp.status_code}")
            return []
        data   = resp.json()
        topics = data.get("topics", [])
        return topics
    except Exception as e:
        logger.warning(f"Bluesky trending topics failed: {e}")
        return []


def _extract_post_text(post: dict) -> str:
    """Extract plain text from a Bluesky post record."""
    record = post.get("record", {})
    return record.get("text", "")


def collect() -> list:
    """
    Collect Bluesky signals: trending topics + culturally-relevant posts.
    Returns list of signal dicts.
    """
    logger.info("Collecting Bluesky signals...")
    signals = []
    seen_texts = set()

    # ── Trending topics ──────────────────────────────────────────────────────
    topics = _get_trending_topics()
    for topic in topics[:MAX_TRENDING_TOPICS]:
        # Topic may be a string or an object with 'topic' key
        if isinstance(topic, str):
            topic_name = topic
            topic_link = f"https://bsky.app/search?q={requests.utils.quote(topic)}"
        elif isinstance(topic, dict):
            topic_name = topic.get("topic") or topic.get("name") or str(topic)
            raw_link = topic.get("link", "")
            # API returns relative links like /profile/..., prepend base URL
            if raw_link.startswith("/"):
                topic_link = f"https://bsky.app{raw_link}"
            elif raw_link:
                topic_link = raw_link
            else:
                topic_link = f"https://bsky.app/search?q={requests.utils.quote(topic_name)}"
        else:
            continue

        if not topic_name or topic_name in seen_texts:
            continue
        seen_texts.add(topic_name)

        signals.append({
            "title":           f"Bluesky Trending: {topic_name}",
            "source_platform": "Social",
            "source_url":      topic_link,
            "raw_content":     f"[Bluesky Trending Topic] '{topic_name}' is currently trending on Bluesky.",
            "summary":         f"'{topic_name}' trending on Bluesky",
            "_category":       "Social",
        })

    logger.info(f"Bluesky: {len(signals)} signals (trending topics only)")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} Bluesky signals")
    for s in results[:8]:
        print(f"  {s['title'][:80]}")
