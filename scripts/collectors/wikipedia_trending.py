"""
wikipedia_trending.py
---------------------
Fetches Wikipedia's most-viewed articles to detect topics getting unusual attention.
Uses the public Wikimedia Pageviews API — no authentication required.
"""

import logging
import requests
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

WIKIMEDIA_API = "https://wikimedia.org/api/rest_v1"
USER_AGENT = "CulturalForecaster/1.0 (jonathon@cornett.com)"

# Articles to filter out — perennially popular but not culturally interesting
EXCLUDE_TITLES = {
    "Main_Page", "Wikipedia", "Special:Search", "Portal:Current_events",
    "United_States", "YouTube", "Facebook", "Google", "Amazon_(company)",
    "Microsoft", "Apple_Inc.", "Netflix", "Twitter", "Instagram",
}

# We want articles with significant view spikes, not evergreen pages
MIN_VIEWS = 50_000
TOP_N = 100  # Fetch top 100, then filter


def _get_top_articles(date_str: str) -> list:
    """Fetch top viewed Wikipedia articles for a given date (YYYY/MM/DD)."""
    url = f"{WIKIMEDIA_API}/metrics/pageviews/top/en.wikipedia/all-access/{date_str}"
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        articles = data["items"][0]["articles"]
        return articles[:TOP_N]
    except Exception as e:
        logger.warning(f"Wikipedia trending fetch failed for {date_str}: {e}")
        return []


def _humanize_title(title: str) -> str:
    return title.replace("_", " ")


def collect() -> list:
    """
    Collect Wikipedia trending signals.
    Returns list of signal dicts.

    Wikipedia pageviews API has a ~1-2 day data lag. We try yesterday first,
    then day-before-yesterday as fallback if yesterday returns empty.
    """
    logger.info("Collecting Wikipedia trending signals...")
    signals = []

    # Try yesterday first, fall back to day-before-yesterday (API lag)
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y/%m/%d")
    day_before = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y/%m/%d")

    articles = _get_top_articles(yesterday)
    if not articles:
        logger.info(f"Wikipedia: no data for {yesterday}, trying {day_before}...")
        articles = _get_top_articles(day_before)
    for article in articles:
        title = article.get("article", "")
        views = article.get("views", 0)
        rank = article.get("rank", 0)

        if title in EXCLUDE_TITLES:
            continue
        if views < MIN_VIEWS:
            continue
        # Skip disambiguation pages and list pages
        if title.startswith(("List_of_", "Deaths_in_", "Portal:")):
            continue

        human_title = _humanize_title(title)
        wiki_url = f"https://en.wikipedia.org/wiki/{title}"

        signals.append({
            "title": f"Wikipedia Trending: {human_title}",
            "source_platform": "Wikipedia",
            "source_url": wiki_url,
            "raw_content": (
                f"Wikipedia article '{human_title}' ranked #{rank} in top viewed pages "
                f"with {views:,} views on {yesterday.replace('/', '-')}."
            ),
            "summary": (
                f"'{human_title}' is trending on Wikipedia with {views:,} views "
                f"(rank #{rank})."
            ),
        })

    logger.info(f"Wikipedia: collected {len(signals)} signals")
    return signals


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = collect()
    print(f"\nCollected {len(results)} signals")
    for s in results[:10]:
        print(f"  - {s['title']}")
        print(f"    {s['summary']}")
