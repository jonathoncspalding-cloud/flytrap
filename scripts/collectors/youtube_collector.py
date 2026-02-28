"""
youtube_collector.py
---------------------
Collects trending YouTube videos across culture-relevant categories
using the YouTube Data API v3 (free tier: 10,000 units/day).

Requires: YOUTUBE_API_KEY in .env
Get one at: https://console.cloud.google.com → APIs & Services → YouTube Data API v3

Categories collected:
  10 - Music
  22 - People & Blogs (vlogs, creator culture)
  23 - Comedy
  24 - Entertainment
  25 - News & Politics
  26 - Howto & Style (fashion, beauty, lifestyle)

Signals written to Evidence Log as platform = "YouTube"
"""

import os
import sys
import logging
import time
from datetime import datetime, timezone, timedelta

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(override=True)

logger = logging.getLogger(__name__)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_BASE    = "https://www.googleapis.com/youtube/v3"

# YouTube category IDs → human-readable labels
CATEGORIES = {
    "10": "Music",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
}

# Minimum view count to qualify as a signal
MIN_VIEWS = 500_000

# Only capture videos published within the last N days
MAX_AGE_DAYS = 3


def _fetch_trending(category_id: str, max_results: int = 25) -> list:
    """Fetch trending videos for a given category from YouTube Data API."""
    url = f"{YOUTUBE_BASE}/videos"
    params = {
        "part":           "snippet,statistics,contentDetails",
        "chart":          "mostPopular",
        "regionCode":     "US",
        "videoCategoryId": category_id,
        "maxResults":     max_results,
        "key":            YOUTUBE_API_KEY,
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code == 403:
            logger.error("YouTube API: 403 Forbidden — check API key or quota")
            return []
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", [])
    except requests.exceptions.RequestException as e:
        logger.error(f"YouTube API request failed for category {category_id}: {e}")
        return []


def _parse_views(stats: dict) -> int:
    try:
        return int(stats.get("viewCount", 0))
    except (ValueError, TypeError):
        return 0


def _is_recent(published_at: str) -> bool:
    """Returns True if the video was published within MAX_AGE_DAYS."""
    try:
        pub = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
        return pub >= cutoff
    except Exception:
        return True  # Assume recent if unparseable


def collect() -> list:
    """
    Collect trending YouTube videos across culture categories.
    Returns list of signal dicts ready for signal_writer.
    """
    if not YOUTUBE_API_KEY:
        logger.warning("YOUTUBE_API_KEY not set — skipping YouTube collection")
        return []

    signals = []
    seen_titles = set()

    for category_id, category_label in CATEGORIES.items():
        logger.info(f"  Fetching YouTube trending: {category_label}...")
        items = _fetch_trending(category_id)

        for item in items:
            snippet    = item.get("snippet", {})
            stats      = item.get("statistics", {})
            video_id   = item.get("id", "")
            title      = snippet.get("title", "").strip()
            channel    = snippet.get("channelTitle", "Unknown")
            description = snippet.get("description", "")[:300]
            published   = snippet.get("publishedAt", "")
            views       = _parse_views(stats)
            likes       = int(stats.get("likeCount", 0) or 0)
            comments    = int(stats.get("commentCount", 0) or 0)

            if not title or title in seen_titles:
                continue
            if views < MIN_VIEWS:
                continue
            if not _is_recent(published):
                continue

            seen_titles.add(title)

            signal_title = f"YouTube {category_label}: {title[:90]}"
            url          = f"https://www.youtube.com/watch?v={video_id}"

            # Engagement context
            views_str = f"{views:,}"
            likes_str = f"{likes:,}"
            pub_date  = published[:10] if published else "unknown"

            raw_content = (
                f"[YouTube / {category_label}] {title}\n"
                f"Channel: {channel}\n"
                f"Views: {views_str} | Likes: {likes_str} | Comments: {comments:,}\n"
                f"Published: {pub_date}\n"
                f"Description: {description}"
            )

            summary = (
                f'"{title}" by {channel} — '
                f"{views_str} views on YouTube ({category_label})"
            )

            signals.append({
                "title":           signal_title,
                "source_url":      url,
                "source_platform": "YouTube",
                "raw_content":     raw_content,
                "summary":         summary,
                "date_captured":   pub_date,
            })

        # Respect YouTube API quota — short pause between category calls
        time.sleep(1)

    logger.info(f"  YouTube: {len(signals)} signals collected across {len(CATEGORIES)} categories")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    results = collect()
    print(f"\nCollected {len(results)} YouTube signals")
    for s in results[:5]:
        print(f"  • {s['title']}")
