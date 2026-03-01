"""
trends24_collector.py
---------------------
Collects US trending topics from X/Twitter via Trends24.in — a free,
public aggregator of Twitter/X trending data. No API key or auth required.

Method: HTTP GET + HTML parsing of server-rendered trend data.
Endpoint: https://trends24.in/united-states/
Data: ~50 trending topics per hourly block, 24 blocks per day.

This collector extracts the most recent hourly block of US trends,
deduplicates, and returns them as signals. Each trend includes its
position/rank in the trending list.

MAINTENANCE NOTE (auto-approved fix):
If Trends24 changes their HTML structure, the regex patterns in
_parse_trends() will need updating. This is expected and should be
fixed without user approval per Scout standing orders. The key CSS
class to look for is 'trend-name' wrapping an <a> tag.
"""

from __future__ import annotations

import logging
import re
import requests
from html import unescape

logger = logging.getLogger(__name__)

TRENDS24_URL = "https://trends24.in/united-states/"

# How many unique trends to return (most recent first)
MAX_TRENDS = 50

# Request timeout
REQUEST_TIMEOUT = 15

# User agent — standard browser UA to avoid blocks
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)


def _fetch_page() -> str:
    """Fetch the Trends24 US page. Returns raw HTML."""
    resp = requests.get(
        TRENDS24_URL,
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
    )
    resp.raise_for_status()
    return resp.text


def _parse_trends(html: str) -> list[dict]:
    """
    Parse trending topics from Trends24 HTML.

    Structure (as of Feb 2026):
        <li>
            <span class="trend-name">
                <a href="...">Topic Name</a>
            </span>
        </li>

    Trends are grouped into hourly time blocks (24 per page).
    We extract all and deduplicate, preserving first-seen order
    (most recent trends first since they appear at top of page).
    """
    # Extract trend names from the trend-name > a pattern
    raw_trends = re.findall(
        r'trend-name[^>]*>\s*<a[^>]*>([^<]+)</a>',
        html,
    )

    if not raw_trends:
        # Fallback: try alternate patterns in case HTML changes
        raw_trends = re.findall(r'data-trend-name="([^"]+)"', html)

    if not raw_trends:
        logger.warning(
            "Trends24: no trends found in HTML. "
            "The page structure may have changed — inspect %s",
            TRENDS24_URL,
        )
        return []

    # Deduplicate while preserving order (most recent block first)
    seen = set()
    unique_trends = []
    for raw in raw_trends:
        name = unescape(raw).strip()
        if not name:
            continue
        # Normalize for dedup (case-insensitive)
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_trends.append(name)

    return unique_trends


def collect() -> list:
    """
    Collect X/Twitter trending topics for the US via Trends24.
    Returns list of signal dicts.
    """
    logger.info("Collecting X/Twitter trends via Trends24...")

    try:
        html = _fetch_page()
    except Exception as e:
        logger.warning("Trends24 fetch failed: %s", e)
        return []

    trends = _parse_trends(html)

    if not trends:
        return []

    signals = []
    for i, name in enumerate(trends[:MAX_TRENDS], 1):
        # Build search URL for context
        search_url = (
            f"https://x.com/search?q={requests.utils.quote(name)}&src=trend_click"
        )

        # Determine if it's a hashtag
        is_hashtag = name.startswith("#")
        display_name = name if is_hashtag else name

        signals.append({
            "title": f"X Trending (US): {display_name}",
            "source_platform": "Social",
            "source_url": search_url,
            "raw_content": (
                f"[X/Twitter Trending — US] '{display_name}' is currently "
                f"trending on X/Twitter in the United States (position ~{i})."
            ),
            "summary": f"'{display_name}' trending on X/Twitter US",
            "_category": "Social",
        })

    logger.info("Trends24: %d trends collected (%d unique in page)", len(signals), len(trends))
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} X/Twitter trending signals")
    for s in results[:20]:
        print(f"  {s['title']}")
