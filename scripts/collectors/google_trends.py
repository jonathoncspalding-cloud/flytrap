"""
google_trends.py
----------------
Pulls trending topics and rising queries from Google Trends.

Strategy:
  1. Google Trends RSS feed — daily trending searches with traffic estimates
     and linked news articles (replaces broken pytrends.trending_searches())
  2. pytrends related_queries — rising breakout queries for culture topic clusters

The RSS feed is more reliable than pytrends' trending endpoint (which has been
returning 404 since early 2026) and provides richer data: traffic volume + news context.
"""

from __future__ import annotations

import time
import logging
import requests
import xml.etree.ElementTree as ET
from datetime import date

logger = logging.getLogger(__name__)

# Google Trends RSS — public, no auth, reliable
TRENDS_RSS_URL = "https://trends.google.com/trending/rss?geo=US"
TRENDS_RSS_NS = {"ht": "https://trends.google.com/trending/rss"}

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


def _fetch_trending_rss() -> list:
    """
    Fetch daily trending searches from Google Trends RSS feed.
    Returns list of dicts with: title, traffic, news_headlines, news_urls.
    """
    try:
        resp = requests.get(TRENDS_RSS_URL, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Google Trends RSS fetch failed: {e}")
        return []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        logger.warning(f"Google Trends RSS parse failed: {e}")
        return []

    results = []
    for item in root.iter("item"):
        title_el = item.find("title")
        if title_el is None or not title_el.text:
            continue

        title = title_el.text.strip()
        traffic_el = item.find("ht:approx_traffic", TRENDS_RSS_NS)
        traffic = traffic_el.text if traffic_el is not None else "N/A"

        # Extract linked news articles for context
        news_headlines = []
        news_urls = []
        for news_item in item.findall("ht:news_item", TRENDS_RSS_NS):
            nt = news_item.find("ht:news_item_title", TRENDS_RSS_NS)
            nu = news_item.find("ht:news_item_url", TRENDS_RSS_NS)
            if nt is not None and nt.text:
                news_headlines.append(nt.text.strip())
            if nu is not None and nu.text:
                news_urls.append(nu.text.strip())

        results.append({
            "title": title,
            "traffic": traffic,
            "news_headlines": news_headlines,
            "news_urls": news_urls,
        })

    return results


def _topic_rising_queries(keywords: list) -> list:
    """Get rising related queries for a keyword group via pytrends."""
    from pytrends.request import TrendReq

    signals = []
    try:
        pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25))
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
        title, source_platform, raw_content, summary, source_url
    """
    logger.info("Collecting Google Trends signals...")
    today = date.today().isoformat()
    signals = []

    # 1. Daily trending searches via RSS feed
    trending = _fetch_trending_rss()
    logger.info(f"Google Trends RSS: {len(trending)} trending topics")

    for item in trending:
        topic = item["title"]
        traffic = item["traffic"]
        news = item["news_headlines"]

        raw_parts = [f"Trending on Google Trends (US) on {today}: {topic}"]
        raw_parts.append(f"Approximate search traffic: {traffic}")
        if news:
            raw_parts.append(f"Related news: {'; '.join(news[:3])}")
        raw_content = ". ".join(raw_parts)

        source_url = item["news_urls"][0] if item["news_urls"] else None

        signal = {
            "title": f"Google Trends Daily: {topic}",
            "source_platform": "Google Trends",
            "raw_content": raw_content[:2000],
            "summary": f"'{topic}' is trending in Google Trends US searches today ({traffic} searches).",
        }
        if source_url:
            signal["source_url"] = source_url

        signals.append(signal)

    # 2. Rising queries for culture topic clusters
    for keywords in CULTURE_TOPICS:
        rising = _topic_rising_queries(keywords)
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
    for s in results[:10]:
        print(f"  - {s['title']}")
        if s.get("raw_content"):
            print(f"    {s['raw_content'][:120]}...")
