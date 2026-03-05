"""
tiktok_collector.py
--------------------
Collects trending hashtags from TikTok's Creative Center.
No API key or authentication required.

Method: Fetches the public Creative Center page, which is a Next.js app
that embeds trending hashtag data as server-side rendered JSON in the
page's __NEXT_DATA__ / dehydratedState payload. No JavaScript rendering
needed — plain HTTP GET + JSON extraction.

Source: https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en

Data returned per hashtag:
  - rank (position in trending list)
  - hashtagName
  - publishCnt (number of posts in the period)
  - videoViews (total views across videos using this hashtag)
  - industryInfo (category like "Food & Beverage", "Games", etc.)
  - trend (7-day sparkline data points)
  - rankDiff / rankDiffType (movement vs previous period)

MAINTENANCE NOTE (auto-approved fix):
TikTok may change their page structure or move the data payload.
If this collector starts returning 0 signals, inspect the page HTML
for changes to the __NEXT_DATA__ / dehydratedState structure.
The key data path is: props.pageProps.dehydratedState.queries[N].state.data.pages[0].list
"""

from __future__ import annotations

import json
import logging
import re
import requests

logger = logging.getLogger(__name__)

CREATIVE_CENTER_URL = (
    "https://ads.tiktok.com/business/creativecenter"
    "/inspiration/popular/hashtag/pc/en"
)

# Request timeout (seconds)
REQUEST_TIMEOUT = 20

# How many hashtags to return as signals
MAX_HASHTAGS = 20

# User agent — standard browser UA
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)


def _fetch_page() -> str:
    """Fetch the TikTok Creative Center trending hashtags page."""
    resp = requests.get(
        CREATIVE_CENTER_URL,
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
    )
    resp.raise_for_status()
    return resp.text


def _extract_hashtags(html: str) -> list[dict]:
    """
    Extract trending hashtag data from the page's embedded JSON.

    TikTok Creative Center is a Next.js SSR app. The trending data is
    embedded in a <script> tag as part of the __NEXT_DATA__ payload,
    inside the dehydratedState (react-query cache). We find it by
    looking for the script containing 'hashtagName'.
    """
    # Find script tags containing hashtag data
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)

    for script in scripts:
        if '"hashtagName"' not in script or len(script) < 1000:
            continue

        # Find the JSON blob starting with {"props"
        start = script.find('{"props"')
        if start < 0:
            start = script.find('{"')
        if start < 0:
            continue

        # Parse the JSON by tracking bracket depth
        bracket_depth = 0
        for j, c in enumerate(script[start:], start):
            if c == '{':
                bracket_depth += 1
            elif c == '}':
                bracket_depth -= 1
            if bracket_depth == 0:
                try:
                    data = json.loads(script[start:j + 1])
                except json.JSONDecodeError:
                    continue

                # Navigate: props.pageProps.dehydratedState.queries
                try:
                    queries = (
                        data["props"]["pageProps"]["dehydratedState"]["queries"]
                    )
                except (KeyError, TypeError):
                    logger.warning(
                        "TikTok CC: JSON structure changed — "
                        "could not find dehydratedState.queries"
                    )
                    return []

                # Find the query containing hashtag list data
                for query in queries:
                    try:
                        pages = query["state"]["data"]["pages"]
                        hashtag_list = pages[0]["list"]
                        if (
                            isinstance(hashtag_list, list)
                            and len(hashtag_list) > 0
                            and isinstance(hashtag_list[0], dict)
                            and "hashtagName" in hashtag_list[0]
                        ):
                            return hashtag_list
                    except (KeyError, TypeError, IndexError):
                        continue

                logger.warning(
                    "TikTok CC: found dehydratedState but no hashtag "
                    "list in any query"
                )
                return []

    logger.warning(
        "TikTok CC: no script tag with hashtagName found. "
        "Page structure may have changed."
    )
    return []


def _format_views(views: int) -> str:
    """Format large view counts for readability."""
    if views >= 1_000_000_000:
        return f"{views / 1_000_000_000:.1f}B"
    if views >= 1_000_000:
        return f"{views / 1_000_000:.1f}M"
    if views >= 1_000:
        return f"{views / 1_000:.0f}K"
    return str(views)


def _trend_direction(rank_diff_type: int, rank_diff: int) -> str:
    """Interpret rank movement. Type 1 = new, 2 = same, 3 = up, 4 = down."""
    if rank_diff_type == 1:
        return "NEW"
    if rank_diff_type == 3:
        return f"up {rank_diff}"
    if rank_diff_type == 4:
        return f"down {rank_diff}"
    return "steady"


def collect() -> list:
    """
    Collect TikTok trending hashtag signals from Creative Center.
    Returns list of signal dicts.
    """
    logger.info("Collecting TikTok trending hashtags...")

    try:
        html = _fetch_page()
    except Exception as e:
        logger.warning("TikTok Creative Center fetch failed: %s", e)
        return []

    hashtags = _extract_hashtags(html)

    if not hashtags:
        logger.warning("TikTok CC: no hashtags extracted from page")
        return []

    signals = []
    for item in hashtags[:MAX_HASHTAGS]:
        name = item.get("hashtagName", "")
        rank = item.get("rank", 0)
        posts = item.get("publishCnt", 0)
        views = item.get("videoViews", 0)
        industry = item.get("industryInfo", {})
        industry_name = industry.get("value", "General") if isinstance(industry, dict) else "General"
        is_promoted = item.get("isPromoted", False)
        rank_diff = item.get("rankDiff", 0)
        rank_diff_type = item.get("rankDiffType", 0)

        if not name:
            continue

        # Skip promoted/sponsored hashtags — they're ads, not organic trends
        if is_promoted:
            continue

        direction = _trend_direction(rank_diff_type, rank_diff)
        views_str = _format_views(views)
        hashtag_url = f"https://www.tiktok.com/tag/{name}"

        raw_content = (
            f"[TikTok Trending Hashtag] #{name} — "
            f"rank #{rank} ({direction}), "
            f"{posts:,} posts, {views_str} views. "
            f"Category: {industry_name}."
        )

        summary = (
            f"#{name} trending on TikTok (#{rank}, {views_str} views, "
            f"{industry_name})"
        )

        signals.append({
            "title": f"TikTok Trending: #{name}",
            "source_platform": "TikTok",
            "source_url": hashtag_url,
            "raw_content": raw_content,
            "summary": summary,
            "_category": "Social",
        })

    logger.info(
        "TikTok: %d signals collected (%d hashtags on page)",
        len(signals),
        len(hashtags),
    )
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} TikTok signals")
    for s in results:
        print(f"  {s['title']}")
        print(f"    {s['summary']}")
        print()
