"""
bluesky_collector.py
---------------------
Collects trending topics and viral posts from Bluesky (AT Protocol) using
the public API — no authentication required for public content.

Endpoints used:
  - app.bsky.unspecced.getTrendingTopics  (trending hashtags/topics)
  - app.bsky.feed.searchPosts             (search cultural keywords)

Bluesky public API: https://public.api.bsky.app
"""

import time
import logging
import requests
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

BSKY_API = "https://public.api.bsky.app/xrpc"

# Cultural search terms to query
CULTURE_QUERIES = [
    "culture",
    "trending",
    "viral",
    "gen z",
    "ad industry",
    "brand",
    "creative brief",
]

MAX_AGE_HOURS    = 48
MIN_LIKE_COUNT   = 50   # Minimum likes for a post to qualify
MAX_POSTS_PER_QUERY = 5
MAX_TRENDING_TOPICS = 20


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


def _search_posts(query: str, limit: int = MAX_POSTS_PER_QUERY) -> list:
    """Search for posts matching a query."""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
        resp   = requests.get(
            f"{BSKY_API}/app.bsky.feed.searchPosts",
            params={"q": query, "limit": limit, "since": cutoff, "sort": "top"},
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        data  = resp.json()
        posts = data.get("posts", [])
        return posts
    except Exception as e:
        logger.warning(f"Bluesky search '{query}' failed: {e}")
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
            topic_link = topic.get("link", f"https://bsky.app/search?q={requests.utils.quote(topic_name)}")
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

    logger.debug(f"Bluesky: {len(signals)} trending topics")
    time.sleep(1)

    # ── Post search for cultural queries ─────────────────────────────────────
    for query in CULTURE_QUERIES:
        posts = _search_posts(query)
        for post in posts:
            text        = _extract_post_text(post)
            like_count  = post.get("likeCount", 0)
            repost_count = post.get("repostCount", 0)
            author      = post.get("author", {})
            handle      = author.get("handle", "unknown")
            uri         = post.get("uri", "")

            if not text or like_count < MIN_LIKE_COUNT:
                continue

            # Deduplicate by text content
            text_key = text[:80].lower().strip()
            if text_key in seen_texts:
                continue
            seen_texts.add(text_key)

            engagement = f"{like_count} likes, {repost_count} reposts"
            bsky_url   = f"https://bsky.app/profile/{handle}" if handle != "unknown" else ""

            signals.append({
                "title":           f"Bluesky: {text[:100]}",
                "source_platform": "Social",
                "source_url":      bsky_url,
                "raw_content":     (
                    f"[Bluesky / @{handle}] {text[:400]} "
                    f"— {engagement}"
                ),
                "summary":         f"@{handle}: {text[:120]} ({engagement})",
                "_category":       "Social",
            })

        time.sleep(0.5)

    logger.info(f"Bluesky: {len(signals)} total signals")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} Bluesky signals")
    for s in results[:8]:
        print(f"  {s['title'][:80]}")
