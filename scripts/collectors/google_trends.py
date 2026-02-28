"""
google_trends.py
----------------
Pulls trending topics and rising queries from Google Trends via pytrends.
Returns a list of signal dicts ready for the Evidence Log.
"""

import time
import logging
from datetime import date
from pytrends.request import TrendReq

logger = logging.getLogger(__name__)

# Categories to monitor — broad cultural sweep
SEED_KEYWORDS = [
    "trending",
    "viral",
    "cultural moment",
    "goes viral",
    "everyone is talking about",
]

# Interest-over-time topics to track across multiple relevant categories
CULTURE_TOPICS = [
    ["AI", "ChatGPT", "automation"],
    ["cost of living", "inflation", "rent"],
    ["loneliness", "mental health", "anxiety"],
    ["creator economy", "influencer", "TikTok"],
    ["nostalgia", "Y2K", "retro"],
    ["authenticity", "deinfluencing", "dupes"],
    ["climate", "sustainability", "greenwashing"],
]


def _safe_trending(pytrends, retries=3) -> list:
    """Fetch daily trending searches with retry."""
    for attempt in range(retries):
        try:
            trending = pytrends.trending_searches(pn="united_states")
            return trending[0].tolist()
        except Exception as e:
            logger.warning(f"Trending fetch attempt {attempt+1} failed: {e}")
            time.sleep(2 ** attempt)
    return []


def _safe_realtime_trending(pytrends) -> list:
    """Fetch realtime trending stories."""
    try:
        rt = pytrends.realtime_trending_searches(pn="US")
        stories = []
        for _, row in rt.iterrows():
            title = row.get("title", "")
            if title:
                stories.append(title)
        return stories[:20]
    except Exception as e:
        logger.warning(f"Realtime trending failed: {e}")
        return []


def _topic_rising_queries(pytrends, keywords: list) -> list:
    """Get rising related queries for a keyword group."""
    signals = []
    try:
        pytrends.build_payload(keywords, timeframe="now 7-d", geo="US")
        related = pytrends.related_queries()
        for kw in keywords:
            rising = related.get(kw, {}).get("rising")
            if rising is not None and not rising.empty:
                for _, row in rising.head(5).iterrows():
                    signals.append({
                        "query": row["query"],
                        "value": int(row["value"]),
                        "seed_keyword": kw,
                    })
        time.sleep(1.5)  # Avoid rate limiting
    except Exception as e:
        logger.warning(f"Rising queries failed for {keywords}: {e}")
    return signals


def collect() -> list:
    """
    Collect Google Trends signals.
    Returns list of signal dicts with keys:
        title, source_platform, raw_content, summary
    """
    logger.info("Collecting Google Trends signals...")
    pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25))
    today = date.today().isoformat()
    signals = []

    # 1. Daily trending searches
    trending = _safe_trending(pytrends)
    for topic in trending[:30]:
        signals.append({
            "title": f"Google Trends Daily: {topic}",
            "source_platform": "Google Trends",
            "raw_content": f"Trending on Google Trends (US) on {today}: {topic}",
            "summary": f"'{topic}' is trending in Google Trends US searches today.",
        })

    time.sleep(1)

    # 2. Rising queries for culture topic clusters
    for keywords in CULTURE_TOPICS:
        rising = _topic_rising_queries(pytrends, keywords)
        for r in rising:
            signals.append({
                "title": f"Google Trends Rising: {r['query']}",
                "source_platform": "Google Trends",
                "raw_content": (
                    f"Rising query: '{r['query']}' (breakout value: {r['value']}) "
                    f"related to '{r['seed_keyword']}' — captured {today}"
                ),
                "summary": (
                    f"'{r['query']}' is a breakout rising query related to "
                    f"'{r['seed_keyword']}' on Google Trends."
                ),
            })

    logger.info(f"Google Trends: collected {len(signals)} signals")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} signals")
    for s in results[:5]:
        print(f"  - {s['title']}")
